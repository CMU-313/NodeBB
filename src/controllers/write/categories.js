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
    const { actor } = req.body;
    const id = parseInt(req.params.cid, 10);

    if (!id) {
        return false;
    }
    return { id, actor };
};

Categories.follow = async (req, res, next) => {
    // 1. Get data from helper
    const data = helper(req);

    // 2. Check if data is strictly false
    if (data === false) {
        return next();
    } else {
        console.log('Oliver Graham');

        // 3. Pass data.id and req.uid (fallback for safety)
 		await activitypub.out.follow('cid', data.id, data.actor);

        helpers.formatApiResponse(200, res, {});
    }
};

Categories.unfollow = async (req, res, next) => {
    const data = helper(req);

    if (data === false) {
        return next();
    } else {
        console.log('Oliver Graham');

		await activitypub.out.undo.follow('cid', data.id, data.actor);

        helpers.formatApiResponse(200, res, {});
    }
};