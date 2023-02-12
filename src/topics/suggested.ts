
import _ from 'lodash';

import db from '../database';
import user from '../user';
import privileges from '../privileges';
import search from '../search';
import { TopicObject } from '../types/topic';

interface Topics {
    getSuggestedTopics: (tid: number, uid: number, start: number, stop: number, cutoff?: number)
    => Promise<TopicObject[]>;
    getTopicsByTids: (arg0: number[], arg1: number) => Promise<TopicObject[]>;
    getTopicTags: (arg0: number) => Promise<string[]>;
    getTopicFields: (arg0: TopicObject['tid'], arg1: string[]) => Promise<TopicObject>;
    getTopicField: (arg0: number, arg1: string) => Promise<string>;
}

type DataObject = {
    tids: number[]
}

export = function (Topics: Topics) {
    async function getTidsWithSameTags(tid: number, cutoff: number) {
        const tags = await Topics.getTopicTags(tid);
        let tids : number[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tids = cutoff === 0 ?
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.getSortedSetRevRange(tags.map((tag: string) => `tag:${tag}:topics`), 0, -1) :
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.getSortedSetRevRangeByScore(tags.map((tag: string) => `tag:${tag}:topics`), 0, -1, '+inf', Date.now() - cutoff);
        tids = tids.filter((_tid : number) => _tid !== tid); // remove self
        return _.shuffle(_.uniq(tids)).slice(0, 10).map(Number);
    }

    async function getSearchTids(tid: number, uid: number, cutoff: number) {
        const topicData = await Topics.getTopicFields(tid, ['title', 'cid']);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = await search.search({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            query: topicData.title,
            searchIn: 'titles',
            matchWords: 'any',
            categories: [topicData.cid],
            uid: uid,
            returnIds: true,
            timeRange: cutoff !== 0 ? cutoff / 1000 : 0,
            timeFilter: 'newer',
        }) as number[] & DataObject;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        data.tids = data.filter((_tid: number) => _tid !== tid); // remove self
        return _.shuffle(data.tids).slice(0, 10).map(Number);
    }

    async function getCategoryTids(tid: number, cutoff: number) {
        const cid = await Topics.getTopicField(tid, 'cid');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const tids: number[] = cutoff === 0 ?
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.getSortedSetRevRange(`cid:${cid}:tids:lastposttime`, 0, 9) :
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.getSortedSetRevRangeByScore(`cid:${cid}:tids:lastposttime`, 0, 9, '+inf', Date.now() - cutoff);
        return _.shuffle(tids.map(Number).filter((_tid: number) => _tid !== tid));
    }

    Topics.getSuggestedTopics = async function (tid : number, uid : number, start: number, stop: number, cutoff = 0) {
        let tids : number[];
        cutoff = cutoff === 0 ? cutoff : (cutoff * 2592000000);
        const [tagTids, searchTids] = await Promise.all([
            getTidsWithSameTags(tid, cutoff),
            getSearchTids(tid, uid, cutoff),
        ]);

        tids = _.uniq(tagTids.concat(searchTids));

        let categoryTids = [];
        if (stop !== -1 && tids.length < stop - start + 1) {
            categoryTids = await getCategoryTids(tid, cutoff);
        }
        tids = _.shuffle(_.uniq(tids.concat(categoryTids)));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tids = await privileges.topics.filterTids('topics:read', tids, uid);

        let topicData: TopicObject[] = await Topics.getTopicsByTids(tids, uid);
        topicData = topicData.filter((topic: { tid: number; }) => topic && topic.tid !== tid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        topicData = await user.blocks.filter(uid, topicData) as TopicObject[];
        topicData = topicData.slice(start, stop !== -1 ? stop + 1 : undefined)
            .sort((t1, t2) => new Date(t2.timestamp).valueOf() - new Date(t1.timestamp).valueOf());
        return topicData;
    };
};
