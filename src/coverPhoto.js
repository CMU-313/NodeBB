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

function calculateCoverIndex(id, coversLength) {
	if (typeof id === 'string') {
		return (id.charCodeAt(0) + id.charCodeAt(1)) % coversLength;
	}
	return id % coversLength;
}

function getCover(type, id) {
	const defaultCover = `${relative_path}/assets/images/cover-default.png`;
	const configCovers = meta.config[`${type}:defaultCovers`];

	if (!configCovers) {
		return defaultCover;
	}

	const covers = String(configCovers).trim().split(/[\s,]+/g);

	if (!covers.length) {
		return defaultCover;
	}

	const index = calculateCoverIndex(id, covers.length);

	if (!covers[index]) {
		return defaultCover;
	}

	const cover = covers[index];
	return cover.startsWith('http') ? cover : relative_path + cover;
}
