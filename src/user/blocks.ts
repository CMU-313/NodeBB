import db = require('../database');
import plugins = require('../plugins');
import cacheCreate = require('../cache/lru');

interface CustomCache {
    name: string;
    enabled: boolean;
    set(key: string, value: any, ttl?: number): void;
    get(key: string): any;
    del(keys: string | string[]): void;
    reset(): void;
    clear(): void;
    getUnCachedKeys(keys: string[], cachedData: any): string[];
}

interface User {
    blocks: UserBlocks;
    isAdminOrGlobalMod(uid: string): Promise<boolean>;
    incrementUserFieldBy(uid: string, field: string, incrementBy: number): Promise<void>;
    decrementUserFieldBy(uid: string, field: string, incrementBy: number): Promise<void>;
}

interface UserBlocks {
    _cache: CustomCache; // Add type for cache object
    is: (targetUid: string, uids: string | string[]) => Promise<boolean | boolean[]>;
    can: (callerUid: string, blockerUid: string | number, blockeeUid: number, type: 'block' | 'unblock') => Promise<void>;
    list: (uids: string[]) => Promise<number[] | number[][]>;
    add: (targetUid: number, uid: string) => Promise<void>;
    remove: (targetUid: number, uid: string) => Promise<void>;
    applyChecks: (type: 'block' | 'unblock', targetUid: number, uid: string) => Promise<void>;
    filterUids: (targetUid: string, uids: string[]) => Promise<string[]>;
    filter: (uid: string[], property?: number, set?: any[]) => Promise<any[]>;
}

interface CachedData {
    [key: string]: number[]; // Assuming keys are strings, adjust as needed
}
interface FilteredData {
    set: string[];
}

function blockFunction(User: User) {
    User.blocks = {
        _cache: cacheCreate({
            name: 'user:blocks',
            max: 100,
            ttl: 0,
        }),
        is: async function (targetUid:string, uids:string | string[]) {
            const isArray = Array.isArray(uids);
            const newUids:string[] = isArray ? uids : [uids];
            const blocks = await User.blocks.list(newUids);
            const isBlocked = newUids.map((uid, index) => {
                const blockList = blocks[index];

                if (Array.isArray(blockList)) {
                    // Type guard to ensure blockList is treated as an array
                    const isUidBlocked = blockList.includes(parseInt(targetUid, 10) || 0);
                    return isUidBlocked;
                }
                // Handle the case where blockList is undefined or not an array
                return false; // or handle it in a way that makes sense for your application
            });
            return isArray ? isBlocked : isBlocked[0];
        },
        can: async function (callerUid:string, blockerUid:string|number, blockeeUid:number, type) {
            // Guests can't block
            if (blockerUid === 0 || blockeeUid === 0) {
                throw new Error('[[error:cannot-block-guest]]');
            } else if (blockerUid === blockeeUid) {
                throw new Error('[[error:cannot-block-self]]');
            }
            // Administrators and global moderators cannot be blocked
            // Only admins/mods can block users as another user
            const [isCallerAdminOrMod, isBlockeeAdminOrMod] = await Promise.all([
                User.isAdminOrGlobalMod(callerUid),
                User.isAdminOrGlobalMod(String(blockeeUid)),
            ]);
            if (isBlockeeAdminOrMod && type === 'block') {
                throw new Error('[[error:cannot-block-privileged]]');
            }
            // Changed to account for types of blockerUid
            let parsedBlockerUid: number;
            if (typeof blockerUid === 'string') {
                parsedBlockerUid = parseInt(blockerUid, 10);
            } else {
                parsedBlockerUid = blockerUid;
            }

            if (parseInt(callerUid, 10) !== parsedBlockerUid && !isCallerAdminOrMod) {
                throw new Error('[[error:no-privileges]]');
            }
        },
        list: async function (uids:string[]) {
            const isArray = Array.isArray(uids);
            let processedUids:string[];
            if (isArray) {
                processedUids = Array.isArray(uids) ? uids : [uids];
            } else {
                processedUids = [uids];
            }
            // Changed assigned newUids instead of passing it to uids
            const newUids:number[] = processedUids.map(uid => parseInt(uid, 10));

            const cachedData :CachedData = {};
            const unCachedUids = User.blocks._cache.getUnCachedKeys(uids, cachedData);
            if (unCachedUids.length) {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment
                const unCachedData: string[][] = await db.getSortedSetsMembers(
                    unCachedUids.map(uid => `uid:${uid}:blocked_uids`)
                );

                unCachedUids.forEach((uid, index) => {
                    cachedData[uid] = (unCachedData[index] || []).map((uid: string) => parseInt(uid, 10));
                    User.blocks._cache.set(uid, cachedData[uid]);
                });
            }
            const result = newUids.map(uid => cachedData[uid] || []);
            return isArray ? result.slice() : result[0];
        },
        add: async function (targetUid, uid:string) {
            await User.blocks.applyChecks('block', targetUid, uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`uid:${uid}:blocked_uids`, Date.now(), targetUid);
            await User.incrementUserFieldBy(uid, 'blocksCount', 1);
            User.blocks._cache.del(uid);
            // void plugins.hooks.fire('action:user.blocks.add', { uid: uid, targetUid: targetUid });
            plugins.hooks
                .fire('action:user.blocks.add', { uid: uid, targetUid: targetUid })
                .then(() => {
                    // Handle success if necessary
                })
                .catch((_) => {
                    // Handle the error if necessary
                });
        },
        remove: async function (targetUid, uid:string) {
            await User.blocks.applyChecks('unblock', targetUid, uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetRemove(`uid:${uid}:blocked_uids`, targetUid);
            await User.decrementUserFieldBy(uid, 'blocksCount', 1);
            User.blocks._cache.del(uid);
            plugins.hooks
                .fire('action:user.blocks.remove', { uid: uid, targetUid: targetUid })
                .then(() => {
                    // Handle success if necessary
                })
                .catch((_) => {
                    // Handle the error if necessary
                });
        },
        applyChecks: async function (type, targetUid, uid) {
            await User.blocks.can(uid, uid, targetUid, type);
            const isBlock = type === 'block';
            const is = await User.blocks.is(String(targetUid), uid);
            if (is === isBlock) {
                throw new Error(`[[error:already-${isBlock ? 'blocked' : 'unblocked'}]]`);
            }
        },
        filterUids: async function (targetUid:string, uids:string[]) {
            const isBlocked = await User.blocks.is(targetUid, uids);
            return uids.filter((uid, index) => !isBlocked[index]);// bug
        },
        filter: async function (uid:string[], property:number, set:string[]) {
            // Set might also potentially be number[]
            // Given whatever is passed in, iterates through it, and removes entries made by blocked uids
            // property is optional
            if (Array.isArray(property) && typeof set === 'undefined') {
                set = property;
                // property = 'uid'; //removed since property is already a number
            }
            // Assume property is number
            if (!Array.isArray(set) || !set.length) {
                return set;
            }
            // Ensure that set is an array before using the filter method
            if (!Array.isArray(set)) {
                set = [set];
            }
            const isPlain = typeof set[0] !== 'object';
            const blocked_uids = await User.blocks.list(uid);
            const flatBlockedUids = [].concat(...blocked_uids);
            const blockedSet = new Set(flatBlockedUids);
            set = set.filter(item => !blockedSet.has(parseInt(isPlain ? item : (item && item[property]), 10)));
            // Use set.filter only if set is an array
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const data:FilteredData = await plugins.hooks.fire('filter:user.blocks.filter', { set: set, property: property, uid: uid, blockedSet: blockedSet });
            return data.set;
        },
    };
}

module.exports = blockFunction;
