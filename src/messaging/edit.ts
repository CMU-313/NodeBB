import meta = require('../meta');
import user = require ('../user');
import plugins = require('../plugins');
import privileges = require('../privileges');
import sockets = require('../socket.io');

interface Messaging {
    checkContent: (content: string) => Promise<void>;
    getMessageField: (mid : string, content : string) => Promise<Message>;
    editMessage: (uid: string, mid: string, roomId: string, content: string) => Promise<void>;
    setMessageFields: (mid: string, payload: Payload) => Promise<void>;
    getMessagesData: (mids: string[], uid: string, roomId: string, isNew: boolean) => Promise<Message[]>;
    getMessageFields: (messageId : string, ids : string[]) => Promise<Message>;
    getUidsInRoom: (roomId : string, num1: number, num2: number) => Promise<string[]>;
    canEdit: (messageId: string, uid: string) => Promise<void>;
    canDelete: (messageId: string, uid: string) => Promise<void>;
    messageExists: (messageId:string) => Promise<boolean>;
}

interface Message {
    content?: string;
    uid?: string;
    roomId?: string;
    system?: number;
    mid?: string;
    timestamp?: number;
    fromuid?: string | number;
}

interface Payload {
    content: string;
    edited: number;
}
interface UserData {
    banned: boolean;
}

module.exports = function (Messaging : Messaging) {
    Messaging.editMessage = async (uid : string, mid : string, roomId : string, content : string) : Promise<void> => {
        await Messaging.checkContent(content);
        const raw = await Messaging.getMessageField(mid, 'content');
        if (raw === content) {
            return;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const payload = await plugins.hooks.fire('filter:messaging.edit', {
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
        ]) as [string[], string[]];

        uids.forEach((uid) => {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            sockets.in(`uid_${uid}`).emit('event:chats.edit', {
                messages: messages,
            });
        });
    };

    const canEditDelete = async (messageId : string, uid : string, type : string): Promise<void> => {
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

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(uid) as boolean;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const disabled = meta.config.disableChat as boolean;
        if (disabled) {
            throw new Error('[[error:chat-disabled]]');
        } else if (!isAdminOrGlobalMod) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const metaval = meta.config.disableChatMessageEditing as boolean;
            if (metaval) {
                throw new Error('[[error:chat-message-editing-disabled]]');
            }
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userData = await user.getUserFields(uid, ['banned']) as UserData;
        if (userData.banned) {
            throw new Error('[[error:user-banned]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const canChat = await privileges.global.can('chat', uid) as boolean;
        if (!canChat) {
            throw new Error('[[error:no-privileges]]');
        }

        const messageData = await Messaging.getMessageFields(messageId, ['fromuid', 'timestamp', 'system']);
        if (isAdminOrGlobalMod && !messageData.system) {
            return;
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const chatConfigDuration = meta.config[durationConfig] as number;
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
