"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const categories_1 = __importDefault(require("../categories"));
const plugins_1 = __importDefault(require("../plugins"));
function default_1(User, db) {
    // Unsafe member access .setCategoryWatchState on 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.setCategoryWatchState = async function (uid, cids, state) {
        if (!(parseInt(uid, 10) > 0)) {
            return;
        }
        const ws = categories_1.default.watchStates;
        const isStateValid = Object.values(ws).includes(parseInt(state, 10));
        if (!isStateValid) {
            throw new Error('[[error:invalid-watch-state]]');
        }
        cids = Array.isArray(cids) ? cids : [cids];
        const exists = await categories_1.default.exists(cids);
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
    User.getCategoryWatchState = async function (uid) {
        if (!(parseInt(uid, 10) > 0)) {
            return {};
        }
        const cids = await categories_1.default.getAllCidsFromSet('categories:cid');
        // Unsafe call of an 'any' typed value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const states = await categories_1.default.getWatchState(cids, uid);
        return lodash_1.default.zipObject(cids, states);
    };
    // Unsafe member access .getIgnoredCategories on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.getIgnoredCategories = async function (uid) {
        if (!(parseInt(uid, 10) > 0)) {
            return [];
        }
        // Unsafe member access .getCategoriesByStates on an 'any' value
        // Unsafe call of an 'any' typed value
        // Unsafe member access .ignoring on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const cids = await User.getCategoriesByStates(uid, [categories_1.default.watchStates.ignoring]);
        // Unsafe member access .cids on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return (await plugins_1.default.hooks.fire('filter:user.getIgnoredCategories', {
            uid: uid,
            cids: cids,
        })).cids;
    };
    // Unsafe member access .getWatchedCategories on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.getWatchedCategories = async function (uid) {
        if (!(parseInt(uid, 10) > 0)) {
            return [];
        }
        // Unsafe member access .getCategoriesByStates on an 'any' value
        // Unsafe call of an 'any' typed value
        // Unsafe member access .watching on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const cids = await User.getCategoriesByStates(uid, [categories_1.default.watchStates.watching]);
        // Unsafe member access .cids on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return (await plugins_1.default.hooks.fire('filter:user.getWatchedCategories', {
            uid: uid,
            cids: cids,
        })).cids;
    };
    // Unsafe member access .getCategoriesByStates on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.getCategoriesByStates = async function (uid, states) {
        if (!(parseInt(uid, 10) > 0)) {
            return await categories_1.default.getAllCidsFromSet('categories:cid');
        }
        const cids = await categories_1.default.getAllCidsFromSet('categories:cid');
        // Unsafe call of an 'any' typed value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userState = await categories_1.default.getWatchState(cids, uid);
        return cids.filter((cid, index) => states.includes(userState[index]));
    };
    // Unsafe member access .ignoreCategory on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.ignoreCategory = async function (uid, cid) {
        // Unsafe member access .setCategoryWatchState on an 'any' value
        // Unsafe call of an 'any' typed value
        // Unsafe member access .ignoring on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await User.setCategoryWatchState(uid, cid, categories_1.default.watchStates.ignoring);
    };
    // Unsafe member access .watchCategory on an 'any' value
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    User.watchCategory = async function (uid, cid) {
        // Unsafe member access .setCategoryWatchState on an 'any' value
        // Unsafe call of an 'any' typed value
        // Unsafe member access .watching on an 'any' value
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await User.setCategoryWatchState(uid, cid, categories_1.default.watchStates.watching);
    };
}
exports.default = default_1;
