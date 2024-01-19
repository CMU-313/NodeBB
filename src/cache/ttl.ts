import TTLCache, { Options } from '@isaacs/ttlcache';
import pubsub from '../pubsub';

export default function <K extends string | number | symbol = string | number | symbol, V = unknown>
(opts: Options<K, V> & { name: string, enabled?: boolean }) {
    const ttlCache: TTLCache<K, V> = new TTLCache(opts);

    const cache: {
        name: string,
        hits: number,
        misses: number,
        enabled: boolean,
        set: (key: K, value: V, ttl: number) => void,
        get: (key: K) => V | undefined;
        del: (keys: K | K[]) => void,
        delete: (keys: K | K[]) => void,
        reset: () => void,
        clear: () => void,
        getUnCachedKeys: (keys: K[], cachedData: Record<K, V>) => K[],
        dump: () => [K, V][],
        peek: (key: K) => V,
        purgeStale: () => boolean,
        size: number,
        getRemainingTTL: (key: K) => number,
        has: (key: K) => boolean,
        setTTL: (key: K, ttl?: number) => void,
        entries: () => Generator<[K, V]>,
        keys: () => Generator<K>,
        values: () => Generator<V>,
        [Symbol.iterator](): Iterator<[K, V]>,
    } = {
        name: opts.name,
        hits: 0,
        misses: 0,
        enabled: opts?.enabled ?? true,
        set: function (key: K, value: V, ttl: number): void {
            if (!cache.enabled) {
                return;
            }
            const opts: TTLCache.SetOptions = {};
            if (ttl) {
                opts.ttl = ttl;
            }
            ttlCache.set.apply(ttlCache, [key, value, opts]);
        },
        get: function (key: K): V | undefined {
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
        },
        del: function (keys: K | K[]): void {
            if (!Array.isArray(keys)) {
                const keysArr: K[] = [keys];
                pubsub.publish(`${cache.name}:ttlCache:del`, keysArr);
                keysArr.forEach(key => ttlCache.delete(key));
            } else {
                pubsub.publish(`${cache.name}:ttlCache:del`, keys);
                keys.forEach(key => ttlCache.delete(key));
            }
        },
        delete: function (keys: K | K[]): void {
            if (!Array.isArray(keys)) {
                const keysArr: K[] = [keys];
                pubsub.publish(`${cache.name}:ttlCache:del`, keysArr);
                keysArr.forEach(key => ttlCache.delete(key));
            } else {
                pubsub.publish(`${cache.name}:ttlCache:del`, keys);
                keys.forEach(key => ttlCache.delete(key));
            }
        },
        reset: function (): void {
            pubsub.publish(`${cache.name}:ttlCache:reset`);
            ttlCache.clear();
            cache.hits = 0;
            cache.misses = 0;
        },
        clear: function (): void {
            pubsub.publish(`${cache.name}:ttlCache:reset`);
            ttlCache.clear();
            cache.hits = 0;
            cache.misses = 0;
        },
        getUnCachedKeys: function (keys: K[], cachedData: Record<K, V>): K[] {
            if (!cache.enabled) {
                return keys;
            }
            let data: V | undefined;
            let isCached: boolean;
            const unCachedKeys: K[] = keys.filter((key: K) => {
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
        },
        dump: function (): [K, V][] {
            return Array.from(ttlCache.entries());
        },
        peek: function (key: K): V {
            return ttlCache.get(key, { updateAgeOnGet: false });
        },
        purgeStale: () => ttlCache.purgeStale(),
        size: ttlCache.size,
        getRemainingTTL: (key: K) => ttlCache.getRemainingTTL(key),
        has: (key: K) => ttlCache.has(key),
        setTTL: (key: K, ttl?: number) => ttlCache.setTTL(key, ttl),
        entries: () => ttlCache.entries(),
        keys: () => ttlCache.keys(),
        values: () => ttlCache.values(),
        [Symbol.iterator]: () => ttlCache[Symbol.iterator](),
    };
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
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return ttlCache[ttlProp];
            },
            configurable: true,
            enumerable: true,
        });
    });

    pubsub.on(`${cache.name}:ttlCache:reset`, () => {
        ttlCache.clear();
        cache.hits = 0;
        cache.misses = 0;
    });

    pubsub.on(`${cache.name}:ttlCache:del`, (keys: K[]) => {
        if (Array.isArray(keys)) {
            keys.forEach(key => ttlCache.delete(key));
        }
    });

    return cache;
}
