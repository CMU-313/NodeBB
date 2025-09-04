'use strict';


const nconf = require('nconf');
const meta = require('./meta');

const relative_path = nconf.get('relative_path');

const coverPhoto = module.exports;

coverPhoto.getDefaultGroupCover = function (groupName) {
	return getCover('groups', groupName);
};

coverPhoto.getDefaultProfileCover = function (uid) {
	return getCover('profile', parseInt(uid, 10));
};


function getCover(type, id) {
	const defaultCover = `${relative_path}/assets/images/cover-default.png`;
	const config = meta.config[`${type}:defaultCovers`];
	if (!config) {
		return defaultCover;
	}
	const covers = String(config).trim().split(/[\s,]+/g);
	if (!covers.length) {
		return defaultCover;
	}
	const index = normalizeID(id, covers.length);
	return buildCoverURL(covers[index], defaultCover);
};

function normalizeID(id, length) {
	if (typeof id === 'string') {
		return (id.charCodeAt(0) + id.charCodeAt(1)) % length;
	}
	return id % length;
};

function buildCoverURL(selectedCover, defaultCover) {
	if (!selectedCover) {
		return defaultCover;
	}
	if (selectedCover.startsWith('http')) {
		return selectedCover;
	}
	return relative_path + selectedCover;
};