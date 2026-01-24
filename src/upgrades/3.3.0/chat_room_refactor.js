/* eslint-disable no-await-in-loop */


'use strict';


const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Update chat messages to add roomId field',
	timestamp: Date.UTC(2023, 6, 2),
	method: async function () {
		const { progress } = this;


		const nextChatRoomId = await db.getObjectField('global', 'nextChatRoomId');
		const allRoomIds = Array.from({ length: nextChatRoomId }, (_, i) => i + 1);

		// calculate user count and set progress.total
		progress.total = await calculateTotalProgress(allRoomIds);


		await batch.processArray(allRoomIds, async (roomIds) => {
			const arrayOfRoomData = await db.getObjects(roomIds.map(roomId => `chat:room:${roomId}`));
			for (const roomData of arrayOfRoomData) {
				if (roomData) {
					await migrateSingleRoom(roomData, progress);
				}
			}
		}, {
			batch: 500,
		});
	},
};


async function calculateTotalProgress(allRoomIds) {
	let total = 0;
	await batch.processArray(allRoomIds, async (roomIds) => {
		const arrayOfRoomData = await db.getObjects(roomIds.map(roomId => `chat:room:${roomId}`));
		await Promise.all(roomIds.map(async (roomId, idx) => {
			const roomData = arrayOfRoomData[idx];
			if (roomData) {
				const userCount = await db.sortedSetCard(`chat:room:${roomId}:uids`);
				total += userCount;
			}
		}));
	}, {
		batch: 500,
	});
	return total;
}


async function migrateSingleRoom(roomData, progress) {
	const midsSeen = {};
	const { roomId } = roomData;
	const uids = await db.getSortedSetRange(`chat:room:${roomId}:uids`, 0, -1);
	for (const uid of uids) {
		await migrateUserMessages(uid, roomId, midsSeen);
		progress.incr(1);
	}


	await db.setObjectField(`chat:room:${roomId}`, 'userCount', uids.length);
}


async function migrateUserMessages(uid, roomId, midsSeen) {
	await batch.processSortedSet(`uid:${uid}:chat:room:${roomId}:mids`, async (userMessageData) => {
		const uniqMessages = userMessageData.filter(m => !midsSeen.hasOwnProperty(m.value));
		const uniqMids = uniqMessages.map(m => m.value);
		if (!uniqMids.length) {
			return;
		}


		let messageData = await db.getObjects(uniqMids.map(mid => `message:${mid}`));
		messageData.forEach((m, idx) => {
			if (m && uniqMessages[idx]) {
				m.mid = parseInt(uniqMids[idx], 10);
				m.timestamp = m.timestamp || uniqMessages[idx].score || 0;
			}
		});
		messageData = messageData.filter(Boolean);


		const bulkSet = messageData.map(
			msg => [`message:${msg.mid}`, {
				roomId: roomId,
				timestamp: msg.timestamp,
			}]
		);


		await db.setObjectBulk(bulkSet);
		await db.sortedSetAdd(
			`chat:room:${roomId}:mids`,
			messageData.map(m => m.timestamp),
			messageData.map(m => m.mid),
		);
		uniqMids.forEach((mid) => {
			midsSeen[mid] = 1;
		});
	}, {
		batch: 500,
		withScores: true,
	});


	await db.deleteAll(`uid:${uid}:chat:room:${roomId}:mids`);
}









