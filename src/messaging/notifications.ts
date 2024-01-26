//I utilized ChatGPT for help with this assignment.

import winston = require('winston');

import user = require('../user');
import notifications = require('../notifications');
import { Notifications } from '../notifications';
import sockets = require('../socket.io');
import plugins = require('../plugins');
import meta = require('../meta');
import { Messaging } from '.';
import { MessageObject } from '../types/chat';

export default function Messaging() {
    let notifyQueue: NonNullable<unknown>; // Only used to notify a user of a new chat message, see Messaging.notifyUser

    // The next line cannot be made any shorter
    // eslint-disable-next-line @typescript-eslint/max-len
    async function notifyUsersInRoom(this: Messaging, { fromUid, roomId, messageObj }: { fromUid: string; roomId: string; messageObj: MessageObject; }): Promise<void> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let uids: string[] = await this.getUidsInRoom(roomId, 0, -1) as string[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        uids = await user.blocks.filterUids(fromUid, uids) as string[];

        let data = {
            roomId: roomId,
            fromUid: fromUid,
            message: messageObj,
            uids: uids,
        };

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        data = await plugins.hooks.fire('filter:messaging.notify', data) as typeof data;
        if (!data || !data.uids || !data.uids.length) {
            return;
        }

        uids = data.uids;
        const isSenderSameAsRecipient = (recipientUid: string) => parseInt(recipientUid, 10) === parseInt(fromUid, 10);

        for (let i = 0; i < uids.length; i++) {
            const uid = uids[i];
            this.pushUnreadCount(uid);
            sockets.in(`uid_${uid}`).emit('event:chats.receive', {
                ...data,
                self: isSenderSameAsRecipient(uid) ? 1 : 0,
            });
        }

        if (messageObj.system) {
            return;
        }
        // Delayed notifications
        let queueObj = this.notifyQueue[`${fromUid}:${roomId}`];
        if (queueObj) {
            queueObj.message.content += `\n${messageObj.content}`;
            clearTimeout(queueObj.timeout);
        } else {
            queueObj = {
                message: messageObj,
            };
            this.notifyQueue[`${fromUid}:${roomId}`] = queueObj;
        }

        queueObj.timeout = setTimeout(async () => {
            try {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                await this.sendNotifications(fromUid, uids, roomId, queueObj.message);
            } catch (err) {
                winston.error(`[messaging/notifications] Unabled to send notification\n${err.stack}`);
            }
        }, meta.config.notificationSendDelay * 1000);
    }

    async function sendNotifications(this: Messaging, { fromUid, uids, roomId, messageObj }: { fromUid: string; uids: string[]; roomId: string; messageObj: MessageObject; }): Promise<void> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isOnline = await user.isOnline(uids) as boolean[];

        uids = uids.filter((uid: string, index: number) => !isOnline[index] && parseInt(fromUid, 10) !== parseInt(uid, 10));
        if (!uids.length) {
            return;
        }

        const { displayname } = messageObj.fromUser;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isGroupChat = await this.isGroupChat(roomId) as boolean;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const notification : Notifications = await notifications.create({
            type: isGroupChat ? 'new-group-chat' : 'new-chat',
            subject: `[[email:notif.chat.subject, ${displayname}]]`,
            bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
            bodyLong: messageObj.content,
            nid: `chat_${fromUid}_${roomId}`,
            from: fromUid,
            path: `/chats/${messageObj.roomId}`,
        }) as Notifications;

        delete this.notifyQueue[`${fromUid}:${roomId}`];
        notifications.push(notification, uids);
    }
}
