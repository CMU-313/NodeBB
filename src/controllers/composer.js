'use strict';

const nconf = require('nconf');

const user = require('../user');
const plugins = require('../plugins');
const topics = require('../topics');
const posts = require('../posts');
const helpers = require('./helpers');

exports.get = async function (req, res, callback) {
	res.locals.metaTags = {
		...res.locals.metaTags,
		name: 'robots',
		content: 'noindex',
	};

	const data = await plugins.hooks.fire('filter:composer.build', {
		req: req,
		res: res,
		next: callback,
		templateData: {},
	});

	if (res.headersSent) {
		return;
	}
	if (!data || !data.templateData) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (data.templateData.disabled) {
		res.render('', {
			title: '[[modules:composer.compose]]',
		});
	} else {
		data.templateData.title = '[[modules:composer.compose]]';
		res.render('compose', data.templateData);
	}
};

// Helpers to reduce complexity
// Used ChatGPT to name all the helpers
//Split into 7 helpers

function invalidDataError() {
	return new Error('[[error:invalid-data]]');
}

function buildBaseData(req, body) {
	const base = {
		uid: req.uid,
		req: req,
		timestamp: Date.now(),
		content: body.content,
		handle: body.handle,
		fromQueue: false,
	};
	
	req.body.noscript = 'true';
	return base;
}

function ensureContent(data) {
	if (!data.content) {
		throw invalidDataError();
	}
}

function decideAction(body) {
	if (body.tid) {
		return 'reply';
	}
	if (body.cid) {
		return 'topic';
	}
	throw invalidDataError();
}

function enrichForAction(data, body, action) {
	if (action === 'reply') {
		data.tid = body.tid;
		return;
	}
	
	data.cid = body.cid;
	data.title = body.title;
	data.tags = [];
	data.thumb = '';
}

async function queueOrPost(uid, postFn, data) {
	const shouldQueue = await posts.shouldQueue(uid, data);
	if (shouldQueue) {
		delete data.req;
		return posts.addToQueue(data);
	}
	return postFn(data);
}

async function performPost(action, uid, data) {
	const map = {
		reply: topics.reply,
		topic: topics.post,
	};
	const postFn = map[action];
	return queueOrPost(uid, postFn, data);
}

//Used help of CoPilot/ChatGPT for body of conditionals
function computeRedirectPath(result) {
	let path = nconf.get('relative_path');
	if (result.pid) {
		path += `/post/${result.pid}`;
	} else if (result.topicData) {
		path += `/topic/${result.topicData.slug}`;
	}
	return path;
}

exports.post = async function (req, res) {
	try {
		const { body } = req;

		const data = buildBaseData(req, body);
		ensureContent(data);

		const action = decideAction(body);
		enrichForAction(data, body, action);

		const result = await performPost(action, req.uid, data);
		if (!result) {
			throw invalidDataError();
		}

		if (result.queued) {
			return res.redirect(`${nconf.get('relative_path') || '/'}?noScriptMessage=[[success:post-queued]]`);
		}

		
		user.updateOnlineUsers(req.uid);
		const path = computeRedirectPath(result);
		return res.redirect(path);
	} catch (err) {
		return helpers.noScriptErrors(req, res, err.message, 400);
	}
};
