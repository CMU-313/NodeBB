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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.merge = exports.prune = exports.markAllRead = exports.markReadMultiple = exports.markUnread = exports.markRead = exports.rescind = exports.pushGroups = exports.pushGroup = exports.push = exports.create = exports.findRelated = exports.filterExists = exports.getMultiple = exports.get = exports.startJobs = exports.getAllNotificationTypes = exports.privilegedTypes = exports.baseTypes = void 0;
const async_1 = __importDefault(require("async"));
const winston_1 = __importDefault(require("winston"));
const cron_1 = __importDefault(require("cron"));
// const cron = require('cron').CronJob; HERE
const nconf_1 = __importDefault(require("nconf"));
const lodash_1 = __importDefault(require("lodash"));
const database_1 = __importDefault(require("./database"));
const user_1 = __importDefault(require("./user"));
const posts_1 = __importDefault(require("./posts"));
const groups_1 = __importDefault(require("./groups"));
const meta_1 = __importDefault(require("./meta"));
const batch_1 = __importDefault(require("./batch"));
const plugins_1 = __importDefault(require("./plugins"));
const utils_1 = __importDefault(require("./utils"));
const emailer_1 = __importDefault(require("./emailer"));
exports.baseTypes = [
    'notificationType_upvote',
    'notificationType_new-topic',
    'notificationType_new-reply',
    'notificationType_post-edit',
    'notificationType_follow',
    'notificationType_new-chat',
    'notificationType_new-group-chat',
    'notificationType_group-invite',
    'notificationType_group-leave',
    'notificationType_group-request-membership',
];
exports.privilegedTypes = [
    'notificationType_new-register',
    'notificationType_post-queue',
    'notificationType_new-post-flag',
    'notificationType_new-user-flag',
];
const notificationPruneCutoff = 2592000000; // one month
function getAllNotificationTypes() {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const results = yield plugins_1.default.hooks.fire('filter:user.notificationTypes', {
            types: exports.baseTypes.slice(),
            privilegedTypes: exports.privilegedTypes.slice(),
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return results.types.concat(results.privilegedTypes);
    });
}
exports.getAllNotificationTypes = getAllNotificationTypes;
function startJobs() {
    winston_1.default.verbose('[notifications.init] Registering jobs.');
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    new cron_1.default('*/30 * * * *', prune, null, true);
}
exports.startJobs = startJobs;
function get(nid) {
    return __awaiter(this, void 0, void 0, function* () {
        const notifications = yield getMultiple([nid]);
        return Array.isArray(notifications) && notifications.length ? notifications[0] : null;
    });
}
exports.get = get;
function getMultiple(nids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(nids) || !nids.length) {
            return [];
        }
        const keys = nids.map(nid => `notifications:${nid}`);
        const notifications = yield database_1.default.getObjects(keys);
        const userKeys = notifications.map(n => n && n.from);
        const usersData = yield user_1.default.getUsersFields(userKeys, ['username', 'userslug', 'picture']);
        notifications.forEach((notification, index) => {
            if (notification) {
                if (notification.path && !notification.path.startsWith('http')) {
                    notification.path = nconf_1.default.get('relative_path') + notification.path;
                }
                notification.datetimeISO = utils_1.default.toISOString(notification.datetime);
                if (notification.bodyLong) {
                    notification.bodyLong = utils_1.default.stripHTMLTags(notification.bodyLong, ['img', 'p', 'a']);
                }
                notification.user = usersData[index];
                if (notification.user) {
                    notification.image = notification.user.picture || null;
                    if (notification.user.username === '[[global:guest]]') {
                        notification.bodyShort = notification.bodyShort.replace(/([\s\S]*?),[\s\S]*?,([\s\S]*?)/, '$1, [[global:guest]], $2');
                    }
                }
                else if (notification.image === 'brand:logo' || !notification.image) {
                    notification.image = meta_1.default.config['brand:logo'] || `${nconf_1.default.get('relative_path')}/logo.png`;
                }
            }
        });
        return notifications;
    });
}
exports.getMultiple = getMultiple;
function filterExists(nids) {
    return __awaiter(this, void 0, void 0, function* () {
        const exists = yield database_1.default.isSortedSetMembers('notifications', nids);
        return nids.filter((nid, idx) => exists[idx]);
    });
}
exports.filterExists = filterExists;
function findRelated(mergeIds, set) {
    return __awaiter(this, void 0, void 0, function* () {
        mergeIds = mergeIds.filter(Boolean);
        if (!mergeIds.length) {
            return [];
        }
        // A related notification is one in a zset that has the same mergeId
        const nids = yield database_1.default.getSortedSetRevRange(set, 0, -1);
        const keys = nids.map(nid => `notifications:${nid}`);
        const notificationData = yield database_1.default.getObjectsFields(keys, ['mergeId']);
        const notificationMergeIds = notificationData.map(notifObj => String(notifObj.mergeId));
        const mergeSet = new Set(mergeIds.map(id => String(id)));
        return nids.filter((nid, idx) => mergeSet.has(notificationMergeIds[idx]));
    });
}
exports.findRelated = findRelated;
function create(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!data.nid) {
            throw new Error('[[error:no-notification-id]]');
        }
        data.importance = data.importance || 5;
        const oldNotif = yield database_1.default.getObject(`notifications:${data.nid}`);
        if (oldNotif &&
            parseInt(oldNotif.pid, 10) === parseInt(data.pid, 10) &&
            parseInt(oldNotif.importance, 10) > parseInt(data.importance, 10)) {
            return null;
        }
        const now = Date.now();
        data.datetime = now;
        const result = yield plugins_1.default.hooks.fire('filter:notifications.create', {
            data: data,
        });
        if (!result.data) {
            return null;
        }
        yield Promise.all([
            database_1.default.sortedSetAdd('notifications', now, data.nid),
            database_1.default.setObject(`notifications:${data.nid}`, data),
        ]);
        return data;
    });
}
exports.create = create;
function push(notification, uids) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!notification || !notification.nid) {
            return;
        }
        uids = Array.isArray(uids) ? lodash_1.default.uniq(uids) : [uids];
        if (!uids.length) {
            return;
        }
        setTimeout(() => {
            batch_1.default.processArray(uids, (uids) => __awaiter(this, void 0, void 0, function* () {
                yield pushToUids(uids, notification);
            }), { interval: 1000, batch: 500 }, (err) => {
                if (err) {
                    winston_1.default.error(err.stack);
                }
            });
        }, 1000);
    });
}
exports.push = push;
function pushToUids(uids, notification) {
    return __awaiter(this, void 0, void 0, function* () {
        function sendNotification(uids) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!uids.length) {
                    return;
                }
                const cutoff = Date.now() - notificationPruneCutoff;
                const unreadKeys = uids.map(uid => `uid:${uid}:notifications:unread`);
                const readKeys = uids.map(uid => `uid:${uid}:notifications:read`);
                yield Promise.all([
                    database_1.default.sortedSetsAdd(unreadKeys, notification.datetime, notification.nid),
                    database_1.default.sortedSetsRemove(readKeys, notification.nid),
                ]);
                yield database_1.default.sortedSetsRemoveRangeByScore(unreadKeys.concat(readKeys), '-inf', cutoff);
                const websockets = require('./socket.io');
                if (websockets.server) {
                    uids.forEach((uid) => {
                        websockets.in(`uid_${uid}`).emit('event:new_notification', notification);
                    });
                }
            });
        }
        function sendEmail(uids) {
            return __awaiter(this, void 0, void 0, function* () {
                // Update CTA messaging (as not all notification types need custom text)
                if (['new-reply', 'new-chat'].includes(notification.type)) {
                    notification['cta-type'] = notification.type;
                }
                let body = notification.bodyLong || '';
                if (meta_1.default.config.removeEmailNotificationImages) {
                    body = body.replace(/<img[^>]*>/, '');
                }
                body = posts_1.default.relativeToAbsolute(body, posts_1.default.urlRegex);
                body = posts_1.default.relativeToAbsolute(body, posts_1.default.imgRegex);
                let errorLogged = false;
                yield async_1.default.eachLimit(uids, 3, (uid) => __awaiter(this, void 0, void 0, function* () {
                    yield emailer_1.default.send('notification', uid, {
                        path: notification.path,
                        notification_url: notification.path.startsWith('http') ? notification.path : nconf_1.default.get('url') + notification.path,
                        subject: utils_1.default.stripHTMLTags(notification.subject || '[[notifications:new_notification]]'),
                        intro: utils_1.default.stripHTMLTags(notification.bodyShort),
                        body: body,
                        notification: notification,
                        showUnsubscribe: true,
                    }).catch((err) => {
                        if (!errorLogged) {
                            winston_1.default.error(`[emailer.send] ${err.stack}`);
                            errorLogged = true;
                        }
                    });
                }));
            });
        }
        function getUidsBySettings(uids) {
            return __awaiter(this, void 0, void 0, function* () {
                const uidsToNotify = [];
                const uidsToEmail = [];
                const usersSettings = yield user_1.default.getMultipleUserSettings(uids);
                usersSettings.forEach((userSettings) => {
                    const setting = userSettings[`notificationType_${notification.type}`] || 'notification';
                    if (setting === 'notification' || setting === 'notificationemail') {
                        uidsToNotify.push(userSettings.uid);
                    }
                    if (setting === 'email' || setting === 'notificationemail') {
                        uidsToEmail.push(userSettings.uid);
                    }
                });
                return { uidsToNotify: uidsToNotify, uidsToEmail: uidsToEmail };
            });
        }
        // Remove uid from recipients list if they have blocked the user triggering the notification
        uids = yield user_1.default.blocks.filterUids(notification.from, uids);
        const data = yield plugins_1.default.hooks.fire('filter:notification.push', { notification: notification, uids: uids });
        if (!data || !data.notification || !data.uids || !data.uids.length) {
            return;
        }
        notification = data.notification;
        let results = { uidsToNotify: data.uids, uidsToEmail: [] };
        if (notification.type) {
            results = yield getUidsBySettings(data.uids);
        }
        yield Promise.all([
            sendNotification(results.uidsToNotify),
            sendEmail(results.uidsToEmail),
        ]);
        plugins_1.default.hooks.fire('action:notification.pushed', {
            notification: notification,
            uids: results.uidsToNotify,
            uidsNotified: results.uidsToNotify,
            uidsEmailed: results.uidsToEmail,
        });
    });
}
function pushGroup(notification, groupName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!notification) {
            return;
        }
        const members = yield groups_1.default.getMembers(groupName, 0, -1);
        yield push(notification, members);
    });
}
exports.pushGroup = pushGroup;
function pushGroups(notification, groupNames) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!notification) {
            return;
        }
        let groupMembers = yield groups_1.default.getMembersOfGroups(groupNames);
        groupMembers = lodash_1.default.uniq(lodash_1.default.flatten(groupMembers));
        yield push(notification, groupMembers);
    });
}
exports.pushGroups = pushGroups;
function rescind(nids) {
    return __awaiter(this, void 0, void 0, function* () {
        nids = Array.isArray(nids) ? nids : [nids];
        yield Promise.all([
            database_1.default.sortedSetRemove('notifications', nids),
            database_1.default.deleteAll(nids.map(nid => `notifications:${nid}`)),
        ]);
    });
}
exports.rescind = rescind;
function markRead(nid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parseInt(uid, 10) <= 0 || !nid) {
            return;
        }
        yield markReadMultiple([nid], uid);
    });
}
exports.markRead = markRead;
function markUnread(nid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(parseInt(uid, 10) > 0) || !nid) {
            return;
        }
        const notification = yield database_1.default.getObject(`notifications:${nid}`);
        if (!notification) {
            throw new Error('[[error:no-notification]]');
        }
        notification.datetime = notification.datetime || Date.now();
        yield Promise.all([
            database_1.default.sortedSetRemove(`uid:${uid}:notifications:read`, nid),
            database_1.default.sortedSetAdd(`uid:${uid}:notifications:unread`, notification.datetime, nid),
        ]);
    });
}
exports.markUnread = markUnread;
function markReadMultiple(nids, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        nids = nids.filter(Boolean);
        if (!Array.isArray(nids) || !nids.length || !(parseInt(uid, 10) > 0)) {
            return;
        }
        let notificationKeys = nids.map(nid => `notifications:${nid}`);
        let mergeIds = yield database_1.default.getObjectsFields(notificationKeys, ['mergeId']);
        // Isolate mergeIds and find related notifications
        mergeIds = lodash_1.default.uniq(mergeIds.map(set => set.mergeId));
        const relatedNids = yield findRelated(mergeIds, `uid:${uid}:notifications:unread`);
        notificationKeys = lodash_1.default.union(nids, relatedNids).map(nid => `notifications:${nid}`);
        let notificationData = yield database_1.default.getObjectsFields(notificationKeys, ['nid', 'datetime']);
        notificationData = notificationData.filter(n => n && n.nid);
        nids = notificationData.map(n => n.nid);
        const datetimes = notificationData.map(n => (n && n.datetime) || Date.now());
        yield Promise.all([
            database_1.default.sortedSetRemove(`uid:${uid}:notifications:unread`, nids),
            database_1.default.sortedSetAdd(`uid:${uid}:notifications:read`, datetimes, nids),
        ]);
    });
}
exports.markReadMultiple = markReadMultiple;
function markAllRead(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const nids = yield database_1.default.getSortedSetRevRange(`uid:${uid}:notifications:unread`, 0, 99);
        yield markReadMultiple(nids, uid);
    });
}
exports.markAllRead = markAllRead;
function prune() {
    return __awaiter(this, void 0, void 0, function* () {
        const cutoffTime = Date.now() - notificationPruneCutoff;
        const nids = yield database_1.default.getSortedSetRangeByScore('notifications', 0, 500, '-inf', cutoffTime);
        if (!nids.length) {
            return;
        }
        try {
            yield Promise.all([
                database_1.default.sortedSetRemove('notifications', nids),
                database_1.default.deleteAll(nids.map(nid => `notifications:${nid}`)),
            ]);
            yield batch_1.default.processSortedSet('users:joindate', (uids) => __awaiter(this, void 0, void 0, function* () {
                const unread = uids.map(uid => `uid:${uid}:notifications:unread`);
                const read = uids.map(uid => `uid:${uid}:notifications:read`);
                yield database_1.default.sortedSetsRemoveRangeByScore(unread.concat(read), '-inf', cutoffTime);
            }), { batch: 500, interval: 100 });
        }
        catch (err) {
            if (err) {
                winston_1.default.error(`Encountered error pruning notifications\n${err.stack}`);
            }
        }
    });
}
exports.prune = prune;
function merge(notifications) {
    return __awaiter(this, void 0, void 0, function* () {
        // When passed a set of notification objects, merge any that can be merged
        const mergeIds = [
            'notifications:upvoted_your_post_in',
            'notifications:user_started_following_you',
            'notifications:user_posted_to',
            'notifications:user_flagged_post_in',
            'notifications:user_flagged_user',
            'new_register',
            'post-queue',
        ];
        notifications = mergeIds.reduce((notifications, mergeId) => {
            const isolated = notifications.filter(n => n && n.hasOwnProperty('mergeId') && n.mergeId.split('|')[0] === mergeId);
            if (isolated.length <= 1) {
                return notifications; // Nothing to merge
            }
            // Each isolated mergeId may have multiple differentiators, so process each separately
            const differentiators = isolated.reduce((cur, next) => {
                const differentiator = next.mergeId.split('|')[1] || 0;
                if (!cur.includes(differentiator)) {
                    cur.push(differentiator);
                }
                return cur;
            }, []);
            differentiators.forEach((differentiator) => {
                let set;
                if (differentiator === 0 && differentiators.length === 1) {
                    set = isolated;
                }
                else {
                    set = isolated.filter(n => n.mergeId === (`${mergeId}|${differentiator}`));
                }
                const modifyIndex = notifications.indexOf(set[0]);
                if (modifyIndex === -1 || set.length === 1) {
                    return notifications;
                }
                switch (mergeId) {
                    case 'notifications:upvoted_your_post_in':
                    case 'notifications:user_started_following_you':
                    case 'notifications:user_posted_to':
                    case 'notifications:user_flagged_post_in':
                    case 'notifications:user_flagged_user':
                        {
                            const usernames = lodash_1.default.uniq(set.map(notifObj => notifObj && notifObj.user && notifObj.user.username));
                            const numUsers = usernames.length;
                            const title = utils_1.default.decodeHTMLEntities(notifications[modifyIndex].topicTitle || '');
                            let titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
                            titleEscaped = titleEscaped ? (`, ${titleEscaped}`) : '';
                            if (numUsers === 2) {
                                notifications[modifyIndex].bodyShort = `[[${mergeId}_dual, ${usernames.join(', ')}${titleEscaped}]]`;
                            }
                            else if (numUsers > 2) {
                                notifications[modifyIndex].bodyShort = `[[${mergeId}_multiple, ${usernames[0]}, ${numUsers - 1}${titleEscaped}]]`;
                            }
                            notifications[modifyIndex].path = set[set.length - 1].path;
                        }
                        break;
                    case 'new_register':
                        notifications[modifyIndex].bodyShort = `[[notifications:${mergeId}_multiple, ${set.length}]]`;
                        break;
                }
                // Filter out duplicates
                notifications = notifications.filter((notifObj, idx) => {
                    if (!notifObj || !notifObj.mergeId) {
                        return true;
                    }
                    return !(notifObj.mergeId === (mergeId + (differentiator ? `|${differentiator}` : '')) && idx !== modifyIndex);
                });
            });
            return notifications;
        }, notifications);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const data = yield plugins_1.default.hooks.fire('filter:notifications.merge', {
            notifications: notifications,
        });
        return data && data.notifications;
    });
}
exports.merge = merge;
// require('./promisify')(Notifications); // HERE
