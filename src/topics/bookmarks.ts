import async from 'async';

import db from '../database';
import user from '../user';

interface bk{
    value : string;
    score : string;
}

interface uid_data{
    uid : string;
    bookmark : number;
}
interface u_settings{
    topicPostSort : string;
}
interface tpc{
    getUserBookmark(tid: string, uid: string) : Promise<number|null>;
    getUserBookmarks(tids: Array<string>, uid: string) : Promise<number[]|null[]>;

    setUserBookmark(tid: string, uid: string, index: number): Promise<void>;

    getTopicBookmarks(tid: string) : Promise<bk[]>;
    updateTopicBookmarks(tid: string, pids : number[]) : Promise<void>;

    getPostCount(tid: string) : Promise<number>;
}

export = function (Topics: tpc) {
    Topics.getUserBookmark = async function (tid, uid) {
        if (parseInt(uid, 10) <= 0) {
            return null;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.sortedSetScore(`tid:${tid}:bookmarks`, uid) as number|null;
    };

    Topics.getUserBookmarks = async function (tids, uid) {
        if (parseInt(uid, 10) <= 0) {
            return tids.map<string>(() => null) as null[];
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.sortedSetsScore(tids.map<string>(tid => `tid:${tid}:bookmarks`), uid) as Array<number|null>;
    };

    Topics.setUserBookmark = async function (tid, uid, index) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(`tid:${tid}:bookmarks`, index, uid);
    };

    Topics.getTopicBookmarks = async function (tid) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getSortedSetRangeWithScores(`tid:${tid}:bookmarks`, 0, -1) as Array<bk>;
    };

    Topics.updateTopicBookmarks = async function (tid, pids) {
        const maxIndex : number = await Topics.getPostCount(tid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const indices : Array<number|null> = await db.sortedSetRanks(`tid:${tid}:posts`, pids) as Array<number|null>;
        const postIndices : number[] = indices.map<number|null>((i: number|null) => (i === null ? 0 : i + 1));
        const minIndex : number = Math.min(...postIndices);


        const bookmarks : bk[] = await Topics.getTopicBookmarks(tid);

        const uidData : uid_data[] = bookmarks.map(b => ({ uid: b.value, bookmark: parseInt(b.score, 10) }))
            .filter(data => data.bookmark >= minIndex);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        await async.eachLimit(uidData, 50, async (data) => {
            let bookmark : number = Math.min(data.bookmark, maxIndex);

            postIndices.forEach((i) => {
                if (i < data.bookmark) {
                    bookmark -= 1;
                }
            });

            // make sure the bookmark is valid if we removed the last post
            bookmark = Math.min(bookmark, maxIndex - pids.length);
            if (bookmark === data.bookmark) {
                return;
            }

            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const settings : u_settings = await user.getSettings(data.uid) as u_settings;
            if (settings.topicPostSort === 'most_votes') {
                return;
            }

            await Topics.setUserBookmark(tid, data.uid, bookmark);
        });
    };
}
