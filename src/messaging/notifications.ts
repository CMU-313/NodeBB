import winston = require('winston');
import user = require('../user');
import notifications = require('../notifications');
import sockets = require('../socket.io');
import plugins = require('../plugins');
import meta = require('../meta');
import { MessageObject } from '../types/chat';

interface MessagingInfo {
    notifyQueue: object;
    notifyUsersInRoom: (fromUid: string, roomId: string, messageObj: MessageObject) => Promise<void>;
    getUidsInRoom: (roomId: string, field: number, fielded: number) => Promise<string[]>;
    pushUnreadCount: (uid: string) => void;
    isGroupChat: (roomId: string) => Promise<boolean>;
}

interface QueueObject {
    message : MessageObject
    timeout? : ReturnType<typeof setTimeout>
}

interface Message {
    fromUid?: string | number;
    message?: MessageObject;
    self?: number;
    roomId?: string;
    content?: string;
    uids? : string[]
}

export = function (Messaging : MessagingInfo) {
    let num : number;

    async function sendNotifications(fromuid: string, uids: string[], roomId: string, messageObj: MessageObject) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isOnline : boolean = await user.isOnline(uids) as boolean;
        uids = uids.filter((uid, index) => !isOnline[index] && parseInt(fromuid, 10) !== parseInt(uid, 10));
        if (!uids.length) {
            return;
        }

        const { displayname } = messageObj.fromUser;

        const isGroupChat = await Messaging.isGroupChat(roomId);
        const notification : Promise<Message> = await notifications.create({
            type: isGroupChat ? 'new-group-chat' : 'new-chat',
            subject: `[[email:notif.chat.subject, ${displayname}]]`,
            bodyShort: `[[notifications:new_message_from, ${displayname}]]`,
            bodyLong: messageObj.content,
            nid: `chat_${fromuid}_${roomId}`,
            from: fromuid,
            path: `/chats/${messageObj.roomId}`,
        }) as Promise<Message>;

        delete Messaging.notifyQueue[`${fromuid}:${roomId}`];
        await notifications.push(notification, uids);
    }
    Messaging.notifyQueue = {}; // Only used to notify a user of a new chat message, see Messaging.notifyUser
    Messaging.notifyUsersInRoom = async (fromUid: string, roomId: string,
        messageObj: MessageObject) : Promise<void> => {
        let uids : string[] = await Messaging.getUidsInRoom(roomId, 0, -1);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        uids = await user.blocks.filterUids(fromUid, uids) as string[];
        let data : Message = {
            roomId: roomId,
            fromUid: fromUid,
            message: messageObj,
            uids: uids,
            self: num,
        };
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        data = await plugins.hooks.fire('filter:messaging.notify', data) as Message;
        if (!data || !data.uids || !data.uids.length) {
            return;
        }

        uids = data.uids;
        uids.forEach((uid : string) => {
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
        let queueObj : QueueObject = Messaging.notifyQueue[`${fromUid}:${roomId}`] as QueueObject;
        if (queueObj) {
            queueObj.message.content += `\n${messageObj.content}`;
            clearTimeout(queueObj.timeout);
        } else {
            queueObj = {
                message: messageObj,
            };
            Messaging.notifyQueue[`${fromUid}:${roomId}`] = queueObj;
        }

        queueObj.timeout = setTimeout(async () => {
            try {
                await sendNotifications(fromUid, uids, roomId, queueObj.message);
            } catch (err) {
                if (err instanceof Error) {
                    winston.error(`[messaging/notifications] Unabled to send notification\n${err.stack}`);
                }
            }
        },
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        meta.config.notificationSendDelay * 1000);
    };
};
