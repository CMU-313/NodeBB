
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
		const searchParams = normalizeSearchParams(data);
		const startTime = process.hrtime();

		const normalizedData = { ...data, ...searchParams };

		let uids = await performInitialSearch(searchParams, normalizedData);
		uids = await processSearchResults(uids, normalizedData);
		
		const searchResult = await buildSearchResult(uids, searchParams, startTime);
		return searchResult;
	};

	function normalizeSearchParams(data) {
		return {
			query: data.query || '',
			searchBy: data.searchBy || 'username',
			page: data.page || 1,
			uid: data.uid || 0,
			paginate: data.hasOwnProperty('paginate') ? data.paginate : true,
		};
	}

	async function performInitialSearch(searchParams, data) {
		const { query, searchBy } = searchParams;

		if (searchBy === 'ip') {
			return await searchByIP(query);
		}
		
		if (searchBy === 'uid') {
			return [query];
		}
		
		return await searchByActivityPub(data, query);
	}

	async function processSearchResults(uids, data) {
		if (uids.length === 0) {
			uids = await performFallbackSearch(data);
		}

		uids = await filterAndSortUids(uids, data);
		
		if (data.hardCap > 0) {
			uids.length = data.hardCap;
		}

		const result = await plugins.hooks.fire('filter:users.search', { uids: uids, uid: data.uid || 0 });
		return result.uids;
	}

	async function performFallbackSearch(data) {
		const searchMethod = data.findUids || findUids;
		let uids = await searchMethod(data.query, data.searchBy, data.hardCap);

		const mapping = {
			username: 'ap.preferredUsername',
			fullname: 'ap.name',
		};
		
		if (meta.config.activitypubEnabled && mapping.hasOwnProperty(data.searchBy)) {
			const additionalUids = await searchMethod(data.query, mapping[data.searchBy], data.hardCap);
			uids = uids.concat(additionalUids);
		}

		return uids;
	}

	async function buildSearchResult(uids, searchParams, startTime) {
		const { uid, paginate } = searchParams;
		
		const paginatedUids = paginate ? applyPagination(uids, searchParams) : uids;
		const [userData, blocks] = await Promise.all([
			User.getUsers(paginatedUids, uid),
			User.blocks.list(uid),
		]);

		const processedUserData = applyBlockStatus(userData, blocks);
		
		return {
			matchCount: uids.length,
			...(paginate && { pageCount: Math.ceil(uids.length / getResultsPerPage(searchParams)) }),
			timing: (process.elapsedTimeSince(startTime) / 1000).toFixed(2),
			users: filterValidUsers(processedUserData),
		};
	}

	function applyPagination(uids, searchParams) {
		const { page } = searchParams;
		const resultsPerPage = getResultsPerPage(searchParams);
		const start = Math.max(0, page - 1) * resultsPerPage;
		const stop = start + resultsPerPage;
		return uids.slice(start, stop);
	}

	function getResultsPerPage(searchParams) {
		return searchParams.resultsPerPage || meta.config.userSearchResultsPerPage;
	}

	function applyBlockStatus(userData, blocks) {
		if (blocks.length === 0) {
			return userData;
		}

		userData.forEach((user) => {
			if (user) {
				user.isBlocked = blocks.includes(user.uid);
			}
		});

		return userData;
	}

	function filterValidUsers(userData) {
		return userData.filter(user => (user &&
			utils.isNumber(user.uid) ? user.uid > 0 : activitypub.helpers.isUri(user.uid)));
	}

	async function searchByActivityPub(data, query) {
		let result = [];

		// Check prereqs for ActivityPub search
		const canSearchActivityPub = !data.findUids && data.uid;
		if (!canSearchActivityPub) {
			return result;
		}

		const handle = activitypub.helpers.isWebfinger(data.query);
		const isWebfingerOrUri = handle || activitypub.helpers.isUri(data.query);
		
		if (isWebfingerOrUri) {
			result = await resolveActivityPubUser({ queryStr: data.query, handle, originalQuery: query });
		}

		return result;
	}

	async function resolveActivityPubUser(params) {
		const { queryStr, handle, originalQuery } = params;
		
		// Try to resolve as local ID first
		const local = await activitypub.helpers.resolveLocalId(queryStr);
		if (local.type === 'user' && utils.isNumber(local.id)) {
			return [local.id];
		}

		// Fall back to ActivityPub actor assertion
		const assertion = await activitypub.actors.assert([handle || queryStr]);
		
		// Process the assertion inline to avoid too many params
		if (assertion === true) {
			const uid = handle ? await User.getUidByUserslug(handle) : originalQuery;
			return [uid];
		}
		
		if (Array.isArray(assertion) && assertion.length) {
			const uids = assertion.map(u => u.id);
			return uids;
		}

		return [];
	}

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
		// const uids = data.map(data => data.split(':').pop());
		const uids = data.map((data) => {
			if (data.includes(':https:')) {
				return data.substring(data.indexOf(':https:') + 1);
			}

			return data.split(':').pop();
		});
		return uids;
	}

	async function filterAndSortUids(uids, data) {
		uids = uids.filter(uid => parseInt(uid, 10) || activitypub.helpers.isUri(uid));
		let filters = data.filters || [];
		filters = Array.isArray(filters) ? filters : [data.filters];
		const fields = [];

		if (data.sortBy) {
			fields.push(data.sortBy);
		}

		filters.forEach((filter) => {
			if (filterFieldMap[filter]) {
				fields.push(...filterFieldMap[filter]);
			}
		});

		if (data.groupName) {
			const isMembers = await groups.isMembers(uids, data.groupName);
			uids = uids.filter((uid, index) => isMembers[index]);
		}

		if (!fields.length) {
			return uids;
		}

		if (filters.includes('banned') || filters.includes('notbanned')) {
			const isMembersOfBanned = await groups.isMembers(uids, groups.BANNED_USERS);
			const checkBanned = filters.includes('banned');
			uids = uids.filter((uid, index) => (checkBanned ? isMembersOfBanned[index] : !isMembersOfBanned[index]));
		}

		fields.push('uid');
		let userData = await User.getUsersFields(uids, fields);

		filters.forEach((filter) => {
			if (filterFnMap[filter]) {
				userData = userData.filter(filterFnMap[filter]);
			}
		});

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
