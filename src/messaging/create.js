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
const meta_1 = __importDefault(require("../meta"));
const plugins_1 = __importDefault(require("../plugins"));
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
module.exports = function (Messaging) {
    Messaging.sendMessage = (data) => __awaiter(this, void 0, void 0, function* () {
        yield Messaging.checkContent(data.content);
        const inRoom = yield Messaging.isUserInRoom(data.uid, data.roomId);
        if (!inRoom) {
            throw new Error('[[error:not-allowed]]');
        }
        return yield Messaging.addMessage(data);
    });
    Messaging.checkContent = (content) => __awaiter(this, void 0, void 0, function* () {
        if (!content) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const maximumChatMessageLength = meta_1.default.config.maximumChatMessageLength || 1000;
        content = String(content).trim();
        let { length } = content;
        ({ content, length } = (yield plugins_1.default.hooks.fire('filter:messaging.checkContent', { content, length })));
        if (!content) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        if (length > maximumChatMessageLength) {
            throw new Error(`[[error:chat-message-too-long, ${maximumChatMessageLength}]]`);
        }
    });
    Messaging.addMessage = (data) => __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const mid = yield database_1.default.incrObjectField('global', 'nextMid');
        const timestamp = data.timestamp || Date.now();
        let message = {
            content: String(data.content),
            timestamp: timestamp,
            fromuid: data.uid,
            roomId: data.roomId,
            deleted: 0,
            system: data.system || 0,
            ip: '',
        };
        if (data.ip) {
            message.ip = data.ip;
        }
        message = (yield plugins_1.default.hooks.fire('filter:messaging.save', message));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield database_1.default.setObject(`message:${mid}`, message);
        const isNewSet = yield Messaging.isNewSet(data.uid, data.roomId, timestamp);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let uids = yield database_1.default.getSortedSetRange(`chat:room:${data.roomId}:uids`, 0, -1);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        uids = (yield user_1.default.blocks.filterUids(data.uid, uids));
        yield Promise.all([
            Messaging.addRoomToUsers(data.roomId, uids, timestamp),
            Messaging.addMessageToUsers(data.roomId, uids, mid, timestamp),
            Messaging.markUnread(uids.filter(uid => uid !== String(data.uid)), data.roomId),
        ]);
        const messages = yield Messaging.getMessagesData([mid], data.uid, data.roomId, true);
        if (!messages || !messages[0]) {
            return null;
        }
        messages[0].newSet = isNewSet;
        messages[0].mid = mid;
        messages[0].roomId = data.roomId;
        yield plugins_1.default.hooks.fire('action:messaging.save', { message: messages[0], data: data });
        return messages[0];
    });
    Messaging.addSystemMessage = (content, uid, roomId) => __awaiter(this, void 0, void 0, function* () {
        const message = yield Messaging.addMessage({
            content: content,
            uid: uid,
            roomId: roomId,
            system: 1,
        });
        Messaging.notifyUsersInRoom(uid, roomId, message);
    });
    Messaging.addRoomToUsers = (roomId, uids, timestamp) => __awaiter(this, void 0, void 0, function* () {
        if (!uids.length) {
            return;
        }
        const keys = uids.map(uid => `uid:${uid}:chat:rooms`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield database_1.default.sortedSetsAdd(keys, timestamp, roomId);
    });
    Messaging.addMessageToUsers = (roomId, uids, mid, timestamp) => __awaiter(this, void 0, void 0, function* () {
        if (!uids.length) {
            return;
        }
        const keys = uids.map(uid => `uid:${uid}:chat:room:${roomId}:mids`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield database_1.default.sortedSetsAdd(keys, timestamp, mid);
    });
};
