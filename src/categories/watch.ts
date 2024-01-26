import db from '../database';
import user from '../user';

interface CatInterface {
    watchStates: { ignoring: number, notwatching: number, watching: number },
    isIgnored: (cids: string[], uid: string) => Promise<boolean[]>,
    getWatchState: (cids: string[], uid: string) => Promise<number[]>,
    getIgnorers: (cid: string, start: number, stop: number) => Promise<{value: string}>,
    filterIgnoringUids: (cids: string, uid: string[]) => Promise<string[]>,
    getUidsWatchStates: (cids: string, uid: string[]) => Promise<number[]>
}

interface UserSettings {
    showemail: boolean;
    showfullname: boolean;
    openOutgoingLinksInNewTab: boolean;
    dailyDigestFreq: string;
    usePagination: boolean;
    topicsPerPage: number;
    postsPerPage: number;
    userLang: string;
    acpLang: string;
    topicPostSort: string;
    categoryTopicSort: string;
    followTopicsOnCreate: boolean;
    followTopicsOnReply: boolean;
    upvoteNotifFreq: string;
    restrictChat: boolean;
    topicSearchEnabled: boolean;
    updateUrlWithPostIndex: boolean;
    bootswatchSkin: string;
    homePageRoute: string;
    scrollToMyPost: boolean;
    categoryWatchState: string;
}

export default function (Categories: CatInterface) {
    Categories.watchStates = {
        ignoring: 1,
        notwatching: 2,
        watching: 3,
    };
    Categories.isIgnored = async function (cids, uid) {
        if (!(parseInt(uid, 10) > 0)) {
            return cids.map(() => false);
        }
        const states = await Categories.getWatchState(cids, uid);
        return states.map(state => state === Categories.watchStates.ignoring);
    };
    Categories.getWatchState = async function (cids, uid) {
        if (!(parseInt(uid, 10) > 0)) {
            return cids.map(() => Categories.watchStates.notwatching);
        }
        if (!Array.isArray(cids) || !cids.length) {
            return [];
        }
        const keys = cids.map(cid => `cid:${cid}:uid:watch:state`);
        const [userSettings, states] = await Promise.all([
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        user.getSettings(uid) as Promise<UserSettings>,
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.sortedSetsScore(keys, uid) as Promise<number[]>,
        ]);

        function mapFun(state: number) {
            return state || (Categories.watchStates[userSettings.categoryWatchState] as number);
        }
        return states.map(mapFun);
    };
    Categories.getIgnorers = async function (cid, start, stop) {
        const count = (stop === -1) ? -1 : (stop - start + 1);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const res = await db.getSortedSetRevRangeByScore(`cid:${cid}:uid:watch:state`, start, count, Categories.watchStates.ignoring, Categories.watchStates.ignoring) as {value: string};
        return res;
    };
    Categories.filterIgnoringUids = async function (cid, uids) {
        const states = await Categories.getUidsWatchStates(cid, uids);
        const readingUids = uids.filter((uid, index) => uid && states[index] !== Categories.watchStates.ignoring);
        return readingUids;
    };
    Categories.getUidsWatchStates = async function (cid, uids) {
        const [userSettings, states] = await Promise.all([
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        user.getMultipleUserSettings(uids) as Promise<UserSettings[]>,
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.sortedSetScores(`cid:${cid}:uid:watch:state`, uids) as Promise<number[]>,
        ]);

        function mapFun(state: number, index: number) {
            return state || (Categories.watchStates[userSettings[index].categoryWatchState] as number);
        }
        return states.map(mapFun);
    };
}

