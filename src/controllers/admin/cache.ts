import { Request, Response, NextFunction } from 'express';
import utils from '../../utils';
import plugins from '../../plugins';

import postCache from '../../posts/cache';
import groupCache from '../../groups';
import { objectCache } from '../../database';
import localCache from '../../cache';

interface Cache {
    length: number;
    max: number;
    maxSize: number;
    itemCount: number;
    name?: string;
    hits: number;
    misses: number;
    enabled: boolean;
    ttl: number;
    dump: () => unknown;
}

interface CacheInfo {
    length: number;
    max: number;
    maxSize: number;
    itemCount: number;
    percentFull: string;
    hits: string;
    misses: string;
    hitRatio: string;
    enabled: boolean;
    ttl: number;
}

interface CacheDisplay {
    [key: string]: CacheInfo;
}

const cacheController = {
    get: async function (req: Request, res: Response): Promise<void> {
        function getInfo(cache: Cache): CacheInfo {
            return {
                length: cache.length,
                max: cache.max,
                maxSize: cache.maxSize,
                itemCount: cache.itemCount,
                percentFull: cache.name === 'post' ?
                    ((cache.length / cache.maxSize) * 100).toFixed(2) :
                    ((cache.itemCount / cache.max) * 100).toFixed(2),
                hits: utils.addCommas(String(cache.hits)),
                misses: utils.addCommas(String(cache.misses)),
                hitRatio: ((cache.hits / (cache.hits + cache.misses) || 0) * 100).toFixed(2),
                enabled: cache.enabled,
                ttl: cache.ttl,
            };
        }

        let caches: { [key: string]: Cache } = {
            post: postCache,
            group: groupCache,
            local: localCache,
        };

        if (objectCache) {
            caches.object = objectCache as Cache;
        }

        const cacheDisplay: CacheDisplay = {};

        for (const [key, value] of Object.entries(caches)) {
            cacheDisplay[key] = getInfo(value);
        }

        caches = await plugins.hooks.fire('filter:admin.cache.get', caches) as typeof caches;

        res.render('admin/advanced/cache', { caches: cacheDisplay });
    },

    dump: async function (req: Request, res: Response, next: NextFunction): Promise<void> {
        let caches: { [key: string]: Cache } = {
            post: postCache,
            object: objectCache as Cache,
            group: groupCache,
            local: localCache,
        };

        caches = await plugins.hooks.fire('filter:admin.cache.get', caches) as typeof caches;

        const cache = caches[req.query.name as string];
        if (!cache) {
            return next();
        }

        const cacheName = typeof req.query.name === 'string' ? req.query.name : 'default';
        const data = JSON.stringify(cache.dump(), null, 4);
        res.setHeader('Content-disposition', `attachment; filename=${cacheName}-cache.json`);
        res.setHeader('Content-type', 'application/json');
        res.write(data, (err) => {
            if (err) {
                return next(err);
            }
            res.end();
        });
    },
};

export default cacheController;
