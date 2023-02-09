import _ from 'lodash';

import db from '../database';
import categories from '../categories';
import plugins from '../plugins';

export = function default_1(User) {
    // Unsafe member access .setCategoryWatchState on 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.setCategoryWatchState = async function (uid: string, cids: string[], state: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return;
        }
        const ws: number[] = categories.watchStates as number[];
        const isStateValid: boolean = Object.values(ws).includes(parseInt(state, 10));
        if (!isStateValid) {
            throw new Error('[[error:invalid-watch-state]]');
        }
        cids = Array.isArray(cids) ? cids : [cids];
        const exists: boolean[] = await categories.exists(cids) as boolean[];
        if (exists.includes(false)) {
            throw new Error('[[error:no-category]]');
        }
        // Unsafe member access .sortedSetsAdd on an 'any' value
        // Unsafe call of 'any' typed value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetsAdd(cids.map(cid => `cid:${cid}:uid:watch:state`), state, uid);
    };

    // Unsafe member access .getCategoryWatchState on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.getCategoryWatchState = async function (uid: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return {};
        }

        const cids: string[] = await categories.getAllCidsFromSet('categories:cid') as string[];
        // Unsafe call of an 'any' typed value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const states: string[] = await categories.getWatchState(cids, uid) as string[];
        return _.zipObject(cids, states);
    };

    // Unsafe member access .getIgnoredCategories on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.getIgnoredCategories = async function (uid: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return [];
        }

        // Unsafe member access .getCategoriesByStates on an 'any' value
        // Unsafe call of an 'any' typed value
        // Unsafe member access .ignoring on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const cids: string[] = await User.getCategoriesByStates(uid, [categories.watchStates.ignoring]) as string[];
        // Unsafe member access .cids on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return (await plugins.hooks.fire('filter:user.getIgnoredCategories', {
            uid: uid,
            cids: cids,
        })).cids as string;
    };

    // Unsafe member access .getWatchedCategories on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.getWatchedCategories = async function (uid: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return [];
        }

        // Unsafe member access .getCategoriesByStates on an 'any' value
        // Unsafe call of an 'any' typed value
        // Unsafe member access .watching on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const cids: string[] = await User.getCategoriesByStates(uid, [categories.watchStates.watching]) as string[];
        // Unsafe member access .cids on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return (await plugins.hooks.fire('filter:user.getWatchedCategories', {
            uid: uid,
            cids: cids,
        })).cids as string;
    };

    // Unsafe member access .getCategoriesByStates on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.getCategoriesByStates = async function (uid: string, states: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return await categories.getAllCidsFromSet('categories:cid') as string[];
        }
        const cids: string[] = await categories.getAllCidsFromSet('categories:cid') as string[];
        // Unsafe call of an 'any' typed value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userState: string = await categories.getWatchState(cids, uid) as string;
        return cids.filter((cid, index) => states.includes(userState[index]));
    };

    // Unsafe member access .ignoreCategory on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.ignoreCategory = async function (uid: string, cid: string[]) {
        // Unsafe member access .setCategoryWatchState on an 'any' value
        // Unsafe call of an 'any' typed value
        // Unsafe member access .ignoring on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await User.setCategoryWatchState(uid, cid, categories.watchStates.ignoring);
    };

    // Unsafe member access .watchCategory on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.watchCategory = async function (uid: string, cid: string[]) {
        // Unsafe member access .setCategoryWatchState on an 'any' value
        // Unsafe call of an 'any' typed value
        // Unsafe member access .watching on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await User.setCategoryWatchState(uid, cid, categories.watchStates.watching);
    };
}
