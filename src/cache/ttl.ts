import TTLCache = require('@isaacs/ttlcache');
import pubsub = require('../pubsub');

interface Options {
    name?: string,
    ttl?: number,
    enabled?: boolean,
}

interface Cache {
    name?: string,
    hits: number,
    misses: number,
    enabled: boolean,
    set: (key: string, value: number, ttl: number) => void,
    get: (key: string) => number,
    del: (keys: string[]) => void,
    delete: (keys: string[]) => void,
    reset: () => void,
    clear: () => void,
    getUnCachedKeys: (keys: string[], cachedData: Record<string, number>) => string[]
    dump: () => [string, number][],
    peek: (key: string) => number,
}

export = function (opts: Options) {
    const ttlCache = new TTLCache<string, number>(opts);

    const cache = {} as Cache;
    cache.name = opts.name;
    cache.hits = 0;
    cache.misses = 0;
    cache.enabled = opts.hasOwnProperty('enabled') ? opts.enabled : true;

    // expose properties
    const propertyMap = new Map([
        ['max', 'max'],
        ['itemCount', 'size'],
        ['size', 'size'],
        ['ttl', 'ttl'],
    ]);
    propertyMap.forEach((ttlProp, cacheProp) => {
        Object.defineProperty(cache, cacheProp, {
            get: function () {
                return ttlCache[ttlProp] as number;
            },
            configurable: true,
            enumerable: true,
        });
    });

    cache.set = function (key, value, ttl) {
        if (!cache.enabled) {
            return;
        }
        const opts = {} as Options;
        if (ttl) {
            opts.ttl = ttl;
        }
        ttlCache.set.apply(ttlCache, [key, value, opts]);
    };

    cache.get = function (key) {
        if (!cache.enabled) {
            return undefined;
        }
        const data = ttlCache.get(key);
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
        pubsub.publish(`${cache.name}:ttlCache:del`, keys);
        keys.forEach(key => ttlCache.delete(key));
    };
    cache.delete = cache.del;

    function localReset() {
        ttlCache.clear();
        cache.hits = 0;
        cache.misses = 0;
    }

    cache.reset = function () {
        pubsub.publish(`${cache.name}:ttlCache:reset`);
        localReset();
    };
    cache.clear = cache.reset;

    pubsub.on(`${cache.name}:ttlCache:reset`, () => {
        localReset();
    });

    pubsub.on(`${cache.name}:ttlCache:del`, (keys: string[]) => {
        if (Array.isArray(keys)) {
            keys.forEach(key => ttlCache.delete(key));
        }
    });

    cache.getUnCachedKeys = function (keys, cachedData) {
        if (!cache.enabled) {
            return keys;
        }
        let data;
        let isCached;
        const unCachedKeys = keys.filter((key) => {
            data = cache.get(key);
            isCached = data !== undefined;
            if (isCached) {
                cachedData[key] = data as number;
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
        return Array.from(ttlCache.entries());
    };

    cache.peek = function (key) {
        return ttlCache.get(key, { updateAgeOnGet: false });
    };

    return cache;
};
