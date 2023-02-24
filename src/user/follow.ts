
import plugins from '../plugins';
import db from '../database';

interface UserObject {
    follow: (uid: string, followuid: string) => Promise<void>;
    unfollow: (uid: string, unfollowuid: string) => Promise<void>;
    setUserField: (uid: string, field: string, value: number) => Promise<void>;
    exists: (theiruid: string) => Promise<boolean>;
    isFollowing: (uid: string, theiruid: string) => Promise<boolean>;
    getFollowing: (uid: string, start: string, stop: string) => Promise<UserObject[]>;
    getFollowers: (uid: string, start: string, stop: string) => Promise<UserObject[]>;
    getUsers: (uids: string[], uid: string) => Promise<UserObject[]>;
}

interface dataObject {
    uids: string[]
}

export = function (User: UserObject) {
    async function toggleFollow(type: string, uid: string, theiruid: string): Promise<void> {
        if (parseInt(uid, 10) <= 0 || parseInt(theiruid, 10) <= 0) {
            throw new Error('[[error:invalid-uid]]');
        }

        if (parseInt(uid, 10) === parseInt(theiruid, 10)) {
            throw new Error('[[error:you-cant-follow-yourself]]');
        }
        const exists: boolean = await User.exists(theiruid);
        if (!exists) {
            throw new Error('[[error:no-user]]');
        }
        const isFollowing: boolean = await User.isFollowing(uid, theiruid);
        if (type === 'follow') {
            if (isFollowing) {
                throw new Error('[[error:already-following]]');
            }
            const now: number = Date.now();
            await Promise.all([
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                db.sortedSetAddBulk([
                    [`following:${uid}`, now, theiruid],
                    [`followers:${theiruid}`, now, uid],
                ]),
            ]);
        } else {
            if (!isFollowing) {
                throw new Error('[[error:not-following]]');
            }
            await Promise.all([
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                db.sortedSetRemoveBulk([
                    [`following:${uid}`, theiruid],
                    [`followers:${theiruid}`, uid],
                ]),
            ]);
        }

        const [followingCount, followerCount]: [number, number] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetCard(`following:${uid}`),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetCard(`followers:${theiruid}`),
        ]) as [number, number];

        await Promise.all([
            User.setUserField(uid, 'followingCount', followingCount),
            User.setUserField(theiruid, 'followerCount', followerCount),
        ]);
    }

    async function getFollow(uid: string, type: string, start: string, stop: string): Promise<UserObject[]> {
        if (parseInt(uid, 10) <= 0) {
            return [];
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uids: string[] = await db.getSortedSetRevRange(`${type}:${uid}`, start, stop) as string[];
        const data: dataObject = await plugins.hooks.fire(`filter:user.${type}`, {
            uids: uids,
            uid: uid,
            start: start,
            stop: stop,
        }) as dataObject;
        return await User.getUsers(data.uids, uid);
    }

    User.follow = async function (uid: string, followuid: string): Promise<void> {
        await toggleFollow('follow', uid, followuid);
    };

    User.unfollow = async function (uid: string, unfollowuid: string): Promise<void> {
        await toggleFollow('unfollow', uid, unfollowuid);
    };

    User.getFollowing = async function (uid: string, start: string, stop: string) {
        return await getFollow(uid, 'following', start, stop);
    };

    User.getFollowers = async function (uid: string, start: string, stop: string) {
        return await getFollow(uid, 'followers', start, stop);
    };

    User.isFollowing = async function (uid, theirid) {
        if (parseInt(uid, 10) <= 0 || parseInt(theirid, 10) <= 0) {
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.isSortedSetMember(`following:${uid}`, theirid) as Promise<boolean>;
    };
};
