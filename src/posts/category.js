
'use strict';


const _ = require('lodash');

const db = require('../database');
const topics = require('../topics');
const activitypub = require('../activitypub');

async function getCidByPid(Posts, pid) {
	const tid = await Posts.getPostField(pid, 'tid');
	if (!tid && activitypub.helpers.isUri(pid)) {
		return -1; // fediverse pseudo-category
	}
	return await topics.getTopicField(tid, 'cid');
}

async function getCidsByPids(Posts, pids) {
	const postData = await Posts.getPostsFields(pids, ['tid']);
	const tids = _.uniq(postData.map(post => post && post.tid).filter(Boolean));
	const topicData = await topics.getTopicsFields(tids, ['cid']);
	const tidToTopic = _.zipObject(tids, topicData);
	const cids = postData.map(post => tidToTopic[post.tid] && tidToTopic[post.tid].cid);
	return cids;
}

async function filterPidsBySingleCid(pids, cid) {
	const isMembers = await db.isSortedSetMembers(`cid:${parseInt(cid, 10)}:pids`, pids);
	return pids.filter((pid, index) => pid && isMembers[index]);
}

async function filterPidsByCid(Posts, pids, cid) {
	if (!cid) return pids;
	if (!Array.isArray(cid) || cid.length === 1) {
		return await filterPidsBySingleCid(pids, cid);
	}
	const pidsArr = await Promise.all(cid.map(c => filterPidsByCid(Posts, pids, c)));
	return _.union(...pidsArr);
}

module.exports = function (Posts) {
	Posts.getCidByPid = pid => getCidByPid(Posts, pid);
	Posts.getCidsByPids = pids => getCidsByPids(Posts, pids);
	Posts.filterPidsByCid = async (pids, cid) => filterPidsByCid(Posts, pids, cid);
};
