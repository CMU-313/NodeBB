'use strict';

const validator = require('validator');
const meta = require('../meta');
const db = require('../database');
const activitypub = require('../activitypub');
const plugins = require('../plugins');
const notifications = require('../notifications');
const languages = require('../languages');


const spiderDefaultSettings = {
	usePagination: 1,
	topicPostSort: 'oldest_to_newest',
	postsPerPage: 20,
	topicsPerPage: 20,
};
const remoteDefaultSettings = Object.freeze({ categoryWatchState: 'notwatching' });


module.exports = function attachUserSettings(User) {
	User.getSettings = getSettings;
	User.getMultipleUserSettings = getMultipleUserSettings;
	User.saveSettings = async (uid, data) => {
		await saveSettings(uid, data);
		return getSettings(uid);
	};
	User.updateDigestSetting = updateDigestSetting;
	User.setSetting = setSetting;
};


async function getSettings(uid) {
	if (parseInt(uid, 10) <= 0) {
		const isSpider = parseInt(uid, 10) === -1;
		return onSettingsLoaded(uid, isSpider ? spiderDefaultSettings : {});
	}

	let settings = await db.getObject(`user:${uid}:settings`);
	settings = settings || {};
	settings.uid = uid;
	return onSettingsLoaded(uid, settings);
}


async function getMultipleUserSettings(uids) {
	if (!Array.isArray(uids) || !uids.length) return [];


	const keys = uids.map(uid => `user:${uid}:settings`);
	let settings = await db.getObjects(keys);


	settings = settings.map((userSettings, index) => {
		userSettings = userSettings || {};
		userSettings.uid = uids[index];
		return userSettings;
	});
	return Promise.all(settings.map(s => onSettingsLoaded(s.uid, s)));
}


