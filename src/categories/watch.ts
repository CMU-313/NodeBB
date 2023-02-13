import db from '../database';
import user from '../user';

import { SettingsObject } from '../types';

interface Categories {
    watchStates: { [x: string]: number; ignoring: number; notwatching: number; watching?: number; };
    isIgnored: (cids: number[], uid: string) => Promise<boolean[]>;
    getWatchState: (cids: number[], uid: string) => Promise<number[]>;
    getIgnorers: (cid: number, start: number, stop: number) => Promise<number[]>;
    filterIgnoringUids: (cid: number, uids: string[]) => Promise<string[]>;
    getUidsWatchStates: (cid: number, uids: string[]) => Promise<number[]>;
}

export = function (Categories: Categories) {
    Categories.watchStates = {
        ignoring: 1,
        notwatching: 2,
        watching: 3,
    };

    Categories.isIgnored = async function (cids: number[], uid: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return cids.map(() => false);
        }
        const states: number[] = await Categories.getWatchState(cids, uid);
        return states.map(state => state === Categories.watchStates.ignoring);
    };

    Categories.getWatchState = async function (cids: number[], uid: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return cids.map(() => Categories.watchStates.notwatching);
        }
        if (!Array.isArray(cids) || !cids.length) {
            return [];
        }
        const keys: string[] = cids.map(cid => `cid:${cid}:uid:watch:state`);
        const [userSettings, states]: [SettingsObject, number[]] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.getSettings(uid),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetsScore(keys, uid),
        ]) as [SettingsObject, number[]];
        return states.map(state => state || Categories.watchStates[userSettings.categoryWatchState]);
    };

    Categories.getIgnorers = async function (cid: number, start: number, stop: number) {
        const count: number = (stop === -1) ? -1 : (stop - start + 1);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const ignorers: number[] = await db.getSortedSetRevRangeByScore(`cid:${cid}:uid:watch:state`, start, count, Categories.watchStates.ignoring, Categories.watchStates.ignoring) as number[];
        return ignorers;
    };

    Categories.filterIgnoringUids = async function (cid: number, uids: string[]) {
        const states: number[] = await Categories.getUidsWatchStates(cid, uids);
        const readingUids = uids.filter((uid, index) => uid && states[index] !== Categories.watchStates.ignoring);
        return readingUids;
    };

    Categories.getUidsWatchStates = async function (cid: number, uids: string[]) {
        const [userSettings, states]: [SettingsObject, number[]] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.getMultipleUserSettings(uids),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetScores(`cid:${cid}:uid:watch:state`, uids),
        ]) as [SettingsObject, number[]];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return states.map((state, index) => state || Categories.watchStates[userSettings[index].categoryWatchState]);
    };
};
