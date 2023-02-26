"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
const winston = require("winston");
const plugins = require("../plugins");
const db = require("../database");
const pubsub = require("../pubsub");
const navigationData = require("../../install/data/navigation.json");
const admin = module.exports;
let cache = null;
pubsub.on('admin:navigation:save', () => {
    cache = null;
});
function getAvailable() {
    return __awaiter(this, void 0, void 0, function* () {
        const core = navigationData.map((item) => {
            item.core = true;
            item.id = item.id || '';
            return item;
        });
        const navItems = yield plugins.hooks.fire('filter:navigation.available', core);
        navItems.forEach((item) => {
            if (item && !item.hasOwnProperty('enabled')) {
                item.enabled = true;
            }
        });
        return navItems;
    });
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
function toggleEscape(navItems, flag) {
    navItems.forEach((item) => {
        if (item) {
            fieldsToEscape.forEach((field) => {
                if (item.hasOwnProperty(field)) {
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    item[field] = validator[flag ? 'escape' : 'unescape'](String(item[field]));
                }
            });
        }
    });
}
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.save = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        const order = Object.keys(data);
        const bulkSet = [];
        data.forEach((item, index) => {
            item.order = order[index];
            if (item.hasOwnProperty('groups')) {
                item.groups = JSON.stringify(item.groups);
            }
            bulkSet.push([`navigation:enabled:${item.order}`, item]);
        });
        cache = null;
        pubsub.publish('admin:navigation:save');
        const ids = yield db.getSortedSetRange('navigation:enabled', 0, -1);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.deleteAll(ids.map(id => `navigation:enabled:${id}`));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.setObjectBulk(bulkSet);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.delete('navigation:enabled');
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.sortedSetAdd('navigation:enabled', order, order);
    });
};
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.getAdmin = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const [enabled, available] = yield Promise.all([
            admin.get(),
            getAvailable(),
        ]);
        return { enabled: enabled, available: available };
    });
};
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.escapeFields = navItems => toggleEscape(navItems, true);
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.unescapeFields = navItems => toggleEscape(navItems, false);
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
admin.get = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (cache) {
            return cache.map(item => (Object.assign({}, item)));
        }
        const ids = yield db.getSortedSetRange('navigation:enabled', 0, -1);
        const data = yield db.getObjects(ids.map((id) => `navigation:enabled:${id}`));
        cache = data.map((item) => {
            if (item.hasOwnProperty('groups')) {
                try {
                    item.groups = JSON.parse(item.groups);
                }
                catch (err) {
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
        return cache.map(item => (Object.assign({}, item)));
    });
};
require('../promisify')(admin);
