// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
import async = require('async');
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
import db = require('../database');
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
import user = require('../user');

interface Topics {
    getUserBookmark: (tid: number, uid: string) => Promise<number>;
    getUserBookmarks: (tids: number[], uid: string) => Promise<number[]> | number[];
    setUserBookmark: (tid: number, uid: number, index: number) => Promise<void>;
    getTopicBookmarks: (tid: number) => Promise<{ value: number, score: string }[]>;
    updateTopicBookmarks: (tid: number, pids: number[]) => Promise<void>;
    getPostCount: (tid: number) => Promise<number>;
}


module.exports = function (Topics: Topics) {
    Topics.getUserBookmark = async function (tid, uid): Promise<number> | null {
        if (parseInt(uid, 10) <= 0) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.sortedSetScore(`tid:${tid}:bookmarks`, uid) as number;
    };

    Topics.getUserBookmarks = async function (tids, uid): Promise<number[]> {
        if (parseInt(uid, 10) <= 0) {
            return tids.map(() => null) as number[];
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.sortedSetsScore(tids.map(tid => `tid:${tid}:bookmarks`), uid) as Promise<number[]>;
    };

    Topics.setUserBookmark = async function (tid, uid, index): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(`tid:${tid}:bookmarks`, index, uid);
    };

    Topics.getTopicBookmarks = async function (tid): Promise<{ value: number, score: string }[]> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getSortedSetRangeWithScores(`tid:${tid}:bookmarks`, 0, -1) as Promise<{ value: number, score: string }[]>;
    };

    Topics.updateTopicBookmarks = async function (tid, pids): Promise<void> {
        const maxIndex = await Topics.getPostCount(tid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const indices = await db.sortedSetRanks(`tid:${tid}:posts`, pids) as number[];
        const postIndices = indices.map(i => (i === null ? 0 : i + 1));
        const minIndex = Math.min(...postIndices);

        const bookmarks = await Topics.getTopicBookmarks(tid);

        const uidData = bookmarks.map(b => ({ uid: b.value, bookmark: parseInt(b.score, 10) }))
            .filter(data => data.bookmark >= minIndex);

        await async.eachLimit(uidData, 50, () => (async (data) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            let bookmark = Math.min(data.bookmark as number, maxIndex);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            postIndices.forEach((i) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (i < data.bookmark) {
                    bookmark -= 1;
                }
            });

            // make sure the bookmark is valid if we removed the last post
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            bookmark = Math.min(bookmark, maxIndex - pids.length);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (bookmark === data.bookmark) {
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const settings = await user.getSettings(data.uid) as { topicPostSort: string };
            if (settings.topicPostSort === 'most_votes') {
                return;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await Topics.setUserBookmark(tid, data.uid as number, bookmark);
        }));
    };
};

