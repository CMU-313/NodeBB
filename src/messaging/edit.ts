import meta = require('../meta');
import user = require('../user');
import plugins = require('../plugins');
import privileges = require('../privileges');

import sockets = require('../socket.io');

interface MessageFns {
    editMessage(uid: string, mid: number, roomId: number, content: string): Promise<unknown>;
    getMessageField(mid: number, str: string): Promise<unknown>;
    checkContent(content: string): Promise<unknown>;
    setMessageFields(mid: number, payload: { content: string, time: number }): Promise<unknown>;
    getUidsInRoom(roomId: number, x: number, y: number): Array<string>;
    getMessagesData(arr: Array<number>, uid: string, roomId: number, b: boolean): Array<string>;
    messageExists(messageId: number): Promise<boolean>;
    getMessageFields(messageId: number, arr: Array<string>);
    canEdit(messageId: number, uid: string);
    canEditDelete(messageId: number, uid: string, type:string);
    canDelete(messageId: number, uid: string);
}

type MessageData = {
    fromuid: number;
    timestamp: number;
    system: boolean;
}

type UserData = {
    banned: boolean;
}

type Payload = {
    content: string;
    time: number;
}

module.exports = function (Messaging: MessageFns) {
    Messaging.editMessage = async (uid: string, mid: number, roomId: number, content: string) => {
        await Messaging.checkContent(content);
        const raw = await Messaging.getMessageField(mid, 'content');
        if (raw === content) {
            return;
        }

        const payload: Payload = await plugins.hooks.fire('filter:messaging.edit', {
            content: content,
            edited: Date.now(),
        }) as Payload;

        if (!String(payload.content).trim()) {
            throw new Error('[[error:invalid-chat-message]]');
        }
        await Messaging.setMessageFields(mid, payload);

        // Propagate this change to users in the room
        const [uids, messages] = await Promise.all([
            Messaging.getUidsInRoom(roomId, 0, -1),
            Messaging.getMessagesData([mid], uid, roomId, true),
        ]);

        uids.forEach((uid: string) => {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            sockets.in(`uid_${uid}`).emit('event:chats.edit', {
                messages: messages,
            });
        });
    };

    const canEditDelete = async (messageId: number, uid: string, type: string) => {
        let durationConfig = '';
        if (type === 'edit') {
            durationConfig = 'chatEditDuration';
        } else if (type === 'delete') {
            durationConfig = 'chatDeleteDuration';
        }

        const exists = await Messaging.messageExists(messageId);
        if (!exists) {
            throw new Error('[[error:invalid-mid]]');
        }

        const isAdminOrGlobalMod: boolean = await user.isAdminOrGlobalMod(uid) as boolean;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config.disableChat) {
            throw new Error('[[error:chat-disabled]]');
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        } else if (!isAdminOrGlobalMod && meta.config.disableChatMessageEditing) {
            throw new Error('[[error:chat-message-editing-disabled]]');
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userData: UserData = await user.getUserFields(uid, ['banned']) as UserData;
        if (userData.banned) {
            throw new Error('[[error:user-banned]]');
        }

        const canChat = await privileges.global.can('chat', uid) as boolean;
        if (!canChat) {
            throw new Error('[[error:no-privileges]]');
        }

        const messageData: MessageData = await Messaging.getMessageFields(messageId, ['fromuid', 'timestamp', 'system']) as MessageData;
        if (isAdminOrGlobalMod && !messageData.system) {
            return;
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const chatConfigDuration: number = meta.config[durationConfig] as number;
        if (chatConfigDuration && Date.now() - messageData.timestamp > chatConfigDuration * 1000) {
            throw new Error(`[[error:chat-${type}-duration-expired, ${chatConfigDuration}]]`);
        }

        if (messageData.fromuid === parseInt(uid, 10) && !messageData.system) {
            return;
        }

        throw new Error(`[[error:cant-${type}-chat-message]]`);
    };

    Messaging.canEdit = async (messageId, uid) => await canEditDelete(messageId, uid, 'edit');
    Messaging.canDelete = async (messageId, uid) => await canEditDelete(messageId, uid, 'delete');
};
