import db from '../database';
import plugins from '../plugins';

interface PostObject {
    bookmark : (pid:number, uid:string) => Promise<{ post: PostObject; isBookmarked: boolean; }>;
    bookmarks : number;
    uid : string
    unbookmark : (pid: number, uid: string) => Promise<{ post: PostObject; isBookmarked: boolean; }>;
    getPostFields: (pid:number, fields:string[]) => Promise<PostObject>;
    hasBookmarked : (pid: number | number[], uid: string) => Promise<boolean | boolean[]>;
    setPostField: (pid:number, field:string, value:number) => Promise<void>;
}

export = function (Posts:PostObject) {
    async function toggleBookmark(type:string, pid:number, uid:string) {
        if (parseInt(uid, 10) <= 0) {
            throw new Error('[[error:not-logged-in]]');
        }

        const isBookmarking = type === 'bookmark';

        const [postData, hasBookmarked]:[PostObject, boolean | boolean[]] = await Promise.all([
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
        postData.bookmarks = await db.setCount(`pid:${pid}:users_bookmarked`) as number;
        await Posts.setPostField(pid, 'bookmarks', postData.bookmarks);

        await plugins.hooks.fire(`action:post.${type}`, {
            pid: pid,
            uid: uid,
            owner: postData.uid,
            current: hasBookmarked ? 'bookmarked' : 'unbookmarked',
        });

        return {
            post: postData,
            isBookmarked: isBookmarking,
        };
    }

    Posts.bookmark = async function (pid:number, uid:string) {
        return await toggleBookmark('bookmark', pid, uid);
    };
    Posts.unbookmark = async function (pid:number, uid:string) {
        return await toggleBookmark('unbookmark', pid, uid);
    };

    Posts.hasBookmarked = async function (pid:number | number[], uid:string) {
        if (parseInt(uid, 10) <= 0) {
            return Array.isArray(pid) ? pid.map(() => false) : false;
        }

        if (Array.isArray(pid)) {
            const sets = pid.map(pid => `pid:${pid}:users_bookmarked`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const returnBool:boolean = await db.isMemberOfSets(sets, uid) as boolean;
            return returnBool;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const returnBool:boolean = await db.isSetMember(`pid:${pid}:users_bookmarked`, uid) as boolean;
        return returnBool;
    };
}