async function onSettingsLoaded(uid, settings) {
	const data = await plugins.hooks.fire('filter:user.getSettings', { uid, settings });
	settings = data.settings;


	const defaultTopicsPerPage = meta.config.topicsPerPage;
	const defaultPostsPerPage = meta.config.postsPerPage;


	settings.showemail = +getSetting(settings, 'showemail', 0) === 1;
	settings.showfullname = +getSetting(settings, 'showfullname', 0) === 1;
	settings.openOutgoingLinksInNewTab = +getSetting(settings, 'openOutgoingLinksInNewTab', 0) === 1;
	settings.dailyDigestFreq = getSetting(settings, 'dailyDigestFreq', 'off');
	settings.usePagination = +getSetting(settings, 'usePagination', 0) === 1;


	settings.topicsPerPage = Math.min(
		meta.config.maxTopicsPerPage,
		settings.topicsPerPage ? parseInt(settings.topicsPerPage, 10) : defaultTopicsPerPage,
		defaultTopicsPerPage
	);
	settings.postsPerPage = Math.min(
		meta.config.maxPostsPerPage,
		settings.postsPerPage ? parseInt(settings.postsPerPage, 10) : defaultPostsPerPage,
		defaultPostsPerPage
	);


	settings.userLang = settings.userLang || meta.config.defaultLang || 'en-GB';
	settings.acpLang = settings.acpLang || settings.userLang;
	settings.topicPostSort = getSetting(settings, 'topicPostSort', 'oldest_to_newest');
	settings.categoryTopicSort = getSetting(settings, 'categoryTopicSort', 'recently_replied');
	settings.followTopicsOnCreate = +getSetting(settings, 'followTopicsOnCreate', 1) === 1;
	settings.followTopicsOnReply = +getSetting(settings, 'followTopicsOnReply', 0) === 1;
	settings.upvoteNotifFreq = getSetting(settings, 'upvoteNotifFreq', 'all');
	settings.disableIncomingChats = +getSetting(settings, 'disableIncomingChats', 0) === 1;
	settings.topicSearchEnabled = +getSetting(settings, 'topicSearchEnabled', 0) === 1;
	settings.updateUrlWithPostIndex = +getSetting(settings, 'updateUrlWithPostIndex', 1) === 1;
	settings.bootswatchSkin = validator.escape(String(settings.bootswatchSkin || ''));
	settings.homePageRoute = validator.escape(String(settings.homePageRoute || '')).replace(/&#x2F;/g, '/');
	settings.scrollToMyPost = +getSetting(settings, 'scrollToMyPost', 1) === 1;
	settings.categoryWatchState = getSetting(settings, 'categoryWatchState', 'notwatching');


	const notificationTypes = await notifications.getAllNotificationTypes();
	notificationTypes.forEach((type) => {
		settings[type] = getSetting(settings, type, 'notification');
	});


	settings.chatAllowList = parseJSONSetting(settings.chatAllowList || '[]', []).map(String);
	settings.chatDenyList = parseJSONSetting(settings.chatDenyList || '[]', []).map(String);
	return settings;
}


function parseJSONSetting(value, defVal) {
	try {
		return JSON.parse(value);
	} catch {
		return defVal;
	}
}


function getSetting(settings, key, defVal) {
	if (settings[key] || settings[key] === 0) return settings[key];
	if (activitypub.helpers.isUri(settings.uid) && remoteDefaultSettings[key]) {
		return remoteDefaultSettings[key];
	}
	if (meta.config[key] || meta.config[key] === 0) return meta.config[key];
	return defVal;
}


async function saveSettings(uid, data) {
	const maxPostsPerPage = meta.config.maxPostsPerPage || 20;
	if (!data.postsPerPage || +data.postsPerPage <= 1 || +data.postsPerPage > maxPostsPerPage) {
		throw new Error(`[[error:invalid-pagination-value, 2, ${maxPostsPerPage}]]`);
	}


	const maxTopicsPerPage = meta.config.maxTopicsPerPage || 20;
	if (!data.topicsPerPage || +data.topicsPerPage <= 1 || +data.topicsPerPage > maxTopicsPerPage) {
		throw new Error(`[[error:invalid-pagination-value, 2, ${maxTopicsPerPage}]]`);
	}

	const languageCodes = await languages.listCodes();
	if (data.userLang && !languageCodes.includes(data.userLang)) {
		throw new Error('[[error:invalid-language]]');
	}
	if (data.acpLang && !languageCodes.includes(data.acpLang)) {
		throw new Error('[[error:invalid-language]]');
	}


	data.userLang = data.userLang || meta.config.defaultLang;
	plugins.hooks.fire('action:user.saveSettings', { uid, settings: data });


	const settings = {
		showemail: data.showemail,
		showfullname: data.showfullname,
		openOutgoingLinksInNewTab: data.openOutgoingLinksInNewTab,
		dailyDigestFreq: data.dailyDigestFreq || 'off',
		usePagination: data.usePagination,
		topicsPerPage: Math.min(data.topicsPerPage, parseInt(maxTopicsPerPage, 10) || 20),
		postsPerPage: Math.min(data.postsPerPage, parseInt(maxPostsPerPage, 10) || 20),
		userLang: data.userLang || meta.config.defaultLang,
		acpLang: data.acpLang || meta.config.defaultLang,
		followTopicsOnCreate: data.followTopicsOnCreate,
		followTopicsOnReply: data.followTopicsOnReply,
		disableIncomingChats: data.disableIncomingChats,
		topicSearchEnabled: data.topicSearchEnabled,
		updateUrlWithPostIndex: data.updateUrlWithPostIndex,
		homePageRoute: ((data.homePageRoute === 'custom' ? data.homePageCustom : data.homePageRoute) || '').replace(/^\//, ''),
		scrollToMyPost: data.scrollToMyPost,
		upvoteNotifFreq: data.upvoteNotifFreq,
		bootswatchSkin: data.bootswatchSkin,
		categoryWatchState: data.categoryWatchState,
		categoryTopicSort: data.categoryTopicSort,
		topicPostSort: data.topicPostSort,
		chatAllowList: data.chatAllowList,
		chatDenyList: data.chatDenyList,
	};


	const types = await notifications.getAllNotificationTypes();
	types.forEach((t) => {
		if (data[t]) settings[t] = data[t];
	});


	const result = await plugins.hooks.fire('filter:user.saveSettings', { uid, settings, data });
	await db.setObject(`user:${uid}:settings`, result.settings);
	await updateDigestSetting(uid, data.dailyDigestFreq);
	return result.settings;
}
async function updateDigestSetting(uid, dailyDigestFreq) {
	await db.sortedSetsRemove(['digest:day:uids', 'digest:week:uids', 'digest:month:uids'], uid);
	if (['day', 'week', 'biweek', 'month'].includes(dailyDigestFreq)) {
		await db.sortedSetAdd(`digest:${dailyDigestFreq}:uids`, Date.now(), uid);
	}
}

async function setSetting(uid, key, value) {
	if (parseInt(uid, 10) <= 0) return;
	await db.setObjectField(`user:${uid}:settings`, key, value);
}