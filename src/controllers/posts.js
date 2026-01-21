'use strict';

const nconf = require('nconf');
const querystring = require('querystring');

const meta = require('../meta');
const posts = require('../posts');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const utils = require('../utils');

const helpers = require('./helpers');

const postsController = module.exports;

postsController.redirectToPost = async function (req, res, next) {
	const pid = parsePid(req.params.pid);
	if (!pid) {
		return next();
	}

	await maybeAssertNote(req, pid);

	const { canRead, path } = await getAccessAndPath(req, pid);
	if (!path) {
		return next();
	}
	if (!canRead) {
		return helpers.notAllowed(req, res);
	}

	addLinkHeader(res, req.params.pid);
	redirectWithQuery(res, req.query, path);
};

function parsePid(rawPid) {
	if (!rawPid) {
		return null;
	}
	return utils.isNumber(rawPid) ? parseInt(rawPid, 10) : rawPid;
}

function shouldAssertNote(req, pid) {
	return !utils.isNumber(pid) && req.uid && meta.config.activitypubEnabled;
}

async function maybeAssertNote(req, pid) {
	if (!shouldAssertNote(req, pid)) {
		return;
	}

	const exists = await posts.exists(pid);
	if (!exists) {
		await activitypub.notes.assert(req.uid, pid);
	}
}

async function getAccessAndPath(req, pid) {
	const [canRead, path] = await Promise.all([
		privileges.posts.can('topics:read', pid, req.uid),
		posts.generatePostPath(pid, req.uid),
	]);
	return { canRead, path };
}

function addLinkHeader(res, rawPid) {
	if (!meta.config.activitypubEnabled) {
		return;
	}
	res.set('Link', `<${nconf.get('url')}/post/${rawPid}>; rel="alternate"; type="application/activity+json"`);
}

function redirectWithQuery(res, query, path) {
	const qs = querystring.stringify(query);
	helpers.redirect(res, qs ? `${path}?${qs}` : path, true);
}


postsController.getRecentPosts = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;
	const start = Math.max(0, (page - 1) * postsPerPage);
	const stop = start + postsPerPage - 1;
	const data = await posts.getRecentPosts(req.uid, start, stop, req.params.term);
	res.json(data);
};
