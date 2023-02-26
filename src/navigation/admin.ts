import validator = require('validator');
import winston = require('winston');
import plugins = require('../plugins');
import db = require('../database');
import pubsub = require('../pubsub');
import navigationData = require('../../install/data/navigation.json');

const admin = module.exports;
interface cacheI {

}

let cache : dataItemI[]= null;

pubsub.on('admin:navigation:save', () => {
    cache = null;
});

interface navigation {
    route: string;
    title: string;
    enabled: boolean;
    iconClass: string;
    textClass: string;
    text: string;
    id?: undefined;
    groups?: undefined;
    core?: boolean
}

interface navigation1 {
    id: string;
    route: string;
    title: string;
    enabled: boolean;
    iconClass: string;
    textClass: string;
    text: string;
    groups: string[];
    core: boolean;
}

interface navI {
    enabled?: boolean
    field? : string
}

async function getAvailable() {
    const core: (navigation | navigation1)[] = navigationData.map(
        (item: navigation | navigation1) => {
            item.core = true;
            item.id = item.id || '';
            return item;
        }
    );
    const navItems : navI[] = await plugins.hooks.fire(
        'filter:navigation.available',
        core
    );

    navItems.forEach((item) => {
        if (item && !item.hasOwnProperty('enabled')) {
            item.enabled = true;
        }
    });
    return navItems;
}

const fieldsToEscape = [
    'iconClass',
    'class',
    'route',
    'id',
    'text',
    'textClass',
    'title',
];

function toggleEscape(navItems : navI[], flag: boolean) {
    navItems.forEach((item : navI) => {
        if (item) {
            fieldsToEscape.forEach((field : string) => {
                if (item.hasOwnProperty(field)) {
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    item[field] = validator[flag ? 'escape' : 'unescape'](
                        String(item[field])
                    );
                }
            });
        }
    });
}
interface dataItemI {
    order: string;
    groups: string;
}
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.save = async function (data : dataItemI[]) {
    const order = Object.keys(data);
    const bulkSet = [];
    data.forEach((item: dataItemI, index) => {
        item.order = order[index];
        if (item.hasOwnProperty('groups')) {
            item.groups = JSON.stringify(item.groups);
        }
        bulkSet.push([`navigation:enabled:${item.order}`, item]);
    });

    cache = null;
    pubsub.publish('admin:navigation:save');
    const ids: string[] = await db.getSortedSetRange(
        'navigation:enabled',
        0,
        -1
    );
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.deleteAll(ids.map(id => `navigation:enabled:${id}`));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.setObjectBulk(bulkSet);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.delete('navigation:enabled');
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.sortedSetAdd('navigation:enabled', order, order);
};

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.getAdmin = async function () {
    const [enabled, available] = await Promise.all([
        admin.get(),
        getAvailable(),
    ]);
    return { enabled: enabled, available: available };
};

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.escapeFields = navItems => toggleEscape(navItems, true);

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.unescapeFields = navItems => toggleEscape(navItems, false);

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.get = async function () : Promise<dataItemI[]> {
    if (cache) {
        return cache.map(item => ({ ...item }));
    }
    const ids = await db.getSortedSetRange('navigation:enabled', 0, -1);
    const data = await db.getObjects(ids.map((id) => `navigation:enabled:${id}`));
    cache = data.map((item) => {
        if (item.hasOwnProperty('groups')) {
            try {
                item.groups = JSON.parse(item.groups);
            } catch (err) {
                winston.error(err.stack);
                item.groups = [];
            }
        }
        item.groups = item.groups || [];
        if (item.groups && !Array.isArray(item.groups)) {
            item.groups = [item.groups];
        }
        return item;
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call

    admin.escapeFields(cache);

    return cache.map(item => ({ ...item }));
};

require('../promisify')(admin);

