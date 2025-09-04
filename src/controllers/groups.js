'use strict';

const validator = require('validator');
const nconf = require('nconf');

const meta = require('../meta');
const groups = require('../groups');
const user = require('../user');
const helpers = require('./helpers');
const pagination = require('../pagination');
const privileges = require('../privileges');

const groupsController = module.exports;

const url = nconf.get('url');

groupsController.list = async function (req, res) {
	const sort = req.query.sort || 'alpha';
	const page = parseInt(req.query.page, 10) || 1;
	const [allowGroupCreation, [groupData, pageCount]] = await Promise.all([
		privileges.global.can('group:create', req.uid),
		getGroups(req, sort, page),
	]);

	res.locals.linkTags = [
		{
			rel: 'canonical',
			href: `${url}${req.url.replace(/^\/api/, '')}`,
		},
	];

	res.render('groups/list', {
		groups: groupData,
		allowGroupCreation: allowGroupCreation,
		sort: validator.escape(String(sort)),
		pagination: pagination.create(page, pageCount, req.query),
		title: '[[pages:groups]]',
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]' }]),
	});
};

async function getGroups(req, sort, page) {
	const resultsPerPage = req.query.query ? 100 : 15;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	if (req.query.query) {
		const filterHidden = req.query.filterHidden === 'true' || !await user.isAdministrator(req.uid);
		const groupData = await groups.search(req.query.query, {
			sort,
			filterHidden: filterHidden,
			showMembers: req.query.showMembers === 'true',
			hideEphemeralGroups: req.query.hideEphemeralGroups === 'true',
			excludeGroups: Array.isArray(req.query.excludeGroups) ? req.query.excludeGroups : [],
		});
		const pageCount = Math.ceil(groupData.length / resultsPerPage);

		return [groupData.slice(start, stop + 1), pageCount];
	}

	const [groupData, groupCount] = await Promise.all([
		groups.getGroupsBySort(sort, start, stop),
		groups.getGroupCountBySort(sort),
	]);

	const pageCount = Math.ceil(groupCount / resultsPerPage);
	return [groupData, pageCount];
}

/**  
 The following functions were refactored with the assistance of Claude Sonnet 4 on Cursor:
	* validateSlugAndRedirect
	* validateGroupAccess
	* fetchGroupDetailsData
	* renderGroupDetails
	* groupsController.details
*/

async function validateSlugAndRedirect(req, res) {
	const lowercaseSlug = req.params.slug.toLowerCase();
	if (req.params.slug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.slug = lowercaseSlug;
		} else {
			res.redirect(`${nconf.get('relative_path')}/groups/${lowercaseSlug}`);
			return false; // Indicates redirect happened
		}
	}
	return true; // Continue processing
}

async function validateGroupAccess(req, groupName) {
	const [exists, isHidden, isAdmin, isGlobalMod] = await Promise.all([
		groups.exists(groupName),
		groups.isHidden(groupName),
		privileges.admin.can('admin:groups', req.uid),
		user.isGlobalModerator(req.uid),
	]);

	if (!exists) {
		return { hasAccess: false };
	}

	if (isHidden && !isAdmin && !isGlobalMod) {
		const [isMember, isInvited] = await Promise.all([
			groups.isMember(req.uid, groupName),
			groups.isInvited(req.uid, groupName),
		]);
		
		if (!isMember && !isInvited) {
			return { hasAccess: false };
		}
	}

	return { hasAccess: true, isAdmin, isGlobalMod };
}

async function fetchGroupDetailsData(req, groupName) {
	const [groupData, posts] = await Promise.all([
		groups.get(groupName, {
			uid: req.uid,
			truncateUserList: true,
			userListCount: 20,
		}),
		groups.getLatestMemberPosts(groupName, 10, req.uid),
	]);

	return { groupData, posts };
}

function renderGroupDetails(res, options) {
	const { groupData, posts, isAdmin, isGlobalMod, lowercaseSlug } = options;
	
	res.locals.linkTags = [
		{
			rel: 'canonical',
			href: `${url}/groups/${lowercaseSlug}`,
		},
	];

	res.render('groups/details', {
		title: `[[pages:group, ${groupData.displayName}]]`,
		group: groupData,
		posts: posts,
		isAdmin: isAdmin,
		isGlobalMod: isGlobalMod,
		allowPrivateGroups: meta.config.allowPrivateGroups,
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]', url: '/groups' }, { text: groupData.displayName }]),
	});
}

groupsController.details = async function (req, res, next) {
	// Handle slug validation and potential redirect
	const validation = await validateSlugAndRedirect(req, res);
	if (!validation) {
		return; // Redirect happened
	}

	// Get group name from slug
	const groupName = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!groupName) {
		return next();
	}

	// Validate group access permissions
	const { hasAccess, isAdmin, isGlobalMod } = await validateGroupAccess(req, groupName);
	if (!hasAccess) {
		return next();
	}

	// Fetch group data and posts
	const { groupData, posts } = await fetchGroupDetailsData(req, groupName);
	if (!groupData) {
		return next();
	}

	// Render the response
	const lowercaseSlug = req.params.slug.toLowerCase();
	renderGroupDetails(res, { groupData, posts, isAdmin, isGlobalMod, lowercaseSlug });
};

groupsController.members = async function (req, res, next) {
	const page = parseInt(req.query.page, 10) || 1;
	const usersPerPage = 50;
	const start = Math.max(0, (page - 1) * usersPerPage);
	const stop = start + usersPerPage - 1;
	const groupName = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!groupName) {
		return next();
	}
	const [groupData, isAdminOrGlobalMod, isMember, isHidden] = await Promise.all([
		groups.getGroupData(groupName),
		user.isAdminOrGlobalMod(req.uid),
		groups.isMember(req.uid, groupName),
		groups.isHidden(groupName),
	]);

	if (isHidden && !isMember && !isAdminOrGlobalMod) {
		return next();
	}
	const users = await user.getUsersFromSet(`group:${groupName}:members`, req.uid, start, stop);

	const breadcrumbs = helpers.buildBreadcrumbs([
		{ text: '[[pages:groups]]', url: '/groups' },
		{ text: validator.escape(String(groupName)), url: `/groups/${req.params.slug}` },
		{ text: '[[groups:details.members]]' },
	]);

	const pageCount = Math.max(1, Math.ceil(groupData.memberCount / usersPerPage));
	res.render('groups/members', {
		users: users,
		pagination: pagination.create(page, pageCount, req.query),
		breadcrumbs: breadcrumbs,
	});
};
