'use strict';

const _ = require('lodash');

const db = require('../database');
const privileges = require('../privileges');


module.exports = function (Posts) {
	const terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
	};

	Posts.getRecentPosts = async function (opts) {
		let uid, start, stop, term;
		if (opts && typeof opts === 'object') {
			({ uid, start, stop, term } = opts);
		} else {
			uid = opts;
			start = arguments[1];
			stop = arguments[2];
			term = arguments[3];
		}
		
		let min = 0;
		if (terms[term]) {
			min = Date.now() - terms[term];
		}

		const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
		let pids = await db.getSortedSetRevRangeByScore('posts:pid', start, count, '+inf', min);
		pids = await privileges.posts.filter('topics:read', pids, uid);
		return await Posts.getPostSummaryByPids(pids, uid, { stripTags: true });
	};

	Posts.getRecentPosterUids = async function (start, stop) {
		const pids = await db.getSortedSetRevRange('posts:pid', start, stop);
		const postData = await Posts.getPostsFields(pids, ['uid']);
		return _.uniq(postData.map(p => p && p.uid).filter(uid => parseInt(uid, 10)));
	};
};
