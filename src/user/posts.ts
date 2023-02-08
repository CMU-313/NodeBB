import db from '../database';

import meta from '../meta';

import privileges from '../privileges';

import user from '.';

export = function (User: user) {
    type userDataType = {
        uid: string,
        mutedUntil: number,
        joindate: number,
        reputation: number
    }

    async function isReady(uid: string, cid: string[], field: string) {
        if (parseInt(uid, 10) === 0) {
            return;
        }
        const [userData, isAdminOrMod] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            User.getUserFields(uid, ['uid', 'mutedUntil', 'joindate', 'email', 'reputation'].concat([field])),
            privileges.categories.isAdminOrMod(cid, uid),
        ]) as [userDataType, boolean];

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!userData.uid) {
            throw new Error('[[error:no-user]]');
        }

        if (isAdminOrMod) {
            return;
        }

        const now = Date.now();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (userData.mutedUntil > now) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            let muteLeft = ((userData.mutedUntil - now) / (1000 * 60));
            if (muteLeft > 60) {
                muteLeft = +(muteLeft / 60).toFixed(0);
                throw new Error(`[[error:user-muted-for-hours, ${muteLeft}]]`);
            } else {
                throw new Error(`[[error:user-muted-for-minutes, ${+muteLeft.toFixed(0)}]]`);
            }
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const initialpostdelay: number = meta.config.initialPostDelay as number;


        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (now - userData.joindate < meta.config.initialPostDelay * 1000) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            throw new Error(`[[error:user-too-new, ${initialpostdelay}]]`);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const lasttime = userData[field] as number || 0;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const newbiepostdelay: number = meta.config.newbiePostDelay as number;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const newbiepostdelaythreshold: number = meta.config.newbiePostDelayThreshold as number;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const postdelay: number = meta.config.postDelay as number;

        if (
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            meta.config.newbiePostDelay > 0 &&
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            meta.config.newbiePostDelayThreshold > userData.reputation &&
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            now - lasttime < meta.config.newbiePostDelay * 1000
        ) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            throw new Error(`[[error:too-many-posts-newbie, ${newbiepostdelay}, ${newbiepostdelaythreshold}]]`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (now - lasttime < meta.config.postDelay * 1000) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            throw new Error(`[[error:too-many-posts, ${postdelay}]]`);
        }
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.isReadyToPost = async function (uid: string, cid: string[]) { // (uid: string, cid: string[]) {
        await isReady(uid, cid, 'lastposttime');
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.isReadyToQueue = async function (uid: string, cid: string[]) { // (uid: string, cid: string[]) {
        await isReady(uid, cid, 'lastqueuetime');
    };

    type postDataType = {
      timestamp: number,
      uid: string,
      cid: string,
      pid: string,
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.onNewPostMade = async function (postData: postDataType) {
        // For scheduled posts, use "action" time. It'll be updated in related cron job when post is published
        const lastposttime = postData.timestamp > Date.now() ? Date.now() : postData.timestamp;

        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            User.addPostIdToUser(postData),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            User.setUserField(postData.uid, 'lastposttime', lastposttime),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            User.updateLastOnlineTime(postData.uid),
        ]);
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.addPostIdToUser = async function (postData: postDataType) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetsAdd([
            `uid:${postData.uid}:posts`,
            `cid:${postData.cid}:uid:${postData.uid}:pids`,
        ], postData.timestamp, postData.pid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await User.updatePostCount(postData.uid);
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.updatePostCount = async (uids: string[]) => {
        uids = Array.isArray(uids) ? uids : [uids];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const exists = await User.exists(uids) as boolean;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        uids = uids.filter((uid, index) => exists[index]);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (uids.length) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const counts = await db.sortedSetsCard(uids.map(uid => `uid:${uid}:posts`)) as string;
            await Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                db.setObjectBulk(uids.map((uid, index) => ([`user:${uid}`, { postcount: counts[index] }]))),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                db.sortedSetAdd('users:postcount', counts, uids),
            ]);
        }
    };

    async function incrementUserFieldAndSetBy(uid: string, field: string, set: string, valueStr: string) {
        const value = parseInt(valueStr, 10);
        if (!value || !field || !(parseInt(uid, 10) > 0)) {
            return;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const exists = await User.exists(uid) as boolean;
        if (!exists) {
            return;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const newValue = await User.incrementUserFieldBy(uid, field, value) as string;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(set, newValue, uid);
        return newValue;
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.incrementUserPostCountBy = async function (uid: string, value: string) {
        return await incrementUserFieldAndSetBy(uid, 'postcount', 'users:postcount', value);
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.incrementUserReputationBy = async function (uid: string, value: string) {
        return await incrementUserFieldAndSetBy(uid, 'reputation', 'users:reputation', value);
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.incrementUserFlagsBy = async function (uid: string, value: string) {
        return await incrementUserFieldAndSetBy(uid, 'flags', 'users:flags', value);
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    User.getPostIds = async function (uid: string, start, stop) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getSortedSetRevRange(`uid:${uid}:posts`, start, stop) as number;
    };
}
