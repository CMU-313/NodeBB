'use strict';

const topics = require('../../topics');
const io = require('..');
const webserver = require('../../webserver');

const totals = {};

const SocketRooms = module.exports;

SocketRooms.totals = totals;

SocketRooms.getTotalGuestCount = async function () {
	const s = await io.in('online_guests').fetchSockets();
	return s.length;
};

SocketRooms.getAll = async function () {
	const sockets = await io.server.fetchSockets();

	totals.onlineGuestCount = 0;
	totals.onlineRegisteredCount = 0;
	totals.socketCount = sockets.length;
	totals.topTenTopics = [];
	totals.users = {
		categories: 0,
		recent: 0,
		unread: 0,
		topics: 0,
		category: 0,
	};
	const userRooms = {};
	const topicData = {};
	for (const s of sockets) {
		for (const key of s.rooms) {
			if (key === 'online_guests') {
				totals.onlineGuestCount += 1;
			} else if (key === 'categories') {
				totals.users.categories += 1;
			} else if (key === 'recent_topics') {
				totals.users.recent += 1;
			} else if (key === 'unread_topics') {
				totals.users.unread += 1;
			} else if (key.startsWith('uid_')) {
				userRooms[key] = 1;
			} else if (key.startsWith('category_')) {
				totals.users.category += 1;
			} else {
				const tid = key.match(/^topic_(\d+)/);
				if (tid) {
					totals.users.topics += 1;
					topicData[tid[1]] = topicData[tid[1]] || { count: 0 };
					topicData[tid[1]].count += 1;
				}
			}
		}
	}
	totals.onlineRegisteredCount = Object.keys(userRooms).length;

	let topTenTopics = [];
	Object.keys(topicData).forEach((tid) => {
		topTenTopics.push({ tid: tid, count: topicData[tid].count });
	});
	topTenTopics = topTenTopics.sort((a, b) => b.count - a.count).slice(0, 10);
	const topTenTids = topTenTopics.map(topic => topic.tid);

	const titles = await topics.getTopicsFields(topTenTids, ['title']);
	totals.topTenTopics = topTenTopics.map((topic, index) => {
		topic.title = titles[index].title;
		return topic;
	});

	return totals;
};

SocketRooms.getOnlineUserCount = function (io) {
	let count = 0;

	if (io) {
		for (const [key] of io.sockets.adapter.rooms) {
			if (key.startsWith('uid_')) {
				count += 1;
			}
		}
	}

	return count;
};

SocketRooms.getLocalStats = function () {
	console.log('Jai Nukala - SocketRooms.getLocalStats called');
	const Sockets = require('../index');
	const io = Sockets.server;

	// 1. Default State (Early exit if no IO)
	const stats = createEmptyStatsObject(webserver.getConnectionCount());
	if (!io?.sockets?.adapter?.rooms) return stats;

	// 2. Direct Counts
	stats.onlineGuestCount = Sockets.getCountInRoom('online_guests');
	stats.onlineRegisteredCount = SocketRooms.getOnlineUserCount(io);
	stats.socketCount = io.sockets.sockets.size;
	stats.users.categories = Sockets.getCountInRoom('categories');
	stats.users.recent = Sockets.getCountInRoom('recent_topics');
	stats.users.unread = Sockets.getCountInRoom('unread_topics');

	// 3. Process Rooms (Extracted logic to reduce complexity)
	const topicList = [];

	for (const [room, clients] of io.sockets.adapter.rooms) {
		processRoomData({
			room,
			size: clients.size,
			stats,
			topicList,
		});
	}

	// 4. Finalize Topics
	stats.topics = topicList
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	return stats;
};

// Helper to keep the main function clean
function processRoomData({ room, size, stats, topicList }) {
	if (room.startsWith('topic_')) {
		const tid = room.split('_')[1];
		stats.users.topics += size;
		topicList.push({ tid, count: size });
	} else if (room.startsWith('category')) {
		stats.users.category += size;
	}
}

function createEmptyStatsObject(connCount) {
	return {
		onlineGuestCount: 0,
		onlineRegisteredCount: 0,
		socketCount: 0,
		connectionCount: connCount,
		users: { categories: 0, recent: 0, unread: 0, topics: 0, category: 0 },
		topics: [],
	};
}

require('../../promisify')(SocketRooms);
