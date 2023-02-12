import winston from 'winston';
import os from 'os';
import nconf from 'nconf';

import pubsub from '../pubsub';
import slugify from '../slugify';

import configs from './configs';

import user from '../user';
import groups from '../groups';


/* Assorted */

function restart_helper() {
    if (process.send) {
        process.send({
            action: 'restart',
        });
    } else {
        winston.error('[meta.restart] Could not restart, are you sure NodeBB was started with `./nodebb start`?');
    }
}

export async function userOrGroupExists(slug : string) {
    if (!slug) {
        throw new Error('[[error:invalid-data]]');
    }
    const slugified : string = slugify(slug) as string;
    const [userExists, groupExists] = await Promise.all<[boolean, boolean]>([
        user.existsBySlug(slugified),
        groups.existsBySlug(slugified),
    ]);
    return userExists || groupExists;
}

if (nconf.get('isPrimary')) {
    pubsub.on('meta:restart', (data: { hostname: string; }) => {
        if (data.hostname !== os.hostname()) {
            restart_helper();
        }
    });
}
export function restart() {
    pubsub.publish('meta:restart', { hostname: os.hostname() });
    restart_helper();
}

export function getSessionTTLSeconds(): number {
    const ttlDays = 60 * 60 * 24 * configs.loginDays;
    const ttlSeconds : number = configs.loginSeconds as number;
    const ttl : number = ttlSeconds || ttlDays || 1209600; // Default to 14 days
    return ttl;
}
