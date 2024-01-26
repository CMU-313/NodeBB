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
const database_1 = require("../../database");
const user_1 = require("../../user");
const topics_1 = require("../../topics");
module.exports = function (SocketTopics) {
    SocketTopics.markAsRead = function (socket, tids) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids) || socket.uid <= 0) {
                throw new Error('[[error:invalid-data]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const hasMarked = yield topics_1.topics.markAsRead(tids, socket.uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const promises = [topics_1.topics.markTopicNotificationsRead(tids, socket.uid)];
            if (hasMarked) {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                promises.push(topics_1.topics.pushUnreadCount(socket.uid));
            }
            yield Promise.all(promises);
        });
    };
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    SocketTopics.markTopicNotificationsRead = function (socket, tids) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids) || !socket.uid) {
                throw new Error('[[error:invalid-data]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield topics_1.topics.markTopicNotificationsRead(tids, socket.uid);
        });
    };
    SocketTopics.markAllRead = function (socket) {
        return __awaiter(this, void 0, void 0, function* () {
            if (socket.uid <= 0) {
                throw new Error('[[error:invalid-uid]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield topics_1.topics.markAllRead(socket.uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topics_1.topics.pushUnreadCount(socket.uid);
        });
    };
    SocketTopics.markCategoryTopicsRead = function (socket, cid) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const tids = yield topics_1.topics.getUnreadTids({ cid: cid, uid: socket.uid, filter: '' });
            yield SocketTopics.markAsRead(socket, tids);
        });
    };
    SocketTopics.markUnread = function (socket, tid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!tid || socket.uid <= 0) {
                throw new Error('[[error:invalid-data]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield topics_1.topics.markUnread(tid, socket.uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topics_1.topics.pushUnreadCount(socket.uid);
        });
    };
    SocketTopics.markAsUnreadForAll = function (socket, tids) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(tids)) {
                throw new Error('[[error:invalid-tid]]');
            }
            if (socket.uid <= 0) {
                throw new Error('[[error:no-privileges]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const isAdmin = yield user_1.user.isAdministrator(socket.uid);
            const now = Date.now();
            yield Promise.all(tids.map((tid) => __awaiter(this, void 0, void 0, function* () {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                const topicData = yield topics_1.topics.getTopicFields(tid, ['tid', 'cid']);
                if (!topicData.tid) {
                    throw new Error('[[error:no-topic]]');
                }
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                const isMod = yield user_1.user.isModerator(socket.uid, topicData.cid);
                if (!isAdmin && !isMod) {
                    throw new Error('[[error:no-privileges]]');
                }
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield topics_1.topics.markAsUnreadForAll(tid);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield topics_1.topics.updateRecent(tid, now);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.db.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, now, tid);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield topics_1.topics.setTopicField(tid, 'lastposttime', now);
            })));
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topics_1.topics.pushUnreadCount(socket.uid);
        });
    };
};
