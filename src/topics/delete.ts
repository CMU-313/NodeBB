
import db from '../database';
import user from '../user';
import posts from '../posts';
import categories from '../categories';
import plugins from '../plugins';
import batch from '../batch';

interface numTime
{
    deleted: number
    deleterUid: number,
    deletedTimestamp: number
}
interface topicData
{
    cid: string;
    uid : number;
    postcount : number;
}
interface event
{
    purge : (tid : number) => void;
}
interface thumb
{
    deleteAll : (tid : number) => void;
}
type ob =
{
    tags : string[];
}
interface TopicObj2
{
    getTopicField : (tid : number, cid : string) => Promise<string>;
    getPids : (tid : number) => number[];
    delete : (tid : number, uid : number) => Promise<void>;
    restore : (tid : number) => Promise<void>;
    purge : (tid : number, uid : number) => Promise<void>;
    setTopicFields : (tid : number, data: numTime) => Promise<void>;
    deleteTopicFields : (tid : number, x: string[]) => void;
    setTopicField : (tid : number, x : string, y : 0) => Promise<void>;
    purgePostsAndTopic : (tid :number, uid : number) => Promise<void>;
    getTopicFields : (tid : number, x : string[]) => Promise<topicData>;
    deleteTopicTags : (tid : number) => void;
    getTopicData : (tid : number) => ob;
    getTopicTags : (tid : number) => string[];
    events : event;
    thumbs : thumb;
}
interface postObj
{
    deleted : boolean;
    pid : string;
    timestamp : number;

}

export = function (Topics : TopicObj2) {
    async function removeTopicPidsFromCid(tid : number) {
        const [cid, pids] : [string, number[]] = await Promise.all([
            Topics.getTopicField(tid, 'cid'),
            Topics.getPids(tid),
        ]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemove(`cid:${cid}:pids`, pids);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await categories.updateRecentTidForCid(cid);
    }

    async function addTopicPidsToCid(tid : number) {
        const [cid, pids] = await Promise.all([
            Topics.getTopicField(tid, 'cid'),
            Topics.getPids(tid),
        ]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let postData : postObj[] = await posts.getPostsFields(pids, ['pid', 'timestamp', 'deleted']) as postObj[];
        postData = postData.filter(post => post && !post.deleted);
        const pidsToAdd = postData.map(post => post.pid);
        const scores = postData.map(post => post.timestamp);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(`cid:${cid}:pids`, scores, pidsToAdd);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await categories.updateRecentTidForCid(cid);
    }

    Topics.delete = async function (tid : number, uid : number) {
        await removeTopicPidsFromCid(tid);
        await Topics.setTopicFields(tid, {
            deleted: 1,
            deleterUid: uid,
            deletedTimestamp: Date.now(),
        });
    };



    Topics.restore = async function (tid : number) {
        await Promise.all([
            Topics.deleteTopicFields(tid, [
                'deleterUid', 'deletedTimestamp',
            ]),
            addTopicPidsToCid(tid),
        ]);
        await Topics.setTopicField(tid, 'deleted', 0);
    };

    Topics.purgePostsAndTopic = async function (tid : number, uid : number) {
        const mainPid = await Topics.getTopicField(tid, 'mainPid');
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await batch.processSortedSet(`tid:${tid}:posts`, async (pids : number) => {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await posts.purge(pids, uid);
        }, { alwaysStartAt: 0, batch: 500 });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await posts.purge(mainPid, uid);
        await Topics.purge(tid, uid);
    };

    async function deleteFromFollowersIgnorers(tid : number) {
        const [followers, ignorers] : string[][] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getSetMembers(`tid:${tid}:followers`) as string[],
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getSetMembers(`tid:${tid}:ignorers`) as string[],
        ]);
        const followerKeys : string[] = followers.map(uid => `uid:${uid}:followed_tids`);
        const ignorerKeys : string[] = ignorers.map(uid => `uid:${uid}ignored_tids`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetsRemove(followerKeys.concat(ignorerKeys), tid);
    }

    async function reduceCounters(tid : number) {
        const incr = -1;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.incrObjectFieldBy('global', 'topicCount', incr);
        const topicData = await Topics.getTopicFields(tid, ['cid', 'postcount']);
        const postCountChange = incr * topicData.postcount;
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.incrObjectFieldBy('global', 'postCount', postCountChange),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.incrObjectFieldBy(`category:${topicData.cid}`, 'post_count', postCountChange),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.incrObjectFieldBy(`category:${topicData.cid}`, 'topic_count', incr),
        ]);
    }
    async function deleteTopicFromCategoryAndUser(tid : number) {
        const topicData = await Topics.getTopicFields(tid, ['cid', 'uid']);
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.decrementUserFieldBy(topicData.uid, 'topiccount', 1),
        ]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await categories.updateRecentTidForCid(topicData.cid);
    }
    Topics.purge = async function (tid : number, uid : number) {
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
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.deleteAll([
                `tid:${tid}:followers`,
                `tid:${tid}:ignorers`,
                `tid:${tid}:posts`,
                `tid:${tid}:posts:votes`,
                `tid:${tid}:bookmarks`,
                `tid:${tid}:posters`,
            ]),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await plugins.hooks.fire('action:topic.purge', { topic: deletedTopic, uid: uid });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.delete(`topic:${tid}`);
    };
}
