
import db = require('../database');
import plugins = require('../plugins');
import posts = require('../posts');
import { TopicObject } from '../types';

interface Options {
    start: number;
    stop: string;
    term: number;
}

interface TopicList {
    getTopicFields(tid: number, fields: string[]): Promise<TopicObject>;
    setTopicField(tid: number, field: string, value: number): Promise<void>;
    getRecentTopics(cid: number, uid: number, start: number, stop: string, filter: string);
    updateLastPostTimeFromLastPid(tid: number): Promise<void>;
    updateRecent(tid: number, timestamp: number): Promise<void>;
    getLatestTopics(options: Options);
    getTopics(tids: number[], option: Options);
    getLatestTidsFromSet(set: string, start: number, stop: string, term: number): Promise<number[]>;
    updateLastPostTime(tid: number, lastposttime: number): Promise<void>;
    getLatestUndeletedPid(tid: number): number;
    getSortedTopics({ cids, uid, start, stop, filter, sort }): Promise<Sort>;
}

interface Sort {
    nextStart: string;
    topicCount: number;
    topics: string[];
}

module.exports = function (Topics: TopicList) {
    const terms = {
        day: 86400000,
        week: 604800000,
        month: 2592000000,
        year: 31104000000,
    };
    Topics.getRecentTopics = async function (cid: number, uid: number,
        start: number, stop: string, filter: string): Promise<Sort> {
        return await Topics.getSortedTopics({
            cids: cid,
            uid: uid,
            start: start,
            stop: stop,
            filter: filter,
            sort: 'recent',
        });
    };

    /* not an orphan method, used in widget-essentials */
    Topics.getLatestTopics = async function (options: Options) {
        // uid, start, stop, term
        const tids: number[] = await Topics.getLatestTidsFromSet('topics:recent', options.start, options.stop, options.term);
        const topics = await Topics.getTopics(tids, options);
        return { topics: topics, nextStart: parseInt(options.stop, 10) + 1 };
    };

    Topics.getLatestTidsFromSet = async function (set: string, start: number,
        stop: string, term: number): Promise<number[]> {
        let since: number = terms.day;
        if (terms[term]) {
            since = terms[term];
        }

        const count: string | number = parseInt(stop, 10) === -1 ? stop : parseInt(stop, 10) - start + 1;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return db.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since);
    };

    Topics.updateLastPostTimeFromLastPid = async function (tid: number): Promise<void> {
        const pid = Topics.getLatestUndeletedPid(tid);
        if (!pid) {
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const timestamp: number = posts.getPostField(pid, 'timestamp');
        if (!timestamp) {
            return;
        }
        await Topics.updateLastPostTime(tid, timestamp);
    };

    Topics.updateLastPostTime = async function (tid: number, lastposttime: number): Promise<void> {
        await Topics.setTopicField(tid, 'lastposttime', lastposttime);
        const topicData = await Topics.getTopicFields(tid, ['cid', 'deleted', 'pinned']);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, lastposttime, tid);

        await Topics.updateRecent(tid, lastposttime);

        if (!topicData.pinned) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`cid:${topicData.cid}:tids`, lastposttime, tid);
        }
    };

    Topics.updateRecent = async function (tid: number, timestamp: number): Promise<void> {
        let data = { tid: tid, timestamp: timestamp };
        if (plugins.hooks.hasListeners('filter:topics.updateRecent')) {
            data = await plugins.hooks.fire('filter:topics.updateRecent', { tid: tid, timestamp: timestamp });
        }
        if (data && data.tid && data.timestamp) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd('topics:recent', data.timestamp, data.tid);
        }
    };
};
