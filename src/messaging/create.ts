import meta = require('../meta');
import plugins = require('../plugins');
import db = require('../database');
import user = require('../user');

interface Message {
    uid: string;
    roomId: number;
    content: string;
    timestamp?: number;
    ip?: string;
    system?: number;
    newSet? :boolean;
    mid?: number;
  }

interface MessagingType {
    sendMessage: (data: Message) => Promise<Message>;
    checkContent: (content: string) => Promise<void>;
    addMessage: (data: Message) => Promise<Message>;
    addSystemMessage: (content: string, uid: string, roomId: number) => Promise<void>;
    addRoomToUsers: (roomId: number, uids: string[], timestamp: number) => Promise<void>;
    addMessageToUsers: (roomId: number, uids: string[], mid: number, timestamp: number) => Promise<void>;

    isUserInRoom: (uid: string, roomId: number) => Promise<boolean>
    isNewSet: (uid: string, roomId: number, timestamp: number) => Promise<boolean>;
    markUnread: (uids: string[], roomId: number) => Promise<void>;
    getMessagesData: (mid: number[], uid: string, roomId: number, isNew: boolean) => Promise<Message[]>;
    notifyUsersInRoom: (uid: string, roomId: number, message: Message) => void;
}

module.exports = function (Messaging: MessagingType) {
    Messaging.sendMessage = async (data: Message): Promise<Message> => {
        await Messaging.checkContent(data.content);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const inRoom = await Messaging.isUserInRoom(data.uid, data.roomId);
        if (!inRoom) {
            throw new Error('[[error:not-allowed]]');
        }

        return await Messaging.addMessage(data);
    };

    Messaging.checkContent = async (content: string): Promise<void> => {
        if (!content) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const maximumChatMessageLength: number = meta.config.maximumChatMessageLength as number || 1000;
        content = String(content).trim();
        let { length } = content;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        ({ content, length } = await plugins.hooks.fire('filter:messaging.checkContent', { content, length }) as {content: string, length: number});
        if (!content) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        if (maximumChatMessageLength && length > maximumChatMessageLength) {
            throw new Error(`[[error:chat-message-too-long, ${maximumChatMessageLength}]]`);
        }
    };

    Messaging.addMessage = async (data: Message): Promise<Message> => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const mid: number = await db.incrObjectField('global', 'nextMid') as number;
        const timestamp = data.timestamp || Date.now();
        let dataIP = '';
        if (data.ip) {
            dataIP = data.ip;
        }
        let message = {
            content: String(data.content),
            timestamp: timestamp,
            fromuid: data.uid,
            roomId: data.roomId,
            deleted: 0,
            system: data.system || 0,
            ip: dataIP,
        };

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        message = await plugins.hooks.fire('filter:messaging.save', message) as typeof message;
        if (mid) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.setObject(`message:${mid}`, message);
        }
        const isNewSet = await Messaging.isNewSet(data.uid, data.roomId, timestamp);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let uids: string[] = await db.getSortedSetRange(`chat:room:${data.roomId}:uids`, 0, -1) as string[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        uids = await user.blocks.filterUids(data.uid, uids) as string[];

        await Promise.all([
            Messaging.addRoomToUsers(data.roomId, uids, timestamp),
            Messaging.addMessageToUsers(data.roomId, uids, mid, timestamp),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            Messaging.markUnread(uids.filter(uid => uid !== String(data.uid)), data.roomId),
        ]);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const messages = await Messaging.getMessagesData([mid], data.uid, data.roomId, true);
        if (!messages || !messages[0]) {
            return null;
        }

        messages[0].newSet = isNewSet;
        messages[0].mid = mid;
        messages[0].roomId = data.roomId;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await plugins.hooks.fire('action:messaging.save', { message: messages[0], data: data });
        return messages[0];
    };

    Messaging.addSystemMessage = async (content: string, uid: string, roomId: number): Promise<void> => {
        const message = await Messaging.addMessage({
            content: content,
            uid: uid,
            roomId: roomId,
            system: 1,
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        Messaging.notifyUsersInRoom(uid, roomId, message);
    };

    Messaging.addRoomToUsers = async (roomId: number, uids: string[], timestamp: number): Promise<void> => {
        if (!uids.length) {
            return;
        }

        const keys = uids.map(uid => `uid:${uid}:chat:rooms`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetsAdd(keys, timestamp, roomId);
    };

    Messaging.addMessageToUsers = async (roomId: number, uids: string[],
        mid: number, timestamp: number): Promise<void> => {
        if (!uids.length) {
            return;
        }
        const keys = uids.map(uid => `uid:${uid}:chat:room:${roomId}:mids`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetsAdd(keys, timestamp, mid);
    };
};
