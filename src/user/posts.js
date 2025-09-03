'use strict';

const db = require('../database');
const meta = require('../meta');
const privileges = require('../privileges');
const plugins = require('../plugins');
const groups = require('../groups');
const activitypub = require('../activitypub');

module.exports = function (User) {
	User.isReadyToPost = async function (uid, cid) {
		await isReady(uid, cid, 'lastposttime');
	};

	User.isReadyToQueue = async function (uid, cid) {
		await isReady(uid, cid, 'lastqueuetime');
	};

	User.checkMuted = async function (uid) {
		const now = Date.now();
		const mutedUntil = await User.getUserField(uid, 'mutedUntil');
		if (mutedUntil > now) {
			let muteLeft = ((mutedUntil - now) / (1000 * 60));
			if (muteLeft > 60) {
				muteLeft = (muteLeft / 60).toFixed(0);
				throw new Error(`[[error:user-muted-for-hours, ${muteLeft}]]`);
			} else {
				throw new Error(`[[error:user-muted-for-minutes, ${muteLeft.toFixed(0)}]]`);
			}
		}
	};

	async function prelimChecks(uid, cid, field) {
		const bypass = {bypass: true};
		if (activitypub.helpers.isUri(uid) || parseInt(uid, 10) === 0) {
			return bypass;
		}
		const [userData, isAdminOrMod, isMemberOfExempt] = await Promise.all([
			User.getUserFields(uid, ['uid', 'mutedUntil', 'joindate', 'email', 'reputation'].concat([field])),
			privileges.categories.isAdminOrMod(cid, uid),
			groups.isMemberOfAny(uid, meta.config.groupsExemptFromNewUserRestrictions),
		]);

		if (!userData.uid) {
			throw new Error('[[error:no-user]]');
		}

		if (isAdminOrMod) {
			return bypass;
		}

		// return userData, isAdminOrMod, isMemberOfExempt;
		return {bypass: false, userData: userData, isAdminOrMod: isAdminOrMod, isMemberOfExempt: isMemberOfExempt};

	}


	function endChecks(userData, lasttime, metaconfig) {
		const now = Date.now();
		// const lasttime = userData[field] || 0;

		const rules = [
			()=>{
				if (now - userData.joindate < metaconfig.initialPostDelay * 1000) {
					throw new Error(`[[error:user-too-new, ${metaconfig.initialPostDelay}]]`);
				}
			},
			()=>{
				if (now - lasttime < metaconfig.postDelay * 1000) {
					throw new Error(`[[error:too-many-posts, ${metaconfig.postDelay}]]`);
				}
			},
		];

		for (const rule of rules) rule();
		return;
	}

	// Refactored
	async function isReady(uid, cid, field) {

		const prelim = await prelimChecks(uid, cid, field);
		if (prelim.bypass) return;
		const { userData, isAdminOrMod, isMemberOfExempt } = prelim;
		
		await User.checkMuted(uid);
		

		const { shouldIgnoreDelays } = await plugins.hooks.fire('filter:user.posts.isReady', {
			shouldIgnoreDelays: false,
			user: userData,
			cid,
			field,
			isAdminOrMod,
			isMemberOfExempt,
		});
		if (shouldIgnoreDelays) {
			return;
		}

		const metaconfig = meta.config;
		const lasttime = userData[field] || 0;
		const now = Date.now();

		const isNewbie = !isMemberOfExempt &&
									 (metaconfig.newbiePostDelay > 0) &&
									 (metaconfig.newbieReputationThreshold > userData.reputation) &&
									 (now - lasttime < metaconfig.newbiePostDelay * 1000);
		const tooFast = metaconfig.newbiewPostDelay % 60 === 0;

		if (isNewbie && tooFast) {
			const wholeMinutes = (metaconfig.newbiePostDelay % 60) === 0;
			const minutes = Math.floor(metaconfig.newbiePostDelay / 60);
			const msg = wholeMinutes ? 
				`[[error:too-many-posts-newbie-minutes, ${minutes}, ${metaconfig.newbieReputationThreshold}]]` : 
				`[[error:too-many-posts-newbie, ${metaconfig.newbiePostDelay}, ${metaconfig.newbieReputationThreshold}]]`;
			throw new Error(msg);
		}

		
		endChecks(userData, lasttime, metaconfig);
		
		return;
	}
	

	User.onNewPostMade = async function (postData) {
		// For scheduled posts, use "action" time. It'll be updated in related cron job when post is published
		const lastposttime = postData.timestamp > Date.now() ? Date.now() : postData.timestamp;

		await Promise.all([
			User.addPostIdToUser(postData),
			User.setUserField(postData.uid, 'lastposttime', lastposttime),
			User.updateLastOnlineTime(postData.uid),
		]);
	};

	User.addPostIdToUser = async function (postData) {
		await db.sortedSetsAdd([
			`uid:${postData.uid}:posts`,
			`cid:${postData.cid}:uid:${postData.uid}:pids`,
		], postData.timestamp, postData.pid);
		await User.updatePostCount(postData.uid);
	};

	User.updatePostCount = async (uids) => {
		uids = Array.isArray(uids) ? uids : [uids];
		const exists = await User.exists(uids);
		uids = uids.filter((uid, index) => exists[index]);
		if (uids.length) {
			const counts = await db.sortedSetsCard(uids.map(uid => `uid:${uid}:posts`));
			await Promise.all([
				db.setObjectBulk(uids.map((uid, index) => ([`user${activitypub.helpers.isUri(uid) ? 'Remote' : ''}:${uid}`, { postcount: counts[index] }]))),
				db.sortedSetAdd('users:postcount', counts, uids),
			]);
		}
	};

	User.incrementUserPostCountBy = async function (uid, value) {
		return await incrementUserFieldAndSetBy(uid, 'postcount', 'users:postcount', value);
	};

	User.incrementUserReputationBy = async function (uid, value) {
		return await incrementUserFieldAndSetBy(uid, 'reputation', 'users:reputation', value);
	};

	User.incrementUserFlagsBy = async function (uid, value) {
		return await incrementUserFieldAndSetBy(uid, 'flags', 'users:flags', value);
	};

	async function incrementUserFieldAndSetBy(uid, field, set, value) {
		value = parseInt(value, 10);
		if (!value || !field || !(parseInt(uid, 10) > 0)) {
			return;
		}
		const exists = await User.exists(uid);
		if (!exists) {
			return;
		}
		const newValue = await User.incrementUserFieldBy(uid, field, value);
		await db.sortedSetAdd(set, newValue, uid);
		return newValue;
	}

	User.getPostIds = async function (uid, start, stop) {
		return await db.getSortedSetRevRange(`uid:${uid}:posts`, start, stop);
	};
};
