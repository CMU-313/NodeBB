'use strict';

const _ = require('lodash');

const meta = require('../meta');
const plugins = require('../plugins');
const db = require('../database');
const groups = require('../groups');
const activitypub = require('../activitypub');
const utils = require('../utils');

module.exports = function (User) {
	const filterFnMap = {
		online: user => user.status !== 'offline' && (Date.now() - user.lastonline < 300000),
		flagged: user => parseInt(user.flags, 10) > 0,
		verified: user => !!user['email:confirmed'],
		unverified: user => !user['email:confirmed'],
	};

	const filterFieldMap = {
		online: ['status', 'lastonline'],
		flagged: ['flags'],
		verified: ['email:confirmed'],
		unverified: ['email:confirmed'],
	};

	User.search = async function (data) {
		const query = data.query || '';
		const searchBy = data.searchBy || 'username';
		const page = data.page || 1;
		const uid = data.uid || 0;
		const paginate = data.hasOwnProperty('paginate') ? data.paginate : true;

		const startTime = process.hrtime();

		let uids = [];
		if (searchBy === 'ip') {
			uids = await searchByIP(query);
		} else if (searchBy === 'uid') {
			uids = [query];
		} else {
			if (!data.findUids && data.uid) {
				const handle = activitypub.helpers.isWebfinger(data.query);
				if (handle || activitypub.helpers.isUri(data.query)) {
					const local = await activitypub.helpers.resolveLocalId(data.query);
					if (local.type === 'user' && utils.isNumber(local.id)) {
						uids = [local.id];
					} else {
						const assertion = await activitypub.actors.assert([handle || data.query]);
						if (assertion === true) {
							uids = [handle ? await User.getUidByUserslug(handle) : query];
						} else if (Array.isArray(assertion) && assertion.length) {
							uids = assertion.map(u => u.id);
						}
					}
				}
			}

			if (!uids.length) {
				const searchMethod = data.findUids || findUids;
				uids = await searchMethod(query, searchBy, data.hardCap);

				const mapping = {
					username: 'ap.preferredUsername',
					fullname: 'ap.name',
				};
				if (meta.config.activitypubEnabled && mapping.hasOwnProperty(searchBy)) {
					uids = uids.concat(await searchMethod(query, mapping[searchBy], data.hardCap));
				}
			}
		}

		uids = await filterAndSortUids(uids, data);
		if (data.hardCap > 0) {
			uids.length = data.hardCap;
		}

		const result = await plugins.hooks.fire('filter:users.search', { uids: uids, uid: uid });
		uids = result.uids;

		const searchResult = {
			matchCount: uids.length,
		};

		if (paginate) {
			const resultsPerPage = data.resultsPerPage || meta.config.userSearchResultsPerPage;
			const start = Math.max(0, page - 1) * resultsPerPage;
			const stop = start + resultsPerPage;
			searchResult.pageCount = Math.ceil(uids.length / resultsPerPage);
			uids = uids.slice(start, stop);
		}

		const [userData, blocks] = await Promise.all([
			User.getUsers(uids, uid),
			User.blocks.list(uid),
		]);

		if (blocks.length) {
			userData.forEach((user) => {
				if (user) {
					user.isBlocked = blocks.includes(user.uid);
				}
			});
		}

		searchResult.timing = (process.elapsedTimeSince(startTime) / 1000).toFixed(2);
		searchResult.users = userData.filter(user => (user &&
			utils.isNumber(user.uid) ? user.uid > 0 : activitypub.helpers.isUri(user.uid)));
		return searchResult;
	};

	async function findUids(query, searchBy, hardCap) {
		if (!query) {
			return [];
		}
		query = String(query).toLowerCase();
		const min = query;
		const max = query.substr(0, query.length - 1) + String.fromCharCode(query.charCodeAt(query.length - 1) + 1);

		const resultsPerPage = meta.config.userSearchResultsPerPage;
		hardCap = hardCap || resultsPerPage * 10;

		const data = await db.getSortedSetRangeByLex(`${searchBy}:sorted`, min, max, 0, hardCap);
		const uids = data.map((data) => {
			if (data.includes(':https:')) {
				return data.substring(data.indexOf(':https:') + 1);
			}

			return data.split(':').pop();
		});
		return uids;
	}

	//helpers to reduce complexity
	//Used ChatGPT to name all my help functions
	function normalizeFilters(filters) {
		const list = filters || [];
		return Array.isArray(list) ? list : [list];
	}

	function collectFields(sortBy, filters) {
		const fields = [];
		if (sortBy) fields.push(sortBy);
		filters.forEach((f) => {
			if (filterFieldMap[f]) {
				fields.push(...filterFieldMap[f]);
			}
		});
		return fields;
	}

	async function applyGroupFilter(uids, groupName) {
		if (!groupName) return uids;
		const isMembers = await groups.isMembers(uids, groupName);
		return uids.filter((uid, i) => isMembers[i]);
	}

	async function maybeApplyBannedFilter(uids, filters) {
		const wantsBanned = filters.includes('banned') || filters.includes('notbanned');
		if (!wantsBanned) return uids;

		const isMembersOfBanned = await groups.isMembers(uids, groups.BANNED_USERS);
		const checkBanned = filters.includes('banned');
		return uids.filter((uid, i) => (checkBanned ? isMembersOfBanned[i] : !isMembersOfBanned[i]));
	}

	function applyFilterFns(userData, filters) {
		let result = userData;
		filters.forEach((f) => {
			if (filterFnMap[f]) {
				result = result.filter(filterFnMap[f]);
			}
		});
		return result;
	}

	// function with helper methods included
	async function filterAndSortUids(uids, data) {
		console.log('JORDAN BAIN');
		let filteredUids = uids.filter(uid => parseInt(uid, 10) || activitypub.helpers.isUri(uid));

		const filters = normalizeFilters(data.filters);
		const fields = collectFields(data.sortBy, filters);

		filteredUids = await applyGroupFilter(filteredUids, data.groupName);

		if (!fields.length) {
			return filteredUids;
		}

		filteredUids = await maybeApplyBannedFilter(filteredUids, filters);

		fields.push('uid');
		let userData = await User.getUsersFields(filteredUids, fields);

		userData = applyFilterFns(userData, filters);

		if (data.sortBy) {
			sortUsers(userData, data.sortBy, data.sortDirection);
		}

		return userData.map(user => user.uid);
	}

	function sortUsers(userData, sortBy, sortDirection) {
		if (!userData || !userData.length) {
			return;
		}
		sortDirection = sortDirection || 'desc';
		const direction = sortDirection === 'desc' ? 1 : -1;

		const isNumeric = utils.isNumber(userData[0][sortBy]);
		if (isNumeric) {
			userData.sort((u1, u2) => direction * (u2[sortBy] - u1[sortBy]));
		} else {
			userData.sort((u1, u2) => {
				if (u1[sortBy] < u2[sortBy]) {
					return direction * -1;
				} else if (u1[sortBy] > u2[sortBy]) {
					return direction * 1;
				}
				return 0;
			});
		}
	}

	async function searchByIP(ip) {
		const ipKeys = await db.scan({ match: `ip:${ip}*` });
		const uids = await db.getSortedSetRevRange(ipKeys, 0, -1);
		return _.uniq(uids);
	}
};
