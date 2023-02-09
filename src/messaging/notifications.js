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
const winston = require("winston");
const user = require("../user");
const notifications = require("../notifications");
const sockets = require("../socket.io");
const plugins = require("../plugins");
const meta = require("../meta");
module.exports = function (Messaging) {
    let num;
    function sendNotifications(fromuid, uids, roomId, messageObj) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const isOnline = yield user.isOnline(uids);
            uids = uids.filter((uid, index) => !isOnline[index] && parseInt(fromuid, 10) !== parseInt(uid, 10));
            if (!uids.length) {
                return;
            }
            const { displayname } = messageObj.fromUser;
            const isGroupChat = yield Messaging.isGroupChat(roomId);
            const notification = yield notifications.create({
                type: isGroupChat ? 'new-group-chat' : 'new-chat',
                subject: `[[email:notif.chat.subject, ${displayname}]]`,
                bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
                bodyLong: messageObj.content,
                nid: `chat_${fromuid}_${roomId}`,
                from: fromuid,
                path: `/chats/${messageObj.roomId}`,
            });
            delete Messaging.notifyQueue[`${fromuid}:${roomId}`];
            yield notifications.push(notification, uids);
        });
    }
    Messaging.notifyQueue = {}; // Only used to notify a user of a new chat message, see Messaging.notifyUser
    Messaging.notifyUsersInRoom = (fromUid, roomId, messageObj) => __awaiter(this, void 0, void 0, function* () {
        let uids = yield Messaging.getUidsInRoom(roomId, 0, -1);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        uids = (yield user.blocks.filterUids(fromUid, uids));
        let data = {
            roomId: roomId,
            fromUid: fromUid,
            message: messageObj,
            uids: uids,
            self: num,
        };
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        data = (yield plugins.hooks.fire('filter:messaging.notify', data));
        if (!data || !data.uids || !data.uids.length) {
            return;
        }
        uids = data.uids;
        uids.forEach((uid) => {
            data.self = parseInt(uid, 10) === parseInt(fromUid, 10) ? 1 : 0;
            Messaging.pushUnreadCount(uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            sockets.in(`uid_${uid}`).emit('event:chats.receive', data);
        });
        if (messageObj.system) {
            return;
        }
        // Delayed notifications
        let queueObj = Messaging.notifyQueue[`${fromUid}:${roomId}`];
        if (queueObj) {
            queueObj.message.content += `\n${messageObj.content}`;
            clearTimeout(queueObj.timeout);
        }
        else {
            queueObj = {
                message: messageObj,
            };
            Messaging.notifyQueue[`${fromUid}:${roomId}`] = queueObj;
        }
        queueObj.timeout = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield sendNotifications(fromUid, uids, roomId, queueObj.message);
            }
            catch (err) {
                if (err instanceof Error) {
                    winston.error(`[messaging/notifications] Unabled to send notification\n${err.stack}`);
                }
            }
        }), 
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        meta.config.notificationSendDelay * 1000);
    });
};
