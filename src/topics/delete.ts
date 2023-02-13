import db from '../database';
import user from '../user';
import posts from '../posts';
import categories from '../categories';
import plugins from '../plugins';
import batch from '../batch';
import { TopicObject, TagObject, TopicObjectSlim } from '../types';

interface Thumbs{
deleteAll(tid:number): Promise<void>;
}
interface Events{
purge(tid: number):Promise<void>;
}

interface Topics {
        getTopicField(tid: number, field: string): Promise<keyof TopicObject>;
        getTopicFields(tid: number, fields: string[]): Promise<TopicObject>;
        getTopicData(tid: number): Promise<TopicObject>;
        getTopicTags (tid: number) : Promise<TagObject[]>;
        getPids(tid:number): Promise<number[]>;
        setTopicField(tid: number, field: string, value: number): Promise<void>;
        setTopicFields(tid: number, data: any) : Promise<void>;
        deleteTopicFields(tid: number, fields: string[]): Promise<void>;
        deleteTopicTags (tid: number): Promise<void>;
        delete(tid: number, uid: number):Promise<void>;
        removeTopicPidsFromCid(tid:number):Promise<void>;
        restore(tid: number): Promise<void>;
        purgePostsAndTopic(tid: number, uid: number):Promise<void>;
        purge(tid: number, uid: number):Promise<void>;
        thumbs:Thumbs;
        events:Events;
        getPostCount (tid:number) : Promise<number>;
}


function foo(Topics: Topics) {
    async function removeTopicPidsFromCid(tid) {
        const [cid, pids] = await Promise.all([
            Topics.getTopicField(tid, 'cid'),
            Topics.getPids(tid),
        ]);
        await db.sortedSetRemove(`cid:${cid}:pids`, pids);
        await categories.updateRecentTidForCid(cid);
    }
    Topics.delete = async function (tid, uid) {
        await removeTopicPidsFromCid(tid);
        await Topics.setTopicFields(tid, {
            deleted: '1',
            deleterUid: uid,
            deletedTimestamp: Date.now(),
        });
    };

    async function addTopicPidsToCid(tid) {
        const [cid, pids] = await Promise.all([
            Topics.getTopicField(tid, 'cid'),
            Topics.getPids(tid),
        ]);
        let postData = await posts.getPostsFields(pids, ['pid', 'timestamp', 'deleted']);
        postData = postData.filter(post => post && !post.deleted);
        const pidsToAdd = postData.map(post => post.pid);
        const scores = postData.map(post => post.timestamp);
        await db.sortedSetAdd(`cid:${cid}:pids`, scores, pidsToAdd);
        await categories.updateRecentTidForCid(cid);
    }

    Topics.restore = async function (tid) {
        await Promise.all([
            Topics.deleteTopicFields(tid, [
                'deleterUid', 'deletedTimestamp',
            ]),
            addTopicPidsToCid(tid),
        ]);
        await Topics.setTopicField(tid, 'deleted', 0);
    };

    Topics.purgePostsAndTopic = async function (tid, uid) {
        const mainPid = await Topics.getTopicField(tid, 'mainPid');
        await batch.processSortedSet(`tid:${tid}:posts`, async (pids) => {
            await posts.purge(pids, uid);
        }, { alwaysStartAt: 0, batch: 500 });
        await posts.purge(mainPid, uid);
        await Topics.purge(tid, uid);
    };

    Topics.purge = async function (tid, uid) {
        const [deletedTopic, tags] = await Promise.all([
            Topics.getTopicData(tid),
            Topics.getTopicTags(tid),
        ]);
        if (!deletedTopic) {
            return;
        }
        deletedTopic.tags = tags;
        await deleteFromFollowersIgnorers(tid);

        await Promise.all([
            db.deleteAll([
                `tid:${tid}:followers`,
                `tid:${tid}:ignorers`,
                `tid:${tid}:posts`,
                `tid:${tid}:posts:votes`,
                `tid:${tid}:bookmarks`,
                `tid:${tid}:posters`,
            ]),
            db.sortedSetsRemove([
                'topics:tid',
                'topics:recent',
                'topics:posts',
                'topics:views',
                'topics:votes',
                'topics:scheduled',
            ], tid),
            deleteTopicFromCategoryAndUser(tid),
            Topics.deleteTopicTags(tid),
            Topics.events.purge(tid),
            Topics.thumbs.deleteAll(tid),
            reduceCounters(tid),
        ]);
        plugins.hooks.fire('action:topic.purge', { topic: deletedTopic, uid: uid });
        await db.delete(`topic:${tid}`);
    };

    async function deleteFromFollowersIgnorers(tid) {
        const [followers, ignorers] = await Promise.all([
            db.getSetMembers(`tid:${tid}:followers`),
            db.getSetMembers(`tid:${tid}:ignorers`),
        ]);
        const followerKeys = followers.map(uid => `uid:${uid}:followed_tids`);
        const ignorerKeys = ignorers.map(uid => `uid:${uid}ignored_tids`);
        await db.sortedSetsRemove(followerKeys.concat(ignorerKeys), tid);
    }

    async function deleteTopicFromCategoryAndUser(tid) {
        const topicData = await Topics.getTopicFields(tid, ['cid', 'uid']);
        await Promise.all([
            db.sortedSetsRemove([
                `cid:${topicData.cid}:tids`,
                `cid:${topicData.cid}:tids:pinned`,
                `cid:${topicData.cid}:tids:posts`,
                `cid:${topicData.cid}:tids:lastposttime`,
                `cid:${topicData.cid}:tids:votes`,
                `cid:${topicData.cid}:tids:views`,
                `cid:${topicData.cid}:recent_tids`,
                `cid:${topicData.cid}:uid:${topicData.uid}:tids`,
                `uid:${topicData.uid}:topics`,
            ], tid),
            user.decrementUserFieldBy(topicData.uid, 'topiccount', 1),
                        ]);
        await categories.updateRecentTidForCid(topicData.cid);
    }

    async function getPostCount(tid) {
        await Topics.getTopicField(tid, 'postcount');
    }
    async function reduceCounters(tid) {
        const incr = -1;
        await db.incrObjectFieldBy('global', 'topicCount', incr);
        const topicCid = await Topics.getTopicField(tid, 'cid');
        const topicPC = await Topics.getPostCount(tid);
        const postCountChange = incr * topicPC;
        await Promise.all([
            db.incrObjectFieldBy('global', 'postCount', postCountChange),
            db.incrObjectFieldBy(`category:${topicCid}`, 'post_count', postCountChange),
            db.incrObjectFieldBy(`category:${topicCid}`, 'topic_count', incr),
        ]);
    }
}
export = foo;
