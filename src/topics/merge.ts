import plugins from '../plugins';
import posts from '../posts';

type hooksFire = {
    params : {uid : number, cid : number, title : string}
}

interface myOptionsInterface {
    mainTid? : number;
    newTopicTitle? : string;
}

interface myTopicDataInterface {
    scheduled : string;
    uid : number;
    cid : number;
    viewcount : number;
}

interface myTopicFieldsInterface {
    mergeIntoTid : number;
    mergerUid : number;
    mergedTimestamp : number;
}

interface myTopicsInterface {
    merge : (tids : number[], uid : number, options : myOptionsInterface) => Promise<number>;
    delete : (tid: number, uid : number) => Promise<void>;
    create : (obj : {uid : number, cid : number, title : string}) => Promise<number>
    movePostToTopic : (uid : number, pid : number, mergeIntoTid : number) => Promise<void>;

    getPids : (tid : number) => Promise<number[]>;
    getTopicFields : (tid : number, something : string[]) => Promise<myTopicDataInterface>;
    getTopicsFields : (tids : number[], something : string[]) => Promise<myTopicDataInterface[]>;

    setTopicField : (tid : number, x : string, y : number) => Promise<void>;
    setTopicFields : (tid : number, field : myTopicFieldsInterface) => Promise<void>;
}


export = function (Topics : myTopicsInterface) {
    Topics.merge = async function (tids:number[], uid:number, options : myOptionsInterface) {
        async function createNewTopic(title : string, oldestTid : number) {
            const topicData = await Topics.getTopicFields(oldestTid, ['uid', 'cid']);
            const params = {
                uid: topicData.uid,
                cid: topicData.cid,
                title: title,
            };
            const result : hooksFire = await plugins.hooks.fire('filter:topic.mergeCreateNewTopic', {
                oldestTid: oldestTid,
                params: params,
            }) as hooksFire;

            const tid = await Topics.create(result.params);
            return tid;
        }

        async function updateViewCount(mergeIntoTid : number, tids : number[]) {
            const topicData = await Topics.getTopicsFields(tids, ['viewcount']);
            const totalViewCount = topicData.reduce(
                (count, topic) => count + topic.viewcount, 0
            );
            await Topics.setTopicField(mergeIntoTid, 'viewcount', totalViewCount);
        }

        function findOldestTopic(tids : number[]) : number {
            return Math.min.apply(null, tids) as number;
        }

        options = options || {};

        const topicsData = await Topics.getTopicsFields(tids, ['scheduled']);
        if (topicsData.some(t => t.scheduled)) {
            throw new Error('[[error:cant-merge-scheduled]]');
        }

        const oldestTid = findOldestTopic(tids);
        let mergeIntoTid = oldestTid;
        if (options.mainTid) {
            mergeIntoTid = options.mainTid;
        } else if (options.newTopicTitle) {
            mergeIntoTid = await createNewTopic(options.newTopicTitle, oldestTid);
        }

        const otherTids = tids.sort((a, b) => a - b)
            .filter(tid => tid && tid !== mergeIntoTid);

        for (const tid of otherTids) {
            /* eslint-disable no-await-in-loop */
            const pids = await Topics.getPids(tid);
            for (const pid of pids) {
                await Topics.movePostToTopic(uid, pid, mergeIntoTid);
            }

            await Topics.setTopicField(tid, 'mainPid', 0);
            await Topics.delete(tid, uid);
            await Topics.setTopicFields(tid, {
                mergeIntoTid: mergeIntoTid,
                mergerUid: uid,
                mergedTimestamp: Date.now(),
            });
        }

        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            posts.updateQueuedPostsTopic(mergeIntoTid, otherTids),
            updateViewCount(mergeIntoTid, tids),
        ]);


        await plugins.hooks.fire('action:topic.merge', {
            uid: uid,
            tids: tids,
            mergeIntoTid: mergeIntoTid,
            otherTids: otherTids,
        });
        return mergeIntoTid;
    };
};
