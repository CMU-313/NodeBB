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
const winston = require("winston");
const user = require("../user");
const notifications = require("../notifications");
const sockets = require("../socket.io");
const plugins = require("../plugins");
const meta = require("../meta");
function Messaging() {
    let notifyQueue; // Only used to notify a user of a new chat message, see Messaging.notifyUser
    // The next line cannot be made any shorter
    // eslint-disable-next-line @typescript-eslint/max-len
    function notifyUsersInRoom({ fromUid, roomId, messageObj }) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            let uids = yield this.getUidsInRoom(roomId, 0, -1);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            uids = (yield user.blocks.filterUids(fromUid, uids));
            let data = {
                roomId: roomId,
                fromUid: fromUid,
                message: messageObj,
                uids: uids,
            };
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            data = (yield plugins.hooks.fire('filter:messaging.notify', data));
            if (!data || !data.uids || !data.uids.length) {
                return;
            }
            uids = data.uids;
            const isSenderSameAsRecipient = (recipientUid) => parseInt(recipientUid, 10) === parseInt(fromUid, 10);
            for (let i = 0; i < uids.length; i++) {
                const uid = uids[i];
                this.pushUnreadCount(uid);
                sockets.in(`uid_${uid}`).emit('event:chats.receive', Object.assign(Object.assign({}, data), { self: isSenderSameAsRecipient(uid) ? 1 : 0 }));
            }
            if (messageObj.system) {
                return;
            }
            // Delayed notifications
            let queueObj = this.notifyQueue[`${fromUid}:${roomId}`];
            if (queueObj) {
                queueObj.message.content += `\n${messageObj.content}`;
                clearTimeout(queueObj.timeout);
            }
            else {
                queueObj = {
                    message: messageObj,
                };
                this.notifyQueue[`${fromUid}:${roomId}`] = queueObj;
            }
            queueObj.timeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    yield this.sendNotifications(fromUid, uids, roomId, queueObj.message);
                }
                catch (err) {
                    winston.error(`[messaging/notifications] Unabled to send notification\n${err.stack}`);
                }
            }), meta.config.notificationSendDelay * 1000);
        });
    }
    function sendNotifications({ fromUid, uids, roomId, messageObj }) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const isOnline = yield user.isOnline(uids);
            uids = uids.filter((uid, index) => !isOnline[index] && parseInt(fromUid, 10) !== parseInt(uid, 10));
            if (!uids.length) {
                return;
            }
            const { displayname } = messageObj.fromUser;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const isGroupChat = yield this.isGroupChat(roomId);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const notification = yield notifications.create({
                type: isGroupChat ? 'new-group-chat' : 'new-chat',
                subject: `[[email:notif.chat.subject, ${displayname}]]`,
                bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
                bodyLong: messageObj.content,
                nid: `chat_${fromUid}_${roomId}`,
                from: fromUid,
                path: `/chats/${messageObj.roomId}`,
            });
            delete this.notifyQueue[`${fromUid}:${roomId}`];
            notifications.push(notification, uids);
        });
    }
}
exports.default = Messaging;
