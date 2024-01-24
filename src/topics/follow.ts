import db from '../database';
import notifications from '../notifications';
import privileges from '../privileges';
import plugins from '../plugins';
import utils from '../utils';

type Method = (tid: string, uid : string) => Promise<void>;
type Set = string;

interface FollowData {
    following : boolean;
    ignoring : boolean;
}

interface PostData {
    pid: string;
    topic: {tid : string, title: string};
    content: string;
}

type NotifData = {
    type?: string;
    bodyShort?: string;
    nid?: string;
    mergeId?: string;
}

interface Topics {
    exists: (tid : string) => Promise<boolean>;
    toggleFollow: (tid : string, uid : string) => Promise<boolean>;
    follow: (tid : string, uid : string) => Promise<void>;
    unfollow: (tid : string, uid : string) => Promise<void>;
    ignore: (tid : string, uid : string) => Promise<void>;
    isFollowing: (tids : string[], uid : string) => Promise<boolean[]>;
    isIgnoring: (tids : string[], uid : string) => Promise<boolean[]>;
    getFollowData: (tids : string[], uid : string) => Promise<FollowData[]>;
    getFollowers: (tid : string) => Promise<string[]>;
    getIgnorers: (tid : string) => Promise<string[]>;
    filterIgnoringUids: (tid : string, uids : string[]) => Promise<string[]>;
    filterWatchedTids: (tids : string[], uid : string) => Promise<string[]>;
    filterNotIgnoredTids: (tids : string[], uid : string) => Promise<string[]>;
    notifyFollowers: (postData : PostData, exceptUid : string, notifData : NotifData) => Promise<void>;
}

export = function (Topics : Topics) {
    Topics.toggleFollow = async function (tid, uid) {
        const exists = await Topics.exists(tid);
        if (!exists) {
            throw new Error('[[error:no-topic]]');
        }
        const isFollowing = await Topics.isFollowing([tid], uid);
        if (isFollowing[0]) {
            await Topics.unfollow(tid, uid);
        } else {
            await Topics.follow(tid, uid);
        }
        return !isFollowing[0];
    };

    async function setWatching(method1 : Method, method2 : Method, hook : string, tid : string, uid : string) {
        if (!(parseInt(uid, 10) > 0)) {
            throw new Error('[[error:not-logged-in]]');
        }
        const exists = await Topics.exists(tid);
        if (!exists) {
            throw new Error('[[error:no-topic]]');
        }
        await method1(tid, uid);
        await method2(tid, uid);
        plugins.hooks.fire(hook, { uid: uid, tid: tid }) as void;
    }

    async function addToSets(set1 : Set, set2 : Set, tid : string, uid : string) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setAdd(set1, uid);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(set2, Date.now(), tid);
    }

    async function removeFromSets(set1 : Set, set2 : Set, tid : string, uid : string) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setRemove(set1, uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemove(set2, tid);
    }

    async function follow(tid : string, uid : string) {
        await addToSets(`tid:${tid}:followers`, `uid:${uid}:followed_tids`, tid, uid);
    }

    async function unfollow(tid : string, uid : string) {
        await removeFromSets(`tid:${tid}:followers`, `uid:${uid}:followed_tids`, tid, uid);
    }

    async function ignore(tid : string, uid : string) {
        await addToSets(`tid:${tid}:ignorers`, `uid:${uid}:ignored_tids`, tid, uid);
    }

    async function unignore(tid : string, uid : string) {
        await removeFromSets(`tid:${tid}:ignorers`, `uid:${uid}:ignored_tids`, tid, uid);
    }

    Topics.follow = async function (tid, uid) {
        await setWatching(follow, unignore, 'action:topic.follow', tid, uid);
    };

    Topics.unfollow = async function (tid, uid) {
        await setWatching(unfollow, unignore, 'action:topic.unfollow', tid, uid);
    };

    Topics.ignore = async function (tid, uid) {
        await setWatching(ignore, unfollow, 'action:topic.ignore', tid, uid);
    };

    async function isIgnoringOrFollowing(set : Set, tids : string[], uid : string) : Promise<boolean[]> {
        if (!Array.isArray(tids)) {
            return [];
        }
        if (parseInt(uid, 10) <= 0) {
            return tids.map(() => false);
        }
        const keys = tids.map(tid => `tid:${tid}:${set}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.isMemberOfSets(keys, uid) as Promise<boolean[]>;
    }

    Topics.isFollowing = async function (tids, uid) {
        return await isIgnoringOrFollowing('followers', tids, uid);
    };

    Topics.isIgnoring = async function (tids, uid) {
        return await isIgnoringOrFollowing('ignorers', tids, uid);
    };

    Topics.getFollowData = async function (tids, uid) {
        if (!Array.isArray(tids)) {
            return [];
        }
        if (parseInt(uid, 10) <= 0) {
            return tids.map(() => ({ following: false, ignoring: false }));
        }
        const keys : string[] = [];
        tids.forEach(tid => keys.push(`tid:${tid}:followers`, `tid:${tid}:ignorers`));

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const data : boolean[] = await db.isMemberOfSets(keys, uid) as boolean[];

        const followData : FollowData[] = [];
        for (let i = 0; i < data.length; i += 2) {
            followData.push({
                following: data[i],
                ignoring: data[i + 1],
            });
        }
        return followData;
    };

    Topics.getFollowers = async function (tid) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getSetMembers(`tid:${tid}:followers`) as Promise<string[]>;
    };

    Topics.getIgnorers = async function (tid) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getSetMembers(`tid:${tid}:ignorers`) as Promise<string[]>;
    };

    Topics.filterIgnoringUids = async function (tid, uids) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isIgnoring : boolean[] = await db.isSetMembers(`tid:${tid}:ignorers`, uids) as boolean[];
        const readingUids = uids.filter((uid, index) => uid && !isIgnoring[index]);
        return readingUids;
    };

    Topics.filterWatchedTids = async function (tids, uid) {
        if (parseInt(uid, 10) <= 0) {
            return [];
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const scores : string[] = await db.sortedSetScores(`uid:${uid}:followed_tids`, tids) as string[];
        return tids.filter((tid, index) => tid && !!scores[index]);
    };

    Topics.filterNotIgnoredTids = async function (tids, uid) {
        if (parseInt(uid, 10) <= 0) {
            return tids;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const scores : string[] = await db.sortedSetScores(`uid:${uid}:ignored_tids`, tids) as string[];
        return tids.filter((tid, index) => tid && !scores[index]);
    };

    Topics.notifyFollowers = async function (postData, exceptUid, notifData) {
        notifData = notifData || {};
        let followers = await Topics.getFollowers(postData.topic.tid);
        const index = followers.indexOf(String(exceptUid));
        if (index !== -1) {
            followers.splice(index, 1);
        }

        followers = await privileges.topics.filterUids('topics:read', postData.topic.tid, followers) as string[];
        if (!followers.length) {
            return;
        }

        let { title } = postData.topic;
        if (title) {
            title = utils.decodeHTMLEntities(title);
        }

        const notification : object = await notifications.create({
            subject: title,
            bodyLong: postData.content,
            pid: postData.pid,
            path: `/post/${postData.pid}`,
            tid: postData.topic.tid,
            from: exceptUid,
            topicTitle: title,
            ...notifData,
        }) as object;
        notifications.push(notification, followers) as void;
    };
};
