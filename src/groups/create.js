'use strict';

const meta = require('../meta');
const plugins = require('../plugins');
const slugify = require('../slugify');
const db = require('../database');

module.exports = function (Groups) {
	Groups.create = async function (data) {
		const timestamp = data.timestamp || Date.now();
		const {groupData, isHidden, isSystem} = await Groups.createGroupData(data, timestamp);

		await plugins.hooks.fire('filter:group.create', { group: groupData, data: data });

		await db.sortedSetAdd('groups:createtime', groupData.createtime, groupData.name);
		await db.setObject(`group:${groupData.name}`, groupData);

		if (data.hasOwnProperty('ownerUid')) {
			await db.setAdd(`group:${groupData.name}:owners`, data.ownerUid);
			await db.sortedSetAdd(`group:${groupData.name}:members`, timestamp, data.ownerUid);
		}

		if (!isHidden && !isSystem) {
			await db.sortedSetAddBulk([
				['groups:visible:createtime', timestamp, groupData.name],
				['groups:visible:memberCount', groupData.memberCount, groupData.name],
				['groups:visible:name', 0, `${groupData.name.toLowerCase()}:${groupData.name}`],
			]);
		}

		if (!Groups.isPrivilegeGroup(groupData.name)) {
			await db.setObjectField('groupslug:groupname', groupData.slug, groupData.name);
		}

		const newGroupData = await Groups.getGroupData(groupData.name);
		plugins.hooks.fire('action:group.create', { group: newGroupData });
		return newGroupData;
	}; 

	Groups.createGroupData = async function (data, timestamp) {
		const isSystem = isSystemGroup(data);
		const disableJoinRequests = parseInt(data.disableJoinRequests, 10) === 1 || data.name === 'administrators' ? 1 : 0;
		const disableLeave = parseInt(data.disableLeave, 10) === 1 ? 1 : 0;
		const isHidden = parseInt(data.hidden, 10) === 1;

		Groups.validateGroupName(data.name);

		const [exists, privGroupExists] = await Promise.all([
			meta.slugTaken(data.name),
			privilegeGroupExists(data.name),
		]);
		if (exists || privGroupExists) {
			throw new Error('[[error:group-already-exists]]');
		}

		const memberCount = data.hasOwnProperty('ownerUid') ? 1 : 0;
		const isPrivate = data.hasOwnProperty('private') && data.private !== undefined ? parseInt(data.private, 10) === 1 : true;
		const groupData = {
			name: data.name,
			slug: slugify(data.name),
			createtime: timestamp,
			userTitle: data.userTitle || data.name,
			userTitleEnabled: parseInt(data.userTitleEnabled, 10) === 1 ? 1 : 0,
			description: data.description || '',
			memberCount: memberCount,
			hidden: + isHidden,
			system: + isSystem,
			private: + isPrivate,
			disableJoinRequests: disableJoinRequests,
			disableLeave: disableLeave,
		};
		return {groupData, isHidden, isSystem};
	};

	function isSystemGroup(data) {
		return data.system === true || parseInt(data.system, 10) === 1 ||
			Groups.systemGroups.includes(data.name) ||
			Groups.isPrivilegeGroup(data.name);
	}

	async function privilegeGroupExists(name) {
		return Groups.isPrivilegeGroup(name) && await db.isSortedSetMember('groups:createtime', name);
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
