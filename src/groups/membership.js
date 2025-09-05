'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const cache = require('../cache');

module.exports = function (Groups) {
	// CONSTANTS  
	// Refactored with assistance from OpenAI's GPT-5 (ChatGPT).
	
	const isMemberOfEphemeralGroup = (uid, groupName) =>
		(groupName === 'guests' && parseInt(uid, 10) === 0) ||
		(groupName === 'spiders' && parseInt(uid, 10) === -1);

	const getCached = (key) => {
		const value = Groups.cache.get(key);
		return value !== undefined ? value : null;
	};

	const setCached = (key, value) => Groups.cache.set(key, value);

	const filterNonCachedUids = (uids, groupName, cachedData) =>
		uids.filter((uid) => {
			const key = `${uid}:${groupName}`;
			const cached = getCached(key);
			if (cached !== null) cachedData[key] = cached;
			return cached === null;
		});

	const filterNonCachedGroups = (uid, groups, cachedData) =>
		groups.filter((groupName) => {
			const key = `${uid}:${groupName}`;
			const cached = getCached(key);
			if (cached !== null) cachedData[key] = cached;
			return cached === null;
		});

	const getGroupMembers = async (groupNames) => {
		return await db.getSortedSetsMembers(groupNames.map(name => `group:${name}:members`));
	};

	// FUNCTIONS
	Groups.getMembers = async (groupName, start, stop) =>
		await db.getSortedSetRevRange(`group:${groupName}:members`, start, stop);

	Groups.getMemberUsers = async function (groupNames, start, stop) {
		async function get(groupName) {
			const uids = await Groups.getMembers(groupName, start, stop);
			return await user.getUsersWithFields(uids, ['uid', 'username', 'picture', 'userslug']);
		}
		return await Promise.all(groupNames.map(name => get(name)));
	};

	Groups.getMembersOfGroups = async groupNames =>
		await getGroupMembers(groupNames);

	Groups.isMember = async function (uid, groupName) {
		if (!uid || parseInt(uid, 10) <= 0 || !groupName) { 
			return isMemberOfEphemeralGroup(uid, groupName);
		}
		const cacheKey = `${uid}:${groupName}`;
		let isMember = getCached(cacheKey);
		if (isMember !== null) return isMember;

		isMember = await db.isSortedSetMember(`group:${groupName}:members`, uid);
		setCached(cacheKey, isMember);
		return isMember;
	};

	Groups.isMembers = async function (uids, groupName) {
		if (!groupName || !uids.length) {
			return uids.map(() => false);
		}
		if (groupName === 'guests' || groupName === 'spiders') {
			return uids.map(uid => isMemberOfEphemeralGroup(uid, groupName));
		}
		const cachedData = {};
		const nonCachedUids = filterNonCachedUids(uids, groupName, cachedData);

		if (nonCachedUids.length) {
			const isMembers = await db.isSortedSetMembers(`group:${groupName}:members`, nonCachedUids);
			nonCachedUids.forEach((uid, i) => {
				const key = `${uid}:${groupName}`;
				cachedData[key] = isMembers[i];
				setCached(key, isMembers[i]);
			});
		}
		return uids.map(uid => cachedData[`${uid}:${groupName}`]);
	};

	Groups.isMemberOfGroups = async function (uid, groups) {
		if (!uid || parseInt(uid, 10) <= 0 || !groups.length) {
			return groups.map(groupName => isMemberOfEphemeralGroup(uid, groupName));
		}
		const cachedData = {};
		const nonCachedGroups = filterNonCachedGroups(uid, groups, cachedData);

		if (nonCachedGroups.length) {
			const sets = nonCachedGroups.map(groupName => `group:${groupName}:members`);
			const isMembers = await db.isMemberOfSortedSets(sets, uid);
			nonCachedGroups.forEach((groupName, index) => {
				const key = `${uid}:${groupName}`;
				cachedData[key] = isMembers[index];
				setCached(key, isMembers[index]);
			});
		}
		return groups.map(groupName => cachedData[`${uid}:${groupName}`]);
	};

	Groups.isMemberOfAny = async function (uid, groups) {
		if (!Array.isArray(groups) || !groups.length) {
			return false;
		}
		const isMembers = await Groups.isMemberOfGroups(uid, groups);
		return isMembers.includes(true);
	};

	Groups.getMemberCount = async groupName =>
		parseInt(await db.getObjectField(`group:${groupName}`, 'memberCount'), 10);

	Groups.isMemberOfGroupList = async function (uid, groupListKey) {
		let groupNames = await getGroupNames(groupListKey);
		groupNames = Groups.removeEphemeralGroups(groupNames);
		if (!groupNames.length) {
			return false;
		}

		const isMembers = await Groups.isMemberOfGroups(uid, groupNames);
		return isMembers.includes(true);
	};

	Groups.isMemberOfGroupsList = async function (uid, groupListKeys) {
		const members = await getGroupNames(groupListKeys);
		
		let uniqueGroups = _.uniq(_.flatten(members));
		uniqueGroups = Groups.removeEphemeralGroups(uniqueGroups);


		const isMembers = await Groups.isMemberOfGroups(uid, uniqueGroups);
		const isGroupMember = _.zipObject(uniqueGroups, isMembers);


		return members.map(groupNames => !!groupNames.find(name => isGroupMember[name]));

	};

	Groups.isMembersOfGroupList = async function (uids, groupListKey) {
		let groupNames = await getGroupNames(groupListKey);
		groupNames = Groups.removeEphemeralGroups(groupNames);
		if (!groupNames.length) {
			return uids.map(() => false);
		}
		const isGroupMembers = await Promise.all(groupNames.map(name => Groups.isMembers(uids, name)));

		return uids.map((_, index) => isGroupMembers.some(isMembers => isMembers[index]));
	};

	async function getGroupNames(keys) {
		const isArray = Array.isArray(keys);
		keys = isArray ? keys : [keys];

		const cachedData = {};
		const nonCachedKeys = keys.filter((groupName) => {
			const cached = cache.get(`group:${groupName}:members`);
			if (cached !== undefined) {
				cachedData[groupName] = cached;
			}
			return cached === undefined;
		});

		if (nonCachedKeys.length) {
			const groupMembers = await getGroupMembers(nonCachedKeys);
			nonCachedKeys.forEach((groupName, index) => {
				cachedData[groupName] = groupMembers[index];
				cache.set(`group:${groupName}:members`, groupMembers[index]);
			});
		}

		return isArray ? keys.map(groupName => cachedData[groupName]) : cachedData[keys[0]];
	};
};
