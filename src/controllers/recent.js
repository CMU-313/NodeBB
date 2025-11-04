'use strict';

const nconf = require('nconf');

const user = require('../user');
const topics = require('../topics');
const meta = require('../meta');
const helpers = require('./helpers');
const pagination = require('../pagination');
const privileges = require('../privileges');

const recentController = module.exports;
const relative_path = nconf.get('relative_path');

recentController.get = async function (req, res, next) {
	const data = await recentController.getData(req, 'recent', 'recent');
	if (!data) {
		return next();
	}
	res.render('recent', data);
};

async function getUserContext(req, cid, tag) {
	return Promise.all([
		user.getSettings(req.uid),
		helpers.getSelectedCategory(cid),
		helpers.getSelectedTag(tag),
		user.auth.getFeedToken(req.uid),
		privileges.categories.canPostTopic(req.uid),
		user.isPrivileged(req.uid),
	]);
}

function buildTopicQuery({ settings, req, cid, tag, filter, term, sort }) {
	const page = parseInt(req.query.page, 10) || 1;
	const start = Math.max(0, (page - 1) * settings.topicsPerPage);
	const stop = start + settings.topicsPerPage - 1;
	return {
		cids: cid,
		tags: tag,
		uid: req.uid,
		start,
		stop,
		filter,
		term,
		sort,
		floatPinned: req.query.pinned,
		query: req.query,
	};
}

function buildPageMeta(req, url, data) {
	const isDisplayedAsHome = !(req.originalUrl.startsWith(`${relative_path}/api/${url}`) || req.originalUrl.startsWith(`${relative_path}/${url}`));
	if (isDisplayedAsHome) {
		data.title = meta.config.homePageTitle || '[[pages:home]]';
		return '';
	}
	data.title = `[[pages:${url}]]`;
	data.breadcrumbs = helpers.buildBreadcrumbs([{ text: `[[${url}:title]]` }]);
	return url;
}

function sanitizeTerm(rawTermKey) {
	const resolved = helpers.terms[rawTermKey];
	if (!resolved && rawTermKey) {
		return { invalid: true };
	}
	return { term: resolved || 'alltime' };
}

function applyPermissions(data, ctx) {
	data.canPost = ctx.canPost;
	data.showSelect = ctx.isPrivileged;
	data.showTopicTools = ctx.isPrivileged;
}

function applyRss(data, ctx) {
	data['feeds:disableRSS'] = meta.config['feeds:disableRSS'] || 0;
	if (meta.config['feeds:disableRSS']) {
		return;
	}
	data.rssFeedUrl = `${relative_path}/${ctx.url}.rss`;
	if (ctx.req.loggedIn) {
		data.rssFeedUrl += `?uid=${ctx.req.uid}&token=${ctx.rssToken}`;
	}
}

function applyFiltersAndTerms(data, ctx) {
	data.filters = helpers.buildFilters(ctx.baseUrl, ctx.filter, ctx.query);
	data.selectedFilter = data.filters.find(f => f && f.selected);
	data.terms = helpers.buildTerms(ctx.baseUrl, ctx.term, ctx.query);
	data.selectedTerm = data.terms.find(t => t && t.selected);
}

function applyPagination(data, ctx) {
	const page = parseInt(ctx.req.query.page, 10) || 1;
	const pageCount = Math.max(1, Math.ceil(data.topicCount / ctx.settings.topicsPerPage));
	data.pagination = pagination.create(page, pageCount, ctx.req.query);
	helpers.addLinkTags({
		url: ctx.url,
		res: ctx.req.res,
		tags: data.pagination.rel,
		page,
	});
}

recentController.getData = async function (req, url, sort) {
	const { cid, tag } = req.query;
	const filter = req.query.filter || '';
	const { invalid, term } = sanitizeTerm(req.query.term);
	if (invalid) {
		return null;
	}

	const [
		settings, categoryData, tagData, rssToken, canPost, isPrivileged,
	] = await getUserContext(req, cid, tag);

	const topicQuery = buildTopicQuery({
		settings,
		req,
		cid,
		tag,
		filter,
		term,
		sort,
	});
	const data = await topics.getSortedTopics(topicQuery);

	const baseUrl = buildPageMeta(req, url, data);

	const query = { ...req.query };
	delete query.page;

	const ctx = {
		req,
		url,
		filter,
		term,
		query,
		baseUrl,
		rssToken,
		settings,
		canPost,
		isPrivileged,
	};

	applyPermissions(data, ctx);

	data.allCategoriesUrl = baseUrl + helpers.buildQueryString(query, 'cid', '');
	data.selectedCategory = categoryData.selectedCategory;
	data.selectedCids = categoryData.selectedCids;
	data.selectedTag = tagData.selectedTag;
	data.selectedTags = tagData.selectedTags;

	applyRss(data, ctx);
	applyFiltersAndTerms(data, ctx);
	applyPagination(data, ctx);

	return data;
};

require('../promisify')(recentController, ['get']);