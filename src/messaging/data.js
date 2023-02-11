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
const validator_1 = __importDefault(require("validator"));
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const utils_1 = __importDefault(require("../utils"));
const plugins_1 = __importDefault(require("../plugins"));
const intFields = ['timestamp', 'edited', 'fromuid', 'roomId', 'deleted', 'system'];
function modifyMessage(message, fields, mid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (message) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            database_1.default.parseIntFields(message, intFields, fields);
            if (message.timestamp !== undefined) {
                message.timestampISO = utils_1.default.toISOString(message.timestamp);
            }
            if (message.edited !== undefined) {
                message.editedISO = utils_1.default.toISOString(message.edited);
            }
        }
        const payload = yield plugins_1.default.hooks.fire('filter:messaging.getFields', {
            mid: mid,
            message: message,
            fields: fields,
        });
        return payload.message;
    });
}
module.exports = function (Messaging) {
    Messaging.newMessageCutoff = 1000 * 60 * 3;
    Messaging.getMessagesFields = (mids, fields) => __awaiter(this, void 0, void 0, function* () {
        const keys = mids.map(mid => `message:${mid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const messages = yield database_1.default.getObjects(keys, fields);
        return yield Promise.all(messages.map((message, idx) => __awaiter(this, void 0, void 0, function* () { return modifyMessage(message, fields, parseInt(mids[idx], 10)); })));
    });
    Messaging.getMessageField = (mid, field) => __awaiter(this, void 0, void 0, function* () {
        const fields = yield Messaging.getMessageFields(mid, [field]);
        return fields ? fields[field] : null;
    });
    Messaging.getMessageFields = (mid, fields) => __awaiter(this, void 0, void 0, function* () {
        const messages = yield Messaging.getMessagesFields([mid], fields);
        return messages ? messages[0] : null;
    });
    Messaging.setMessageField = (mid, field, content) => __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield database_1.default.setObjectField(`message:${mid}`, field, content);
    });
    Messaging.setMessageFields = (mid, data) => __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield database_1.default.setObject(`message:${mid}`, data);
    });
    Messaging.getMessagesData = (mids, uid, roomId, isNew) => __awaiter(this, void 0, void 0, function* () {
        let messages = yield Messaging.getMessagesFields(mids, []);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        messages = (yield user_1.default.blocks.filter(uid, 'fromuid', messages));
        messages = messages
            .map((msg, idx) => {
            if (msg) {
                msg.messageId = parseInt(mids[idx], 10);
                msg.ip = undefined;
            }
            return msg;
        })
            .filter(Boolean);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const users = yield user_1.default.getUsersFields(messages.map(msg => msg && msg.fromuid), ['uid', 'username', 'userslug', 'picture', 'status', 'banned']);
        messages.forEach((message, index) => {
            message.fromUser = users[index];
            message.fromUser.banned = !!message.fromUser.banned;
            message.fromUser.deleted = message.fromuid !== message.fromUser.uid && message.fromUser.uid === 0;
            const self = message.fromuid === parseInt(uid, 10);
            message.self = self ? 1 : 0;
            message.newSet = false;
            message.roomId = String(message.roomId || roomId);
            message.deleted = !!message.deleted;
            message.system = !!message.system;
        });
        messages = yield Promise.all(messages.map((message) => __awaiter(this, void 0, void 0, function* () {
            if (message.system) {
                message.content = validator_1.default.escape(String(message.content));
                message.cleanedContent = utils_1.default.stripHTMLTags(utils_1.default.decodeHTMLEntities(message.content));
                return message;
            }
            const result = yield Messaging.parse(message.content, message.fromuid, uid, roomId, isNew);
            message.content = result;
            message.cleanedContent = utils_1.default.stripHTMLTags(utils_1.default.decodeHTMLEntities(result));
            return message;
        })));
        if (messages.length > 1) {
            // Add a spacer in between messages with time gaps between them
            messages = messages.map((message, index) => {
                // Compare timestamps with the previous message, and check if a spacer needs to be added
                if (index > 0 && message.timestamp > messages[index - 1].timestamp + Messaging.newMessageCutoff) {
                    // If it's been 5 minutes, this is a new set of messages
                    message.newSet = true;
                }
                else if (index > 0 && message.fromuid !== messages[index - 1].fromuid) {
                    // If the previous message was from the other person, this is also a new set
                    message.newSet = true;
                }
                else if (index === 0) {
                    message.newSet = true;
                }
                return message;
            });
        }
        else if (messages.length === 1) {
            // For single messages, we don't know the context, so look up the previous message and compare
            const key = `uid:${uid}:chat:room:${roomId}:mids`;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const index = yield database_1.default.sortedSetRank(key, messages[0].messageId);
            if (index > 0) {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                const mid = yield database_1.default.getSortedSetRange(key, index - 1, index - 1);
                const fields = yield Messaging.getMessageFields(mid, ['fromuid', 'timestamp']);
                if ((messages[0].timestamp > fields.timestamp + Messaging.newMessageCutoff) ||
                    (messages[0].fromuid !== fields.fromuid)) {
                    // If it's been 5 minutes, this is a new set of messages
                    messages[0].newSet = true;
                }
            }
            else {
                messages[0].newSet = true;
            }
        }
        else {
            messages = [];
        }
        const data = yield plugins_1.default.hooks.fire('filter:messaging.getMessages', {
            messages: messages,
            uid: uid,
            roomId: roomId,
            isNew: isNew,
            mids: mids,
        });
        return data && data.messages;
    });
};
