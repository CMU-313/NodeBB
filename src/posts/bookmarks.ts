import db = require('../database');
import plugins = require('../plugins');

type PostData = {
  uid: string;
  bookmarks: string[];
}

type Post = {
  bookmark: (pid: string, uid: string) => Promise<unknown>;
  unbookmark: (pid: string, uid: string) => Promise<unknown>
  getPostFields: (pid: string, fields: string[]) => PostData;
  hasBookmarked: (pid: string, uid: string) => Promise<unknown>;
  setPostField: (pid: string, field: string, bookmarks: string[]) => Promise<unknown>;
}

export default function (Posts: Post) {
    async function toggleBookmark(type: string, pid: string, uid: string) {
        if (parseInt(uid, 10) <= 0) {
            throw new Error('[[error:not-logged-in]]');
        }

        const isBookmarking = type === 'bookmark';

        const [postData, hasBookmarked] = await Promise.all([
            Posts.getPostFields(pid, ['pid', 'uid']),
            Posts.hasBookmarked(pid, uid),
        ]);

        if (isBookmarking && hasBookmarked) {
            throw new Error('[[error:already-bookmarked]]');
        }

        if (!isBookmarking && !hasBookmarked) {
            throw new Error('[[error:already-unbookmarked]]');
        }

        if (isBookmarking) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`uid:${uid}:bookmarks`, Date.now(), pid);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetRemove(`uid:${uid}:bookmarks`, pid);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db[isBookmarking ? 'setAdd' : 'setRemove'](`pid:${pid}:users_bookmarked`, uid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        postData.bookmarks = await db.setCount(`pid:${pid}:users_bookmarked`) as string[];
        await Posts.setPostField(pid, 'bookmarks', postData.bookmarks);

        plugins.hooks.fire(`action:post.${type}`, {
            pid: pid,
            uid: uid,
            owner: postData.uid,
            current: hasBookmarked ? 'bookmarked' : 'unbookmarked',
        }) as void;

        return {
            post: postData,
            isBookmarked: isBookmarking,
        };
    }

    Posts.bookmark = async function (pid: string, uid: string) {
        return await toggleBookmark('bookmark', pid, uid);
    };

    Posts.unbookmark = async function (pid: string, uid: string) {
        return await toggleBookmark('unbookmark', pid, uid);
    };

    Posts.hasBookmarked = async function (pid: string, uid: string) {
        if (parseInt(uid, 10) <= 0) {
            return Array.isArray(pid) ? pid.map(() => false) : false;
        }

        if (Array.isArray(pid)) {
            const sets = pid.map(pid => `pid:${pid as string}:users_bookmarked`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return await db.isMemberOfSets(sets, uid) as boolean;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.isSetMember(`pid:${pid}:users_bookmarked`, uid) as boolean;
    };
}
