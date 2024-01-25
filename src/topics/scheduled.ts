import * as _ from 'lodash';
import * as winston from 'winston';
import { CronJob } from 'cron';

import * as db from '../database';
import * as posts from '../posts';
import * as socketHelpers from '../socket.io/helpers';
import * as topics from './index';
import * as user from '../user';

export const Scheduled: Record<string, any> = {};

Scheduled.startJobs = function () {
    winston.verbose('[scheduled topics] Starting jobs.');
    new CronJob('*/1 * * * *', Scheduled.handleExpired, null, true);
};

Scheduled.handleExpired = async function () {
    const now = Date.now();
    const tids = await db.getSortedSetRangeByScore('topics:scheduled', 0, -1, '-inf', now);

    if (!tids.length) {
        return;
    }

    let topicsData = await topics.getTopicsData(tids);
    // Filter deleted
    topicsData = topicsData.filter((topicData: any) => Boolean(topicData));
    const uids = _.uniq(topicsData.map((topicData: any) => topicData.uid)).filter(uid => uid); // Filter guests topics

    // Restore first to be not filtered for being deleted
    // Restoring handles "updateRecentTid"
    await Promise.all([].concat(
        topicsData.map((topicData: any) => topics.restore(topicData.tid)),
        topicsData.map((topicData: any) => topics.updateLastPostTimeFromLastPid(topicData.tid))
    ));

    await Promise.all([].concat(
        sendNotifications(uids, topicsData),
        updateUserLastposttimes(uids, topicsData),
        ...topicsData.map((topicData: any) => unpin(topicData.tid, topicData)),
        db.sortedSetsRemoveRangeByScore([`topics:scheduled`], '-inf', now)
    ));
};

// topics/tools.js#pin/unpin would block non-admins/mods, thus the local versions
Scheduled.pin = async function (tid: string, topicData: any) {
    return Promise.all([
        topics.setTopicField(tid, 'pinned', 1),
        db.sortedSetAdd(`cid:${topicData.cid}:tids:pinned`, Date.now(), tid),
        db.sortedSetsRemove([
            `cid:${topicData.cid}:tids`,
            `cid:${topicData.cid}:tids:posts`,
            `cid:${topicData.cid}:tids:votes`,
            `cid:${topicData.cid}:tids:views`,
        ], tid),
    ]);
};

Scheduled.reschedule = async function ({ cid, tid, timestamp, uid }: any) {
    await Promise.all([
        db.sortedSetsAdd([
            'topics:scheduled',
            `uid:${uid}:topics`,
            'topics:tid',
            `cid:${cid}:uid:${uid}:tids`,
        ], timestamp, tid),
        shiftPostTimes(tid, timestamp),
    ]);
    return topics.updateLastPostTimeFromLastPid(tid);
};

function unpin(tid: string, topicData: any) {
    return [
        topics.setTopicField(tid, 'pinned', 0),
        topics.deleteTopicField(tid, 'pinExpiry'),
        db.sortedSetRemove(`cid:${topicData.cid}:tids:pinned`, tid),
        db.sortedSetAddBulk([
            [`cid:${topicData.cid}:tids`, topicData.lastposttime, tid],
            [`cid:${topicData.cid}:tids:posts`, topicData.postcount, tid],
            [`cid:${topicData.cid}:tids:votes`, parseInt(topicData.votes, 10) || 0, tid],
            [`cid:${topicData.cid}:tids:views`, topicData.viewcount, tid],
        ]),
    ];
}

<<<<<<< HEAD
async function sendNotifications(uids, topicsData: any[]) {
=======
async function sendNotifications(uids: string[], topicsData: any[]) {
>>>>>>> a3128dab3217c4b2bfeed5cbb976d1d3868cbde2
    const usernames = await Promise.all(uids.map(uid => user.getUserField(uid, 'username')));
    const uidToUsername = Object.fromEntries(uids.map((uid, idx) => [uid, usernames[idx]]));

    const postsData = await posts.getPostsData(topicsData.map(({ mainPid }: any) => mainPid));
    postsData.forEach((postData: any, idx: number) => {
        postData.user = {};
        postData.user.username = uidToUsername[postData.uid];
        postData.topic = topicsData[idx];
    });

    return Promise.all(topicsData.map(
        (t: any, idx: number) => user.notifications.sendTopicNotificationToFollowers(t.uid, t, postsData[idx])
    ).concat(
        topicsData.map(
            (t: any, idx: number) => socketHelpers.notifyNew(t.uid, 'newTopic', { posts: [postsData[idx]], topic: t })
        )
    ));
}

<<<<<<< HEAD
async function updateUserLastposttimes(uids, topicsData: any[]) {
=======
async function updateUserLastposttimes(uids: string[], topicsData: any[]) {
>>>>>>> a3128dab3217c4b2bfeed5cbb976d1d3868cbde2
    const lastposttimes = (await user.getUsersFields(uids, ['lastposttime'])).map(u => u.lastposttime);

    let tstampByUid: Record<string, number[]> = {};
    topicsData.forEach((tD: any) => {
        tstampByUid[tD.uid] = tstampByUid[tD.uid] ? tstampByUid[tD.uid].concat(tD.lastposttime) : [tD.lastposttime];
    });
    tstampByUid = Object.fromEntries(
        Object.entries(tstampByUid).map(uidTimestamp => [uidTimestamp[0], Math.max(...uidTimestamp[1])])
    );

    const uidsToUpdate = uids.filter((uid, idx) => tstampByUid[uid] > lastposttimes[idx]);
    return Promise.all(uidsToUpdate.map(uid => user.setUserField(uid, 'lastposttime', tstampByUid[uid])));
}

async function shiftPostTimes(tid: string, timestamp: number) {
    const pids = (await posts.getPidsFromSet(`tid:${tid}:posts`, 0, -1, false));
    // Leaving other related score values intact, since they reflect post order correctly,
    // and it seems that's good enough
    return db.setObjectBulk(pids.map((pid: string, idx: number) => [`post:${pid}`, { timestamp: timestamp + idx + 1 }]));
<<<<<<< HEAD
};
=======
};
>>>>>>> a3128dab3217c4b2bfeed5cbb976d1d3868cbde2
