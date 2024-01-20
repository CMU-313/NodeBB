// import LRU from 'lru-cache';
import LRU from 'lru-cache';
// lru-cache@7 deprecations
import winston from 'winston';
import chalk from 'chalk';
// pubsub import should occur after import of chalk
import pubsub from '../pubsub';

/* Can extend the key and value types here */
type keyType = string;
type valueType = string;

interface CacheBB {
    name ?: string;
    hits : number;
    misses : number;
    enabled ?: boolean;
    set : (key : keyType, value : valueType, ttl ?: number) => void;
    get : (key : keyType) => undefined | valueType;
    reset : () => void;
    clear : () => void;
    del : (keys : keyType[]) => void;
    delete : (keys : keyType[]) => void;
    getUnCachedKeys : (keys : keyType[], cachedData : Map<keyType, valueType>) => keyType[];
    dump : () => [ keyType, LRU.Entry<valueType> ][];
    peek : (key : keyType) => undefined | valueType;
}
type Opts = LRU.Options<keyType, valueType> & {name ?: string; enabled ?: boolean};

function cacheCreate(opts : Opts) {
    // sometimes we kept passing in `length` with no corresponding `maxSize`.
    // This is now enforced in v7; drop superfluous property
    if (opts.hasOwnProperty('length') && !opts.hasOwnProperty('maxSize')) {
        winston.warn(`[cache/init(${opts.name})] ${chalk.white.bgRed.bold('DEPRECATION')} ${chalk.yellow('length')} was passed in without a corresponding ${chalk.yellow('maxSize')}. Both are now required as of lru-cache@7.0.0.`);
        delete opts.length;
    }

    const deprecations = new Map<string, string>([
        ['stale', 'allowStale'],
        ['maxAge', 'ttl'],
        ['length', 'sizeCalculation'],
    ]);
    deprecations.forEach((newProp, oldProp) => {
        if (opts.hasOwnProperty(oldProp) && !opts.hasOwnProperty(newProp)) {
            winston.warn(`[cache/init(${opts.name})] ${chalk.white.bgRed.bold('DEPRECATION')} The option ${chalk.yellow(oldProp)} has been deprecated as of lru-cache@7.0.0. Please change this to ${chalk.yellow(newProp)} instead.`);
            /* Can pull the types of stale, maxAge, and length from the lru-cache documentation */
            opts[newProp] = opts[oldProp] as (boolean | number);
            delete opts[oldProp];
        }
    });

    const lruCache = new LRU<keyType, valueType>(opts);

    const cache = {} as CacheBB;
    cache.name = opts.name;
    cache.hits = 0;
    cache.misses = 0;
    cache.enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;

    // expose properties while keeping backwards compatibility
    const propertyMap = new Map([
        ['length', 'calculatedSize'],
        ['calculatedSize', 'calculatedSize'],
        ['max', 'max'],
        ['maxSize', 'maxSize'],
        ['itemCount', 'size'],
        ['size', 'size'],
        ['ttl', 'ttl'],
    ]);
    propertyMap.forEach((lruProp, cacheProp) => {
        Object.defineProperty(cache, cacheProp, {
            get: function () {
                return lruCache[lruProp] as valueType;
            },
            configurable: true,
            enumerable: true,
        });
    });

    cache.set = function (key, value, ttl ?: number) {
        if (!cache.enabled) {
            return;
        }
        const opts = ttl ? { ttl: ttl } : {};
        lruCache.set.apply(lruCache, [key, value, opts]);
    };

    cache.get = function (key) {
        if (!cache.enabled) {
            return undefined;
        }
        const data = lruCache.get(key);
        if (data === undefined) {
            cache.misses += 1;
        } else {
            cache.hits += 1;
        }
        return data;
    };

    cache.del = function (keys) {
        if (!Array.isArray(keys)) {
            keys = [keys];
        }
        pubsub.publish(`${cache.name}:lruCache:del`, keys);
        keys.forEach(key => lruCache.delete(key));
    };
    cache.delete = cache.del;

    function localReset() {
        lruCache.clear();
        cache.hits = 0;
        cache.misses = 0;
    }

    cache.reset = function () {
        pubsub.publish(`${cache.name}:lruCache:reset`);
        localReset();
    };
    cache.clear = cache.reset;

    pubsub.on(`${cache.name}:lruCache:reset`, () => {
        localReset();
    });

    pubsub.on(`${cache.name}:lruCache:del`, (keys : keyType[]) => {
        if (Array.isArray(keys)) {
            keys.forEach(key => lruCache.delete(key));
        }
    });

    cache.getUnCachedKeys = function (keys, cachedData) {
        if (!cache.enabled) {
            return keys;
        }
        let data : valueType | undefined;
        let isCached : boolean;
        const unCachedKeys = keys.filter((key) => {
            data = cache.get(key);
            isCached = data !== undefined;
            if (isCached) {
                cachedData[key] = data;
            }
            return !isCached;
        });

        const hits = keys.length - unCachedKeys.length;
        const misses = keys.length - hits;
        cache.hits += hits;
        cache.misses += misses;
        return unCachedKeys;
    };

    cache.dump = function () {
        return lruCache.dump();
    };

    cache.peek = function (key) {
        return lruCache.peek(key);
    };

    return cache;
}

export = cacheCreate;
