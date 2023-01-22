import meta from '../meta';
import plugins from '../plugins';
import db from '../database';
import user from '../user';

interface MessagingInfo {
    sendMessage: (data: MessageData) => Promise<Message>;
    checkContent: (content: string) => Promise<void>;
    addMessage: (data: MessageData) => Promise<Message>;
    addSystemMessage: (content: string, uid: string, roomId: string) => Promise<void>;

    addRoomToUsers: (roomId: string, uids: string[], timestamp: number) => Promise<void>;
    addMessageToUsers: (roomId: string, uids: string[], mid: string, timestamp: number) => Promise<void>;

    notifyUsersInRoom: (fromUid: string, roomId: string, messageObj: Message) => void;
    isNewSet: (uid: string, roomId: string, timestamp: number) => Promise<boolean>;
    markUnread: (uids: string[], roomId: string) => Promise<void | null>;
    getMessagesData: (mids: string[], uid: string, roomId: string, isNew: boolean) => Promise<Message[]>;
    isUserInRoom: (uid: string, roomId: string) => Promise<boolean>;
}

interface MessageData {
    timestamp?: number;
    content?: string;
    uid?: string;
    roomId?: string;
    system?: number;
    ip?: string;
}

interface Message {
    content?: string;
    uid?: string;
    roomId?: string;
    system?: number;
    newSet?: boolean;
    mid?: string;
    timestamp?: number;
    fromuid?: string | number;
    ip?: string;
    deleted?: number;
}

interface MessageWrapper {
    message: Message;
    content: string;
    length: number;
}

export = function (Messaging: MessagingInfo) {
    Messaging.sendMessage = async (data) => {
        await Messaging.checkContent(data.content);
        const inRoom = await Messaging.isUserInRoom(data.uid, data.roomId);
        if (!inRoom) {
            throw new Error('[[error:not-allowed]]');
        }

        return await Messaging.addMessage(data);
    };

    Messaging.checkContent = async (content: string) => {
        if (!content) {
            throw new Error('[[error:invalid-chat-message]]');
        }

        const { maximumChatMessageLength } = meta.config as {maximumChatMessageLength: number};
        const maxChatMessageLength = maximumChatMessageLength || 1000;
        content = String(content).trim();
        let { length } = content;
        ({ content, length } = await plugins.hooks.fire('filter:messaging.checkContent', { content, length }) as MessageWrapper);
        if (!content) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        if (length > maxChatMessageLength) {
            throw new Error(`[[error:chat-message-too-long, ${maxChatMessageLength}]]`);
        }
    };

    Messaging.addMessage = async (data: MessageData) => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const mid: string = await db.incrObjectField('global', 'nextMid') as string;
        const timestamp = data.timestamp || Date.now();
        let message: Message = {
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

        message = await plugins.hooks.fire('filter:messaging.save', message) as Message;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`message:${mid}`, message);
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
            Messaging.markUnread(uids.filter(uid => uid !== String(data.uid)), data.roomId),
        ]);

        const messages = await Messaging.getMessagesData([mid], data.uid, data.roomId, true);
        if (!messages || !messages[0]) {
            return null;
        }

        messages[0].newSet = isNewSet;
        messages[0].mid = mid;
        messages[0].roomId = data.roomId;
        await plugins.hooks.fire('action:messaging.save', { message: messages[0], data: data });
        return messages[0];
    };

    Messaging.addSystemMessage = async (content: string, uid: string, roomId: string) => {
        const message: Message = await Messaging.addMessage({
            content: content,
            uid: uid,
            roomId: roomId,
            system: 1,
        });
        Messaging.notifyUsersInRoom(uid, roomId, message);
    };

    Messaging.addRoomToUsers = async (roomId: string, uids: string[], timestamp: number) => {
        if (!uids.length) {
            return;
        }

        const keys = uids.map(uid => `uid:${uid}:chat:rooms`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetsAdd(keys, timestamp, roomId);
    };

    Messaging.addMessageToUsers = async (roomId: string, uids: string[], mid: string, timestamp: number) => {
        if (!uids.length) {
            return;
        }
        const keys = uids.map(uid => `uid:${uid}:chat:room:${roomId}:mids`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetsAdd(keys, timestamp, mid);
    };
};
