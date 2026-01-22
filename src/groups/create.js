'use strict';

const meta = require('../meta');
const plugins = require('../plugins');
const slugify = require('../slugify');
const db = require('../database');

module.exports = function (Groups) {
	Groups.create = async function (data) {
		const groupData = await processGroupCreation(data);
		return groupData;
	};

	async function processGroupCreation(data) {
		const groupConfig = prepareGroupConfig(data);
		await validateGroupCreation(data);
		
		let groupData = buildGroupData(data, groupConfig);
		await plugins.hooks.fire('filter:group.create', { group: groupData, data: data });
		
		await persistGroupData(groupData);
		
		if (data.hasOwnProperty('ownerUid')) {
			await addGroupOwner(groupData.name, data.ownerUid, groupData.createtime);
		}

		if (!groupConfig.isHidden && !groupConfig.isSystem) {
			await addToVisibleGroups(groupData);
		}
		
		if (!Groups.isPrivilegeGroup(groupData.name)) {
			await storeGroupSlug(groupData);
		}
		
		groupData = await Groups.getGroupData(groupData.name);
		await plugins.hooks.fire('action:group.create', { group: groupData });
		
		return groupData;
	}

	function prepareGroupConfig(data) {
		const isSystem = isSystemGroup(data);
		const timestamp = data.timestamp || Date.now();
		let disableJoinRequests = parseInt(data.disableJoinRequests, 10) === 1 ? 1 : 0;
		
		if (data.name === 'administrators') {
			disableJoinRequests = 1;
		}
		
		const disableLeave = parseInt(data.disableLeave, 10) === 1 ? 1 : 0;
		const isHidden = parseInt(data.hidden, 10) === 1;
		const isPrivate = data.hasOwnProperty('private') && data.private !== undefined ? 
			parseInt(data.private, 10) === 1 : true;
		const memberCount = data.hasOwnProperty('ownerUid') ? 1 : 0;
		
		return {
			isSystem,
			timestamp,
			disableJoinRequests,
			disableLeave,
			isHidden,
			isPrivate,
			memberCount,
		};
	}

	async function validateGroupCreation(data) {
		Groups.validateGroupName(data.name);
		
		const [exists, privGroupExists] = await Promise.all([
			meta.slugTaken(data.name),
			(Groups.isPrivilegeGroup(data.name) && await db.isSortedSetMember('groups:createtime', data.name)),
		]);
		
		if (exists || privGroupExists) {
			throw new Error('[[error:group-already-exists]]');
		}
	}

	function buildGroupData(data, config) {
		return {
			name: data.name,
			slug: slugify(data.name),
			createtime: config.timestamp,
			userTitle: data.userTitle || data.name,
			userTitleEnabled: parseInt(data.userTitleEnabled, 10) === 1 ? 1 : 0,
			description: data.description || '',
			memberCount: config.memberCount,
			hidden: config.isHidden ? 1 : 0,
			system: config.isSystem ? 1 : 0,
			private: config.isPrivate ? 1 : 0,
			disableJoinRequests: config.disableJoinRequests,
			disableLeave: config.disableLeave,
		};
	}

	async function persistGroupData(groupData) {
		await db.sortedSetAdd('groups:createtime', groupData.createtime, groupData.name);
		await db.setObject(`group:${groupData.name}`, groupData);
	}

	async function addGroupOwner(groupName, ownerUid, timestamp) {
		await db.setAdd(`group:${groupName}:owners`, ownerUid);
		await db.sortedSetAdd(`group:${groupName}:members`, timestamp, ownerUid);
	}

	async function addToVisibleGroups(groupData) {
		await db.sortedSetAddBulk([
			['groups:visible:createtime', groupData.createtime, groupData.name],
			['groups:visible:memberCount', groupData.memberCount, groupData.name],
			['groups:visible:name', 0, `${groupData.name.toLowerCase()}:${groupData.name}`],
		]);
	}

	async function storeGroupSlug(groupData) {
		await db.setObjectField('groupslug:groupname', groupData.slug, groupData.name);
	}
	
	function isSystemGroup(data) {
		return data.system === true || parseInt(data.system, 10) === 1 ||
			Groups.systemGroups.includes(data.name) ||
			Groups.isPrivilegeGroup(data.name);
	}

	Groups.validateGroupName = function (name) {
		if (!name) {
			throw new Error('[[error:group-name-too-short]]');
		}

		if (typeof name !== 'string') {
			throw new Error('[[error:invalid-group-name]]');
		}

		if (!Groups.isPrivilegeGroup(name) && name.length > meta.config.maximumGroupNameLength) {
			throw new Error('[[error:group-name-too-long]]');
		}

		if (name === 'guests' || (!Groups.isPrivilegeGroup(name) && name.includes(':'))) {
			throw new Error('[[error:invalid-group-name]]');
		}

		if (name.includes('/') || !slugify(name)) {
			throw new Error('[[error:invalid-group-name]]');
		}
	};
};
