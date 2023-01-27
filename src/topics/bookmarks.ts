import async from 'async';
import db from '../database';
import user from '../user';

interface topicObject{
    getUserBookmark(tid: number, uid: string) : Promise<number|null>;
    getUserBookmarks(tid: number[], uid: string) : Promise<number[]|null[]>;
    setUserBookmark(tid: number, uid: string, index: number) : Promise<void>;
    getTopicBookmarks(tid: number) : Promise<any>;
    getPostCount(tid: number) : Promise<number>;
    updateTopicBookmarks(tid: number, pid: number[]) : Promise<void>;
}

export default (Topics : topicObject) => {
    Topics.getUserBookmark = async function (tid: number, uid: string) : Promise<number|null> {
        if (parseInt(uid, 10) <= 0) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.sortedSetScore(`tid:${tid}:bookmarks`, uid) as number|null;
    };

    Topics.getUserBookmarks = async function (tids: number[], uid: string) : Promise<number[]|null[]> {
        if (parseInt(uid, 10) <= 0) {
            return tids.map<string>(() => null) as null[];
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.sortedSetsScore(tids.map(tid => `tid:${tid}:bookmarks`), uid) as number[]|null[];
    };

    Topics.setUserBookmark = async function (tid: number, uid: string, index: number) : Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(`tid:${tid}:bookmarks`, index, uid);
    };

    Topics.getTopicBookmarks = async function (tid: number) : Promise<any> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.getSortedSetRangeWithScores(`tid:${tid}:bookmarks`, 0, -1);
    };

    Topics.updateTopicBookmarks = async function (tid : number, pids : number[]) {
        const maxIndex : number = await Topics.getPostCount(tid);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const indices : Array<number | null> = await db.sortedSetRanks(`tid:${tid}:posts`, pids);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postIndices : Array<number | null> = indices.map((i : number | null) => (i === null ? 0 : i + 1));
        const minIndex : number = Math.min(...postIndices);

        const bookmarks = await Topics.getTopicBookmarks(tid);

        const uidData =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            bookmarks.map((b: { value: string, score: string; }) => ({ uid: b.value, bookmark: parseInt(b.score, 10) })).filter((data: { bookmark: number, uid: number; }) => data.bookmark >= minIndex);

        await async.eachLimit(uidData, 50, async (data: {bookmark: any, uid: string}) => {
            let bookmark = Math.min(data.bookmark, maxIndex);

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

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const settings = await user.getSettings(data.uid);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (settings.topicPostSort === 'most_votes') {
                return;
            }

            await Topics.setUserBookmark(tid, data.uid, bookmark);
        });
    };
};
