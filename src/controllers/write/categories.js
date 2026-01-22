'use strict';

const categories = require('../../categories');
const meta = require('../../meta');
const activitypub = require('../../activitypub');
const api = require('../../api');

const helpers = require('../helpers');

const Categories = module.exports;

Categories.list = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.categories.list(req));
};

Categories.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.categories.get(req, req.params));
};

Categories.create = async (req, res) => {
	const response = await api.categories.create(req, req.body);
	helpers.formatApiResponse(200, res, response);
};

Categories.update = async (req, res) => {
	await api.categories.update(req, {
		cid: req.params.cid,
		values: req.body,
	});

	const categoryObjs = await categories.getCategories([req.params.cid]);
	helpers.formatApiResponse(200, res, categoryObjs[0]);
};

Categories.delete = async (req, res) => {
	await api.categories.delete(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res);
};

Categories.getTopicCount = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.categories.getTopicCount(req, { ...req.params }));
};

Categories.getPosts = async (req, res) => {
	const posts = await api.categories.getPosts(req, { ...req.params });
	helpers.formatApiResponse(200, res, { posts });
};

Categories.getChildren = async (req, res) => {
	const { cid } = req.params;
	const { start } = req.query;
	helpers.formatApiResponse(200, res, await api.categories.getChildren(req, { cid, start }));
};

Categories.getTopics = async (req, res) => {
	const { cid } = req.params;
	const result = await api.categories.getTopics(req, { ...req.query, cid });

	helpers.formatApiResponse(200, res, result);
};

Categories.setWatchState = async (req, res) => {
	const { cid } = req.params;
	let { uid, state } = req.body;

	if (req.method === 'DELETE') {
		// DELETE is always setting state to system default in acp
		state = categories.watchStates[meta.config.categoryWatchState];
	} else if (Object.keys(categories.watchStates).includes(state)) {
		state = categories.watchStates[state]; // convert to integer for backend processing
	} else {
		throw new Error('[[error:invalid-data]]');
	}

	const { cids: modified } = await api.categories.setWatchState(req, { cid, state, uid });

	helpers.formatApiResponse(200, res, { modified });
};

Categories.getPrivileges = async (req, res) => {
	const privilegeSet = await api.categories.getPrivileges(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res, privilegeSet);
};

Categories.setPrivilege = async (req, res) => {
	const { cid, privilege } = req.params;

	await api.categories.setPrivilege(req, {
		cid,
		privilege,
		member: req.body.member,
		set: req.method === 'PUT',
	});

	const privilegeSet = await api.categories.getPrivileges(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res, privilegeSet);
};

Categories.setModerator = async (req, res) => {
	await api.categories.setModerator(req, {
		cid: req.params.cid,
		member: req.params.uid,
		set: req.method === 'PUT',
	});

	const privilegeSet = await api.categories.getPrivileges(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res, privilegeSet);
};
const helper = (req) => {
	// 1. Try to get actor from the logged-in session (req.uid) first (Security Best Practice).
	// 2. Fallback to req.body.actor (for your tests or specific API calls).
	console.log('Oliver Graham'); 
	const actor = req.uid || req.body.actor;

	const id = parseInt(req.params.cid, 10);

	// Check if ID is invalid OR if we failed to find an actor
	if (!id || !actor) {
		return false;
	}

	return { id, actor };
};

Categories.follow = async (req, res, next) => {
	const data = helper(req);

	if (data === false) {
		return next();
	} 
	// console.log('Oliver Graham'); 

	// data.actor is now guaranteed to be defined
	await activitypub.out.follow('cid', data.id, data.actor);

	helpers.formatApiResponse(200, res, {});
    
};

Categories.unfollow = async (req, res, next) => {
	const data = helper(req);

	if (data === false) {
		return next();
	} 
	// console.log('Oliver Graham');

	await activitypub.out.undo.follow('cid', data.id, data.actor);

	helpers.formatApiResponse(200, res, {});
    
};
