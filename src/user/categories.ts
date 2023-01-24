import _ from 'lodash';

import db from '../database';
import categories from '../categories';
import plugins from '../plugins';

export default function (User) {
    User.setCategoryWatchState = async function (uid: string, cids: string[], state: string) : Promise<categories> {
        if (!(parseInt(uid, 10) > 0)) {
            return;
        }
        const isStateValid: boolean = Object.values(categories.watchStates).includes(parseInt(state, 10));
        if (!isStateValid) {
            throw new Error('[[error:invalid-watch-state]]');
        }
        cids = Array.isArray(cids) ? cids : [cids];
        const exists: boolean[] = await categories.exists(cids);
        if (exists.includes(false)) {
            throw new Error('[[error:no-category]]');
        }
        await db.sortedSetsAdd(cids.map(cid => `cid:${cid}:uid:watch:state`), state, uid);
    };

    User.getCategoryWatchState = async function (uid: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return {};
        }

        const cids: string[] = await categories.getAllCidsFromSet('categories:cid');
        const states: string[] = await categories.getWatchState(cids, uid);
        return _.zipObject(cids, states);
    };

    User.getIgnoredCategories = async function (uid: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return [];
        }
        const cids: string[] = await User.getCategoriesByStates(uid, [categories.watchStates.ignoring]);
        const result = await plugins.hooks.fire('filter:user.getIgnoredCategories', {
            uid: uid,
            cids: cids,
        });
        return result.cids;
    };

    User.getWatchedCategories = async function (uid: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return [];
        }
        const cids: string[] = await User.getCategoriesByStates(uid, [categories.watchStates.watching]);
        const result = await plugins.hooks.fire('filter:user.getWatchedCategories', {
            uid: uid,
            cids: cids,
        });
        return result.cids;
    };

    User.getCategoriesByStates = async function (uid: string, states: string) {
        if (!(parseInt(uid, 10) > 0)) {
            return await categories.getAllCidsFromSet('categories:cid');
        }
        const cids = await categories.getAllCidsFromSet('categories:cid');
        const userState = await categories.getWatchState(cids, uid);
        return cids.filter((cid, index) => states.includes(userState[index]));
    };

    User.ignoreCategory = async function (uid: string, cid: string[]) {
        await User.setCategoryWatchState(uid, cid, categories.watchStates.ignoring);
    };

    User.watchCategory = async function (uid: string, cid: string[]) {
        await User.setCategoryWatchState(uid, cid, categories.watchStates.watching);
    };
};
