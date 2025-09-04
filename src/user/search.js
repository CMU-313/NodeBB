
'use strict';

const _ = require('lodash');

const meta = require('../meta');
const plugins = require('../plugins');
const db = require('../database');
const groups = require('../groups');
const activitypub = require('../activitypub');
const utils = require('../utils');

const apMapping = {
	username: 'ap.preferredUsername',
	fullname: 'ap.name',
};

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

		let uids = await resolveUidsFromSearchBy({ query, searchBy, data, User });

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
			const {slice, pageCount} = applyPagniation(uids, page, resultsPerPage);
			searchResult.pageCount = pageCount;
			uids = slice;
		}

		const [userData, blocks] = await Promise.all([
			User.getUsers(uids, uid),
			User.blocks.list(uid),
		]);
		attachBlockFlags(userData, blocks);

		searchResult.timing = (process.elapsedTimeSince(startTime) / 1000).toFixed(2);
		searchResult.users = userData.filter(user => (user &&
			utils.isNumber(user.uid) ? user.uid > 0 : activitypub.helpers.isUri(user.uid)));
		return searchResult;
	};

	async function resolveUidsFromSearchBy({ query, searchBy, data, User }) {
		if (searchBy === 'ip') {
			return searchByIP(query);
		}
		if (searchBy === 'uid') {
			return [query];
		}

		let uids = [];
		if (!data.findUids && data.uid) {
			uids = await resolveActivityPubCandidates({ query: data.query, User});
			if (uids.length) return uids;
		}

		return runSearchMethodWithApFallback({ query, searchBy, data });
	}

	async function resolveActivityPubCandidates({ query, User}) {
		const handle = activitypub.helpers.isWebfinger(query);
		const isUri = activitypub.helpers.isUri(query);

		if (!handle && !isUri) return [];

		const local = await activitypub.helpers.resolveLocalId(query);
		if (local.type === 'user' && utils.isNumber(local.id)) {
			return [local.id];
		}

		const assertion = await activitypub.actors.assert([handle || query]);
		if (assertion === true) {
			const uid = handle ? await User.getUidByUserslug(handle) : query;
			return [uid];
		}
		if (Array.isArray(assertion) && assertion.length) {
			return assertion.map(u => u.id);
		}
		return [];
	}

	async function runSearchMethodWithApFallback({ query, searchBy, data}) {
		const searchMethod = data.findUids || findUids;
		let uids = await searchMethod(query, searchBy, data.hardCap);

		if (meta.config.activitypubEnabled && Object.prototype.hasOwnProperty.call(apMapping, searchBy)) {
			const apField = apMapping[searchBy];
			const apUids = await searchMethod(query, apField, data.hardCap);
			uids = uids.concat(apUids);
		}
		return uids;
	}

	function applyPagniation(uids, page, resultsPerPage) {
		const start = Math.max(0, page - 1) * resultsPerPage;
		const stop = start + resultsPerPage;
		return {
			slice: uids.slice(start, stop),
			pageCount: Math.ceil(uids.length / resultsPerPage),
		};
	}

	function attachBlockFlags(userData, blocks) {
		if (!blocks || !blocks.length || !userData) return;
		userData.forEach((user) => {
			if (user) user.isBlocked = blocks.includes(user.uid);
		});
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
