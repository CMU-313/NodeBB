import validator from 'validator';

import db from '../database';
import user from '../user';
import utils from '../utils';
import plugins from '../plugins';

const intFields: string[] = ['timestamp', 'edited', 'fromuid', 'roomId', 'deleted', 'system'];

interface MessagingInfo {
    newMessageCutoff: number;
    getMessagesFields: (mids: string[], fields: (keyof Message)[]) => Promise<Message[]>;
    getMessageField: (mid: string, field: keyof Message) => Promise<MessageField>;
    getMessageFields: (mid: string, field: (keyof Message)[]) => Promise<Message | null>;
    setMessageField: (mid: string, field: keyof Message, content: string) => Promise<void>;
    setMessageFields: (mid: string, data: Message) => Promise<void>;
    getMessagesData: (mids: string[], uid: string, roomId: string, isNew: boolean) => Promise<Message[]>;
    parse: (input_content: string,
            fromuid: string | number,
            uid: string | number,
            roomId: string,
            isNew: boolean) => Promise<string>;
}

interface User {
    uid: number;
    username: string;
    userslug: string;
    picture: string;
    status: string;
    banned: boolean;
    deleted: boolean;
}

interface Message {
    fromUser?: User; // user is in another module
    fromuid?: string | number;
    messageId?: number;
    self?: number;
    newSet?: boolean;
    roomId?: string;
    deleted?: boolean;
    deletedISO?: string;
    system?: boolean;
    timestamp?: number;
    timestampISO?: string;
    edited?: number;
    editedISO?: string;
    content?: string;
    cleanedContent?: string;
    ip?: string;
}

interface MessagesWrapper {
    messages: Message[]
}

interface MessageWrapper {
    message: Message;
}

type MessageField = number | boolean | User | string | null


async function modifyMessage(message: Message, fields: (keyof Message)[], mid: number): Promise<Message | null> {
    if (message) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.parseIntFields(message, intFields, fields);
        if (message.timestamp !== undefined) {
            message.timestampISO = utils.toISOString(message.timestamp) as string;
        }
        if (message.edited !== undefined) {
            message.editedISO = utils.toISOString(message.edited) as string;
        }
    }

    const payload: MessageWrapper = await plugins.hooks.fire('filter:messaging.getFields', {
        mid: mid,
        message: message,
        fields: fields,
    }) as MessageWrapper;

    return payload.message;
}


export = function (Messaging : MessagingInfo) {
    Messaging.newMessageCutoff = 1000 * 60 * 3;

    Messaging.getMessagesFields = async (mids: string[], fields: (keyof Message)[]) : Promise<Message[] | null> => {
        const keys: string[] = mids.map(mid => `message:${mid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const messages: Message[] = await db.getObjects(keys, fields) as Message[];
        return await Promise.all(messages.map(
            async (message: Message, idx: number) => modifyMessage(message, fields, parseInt(mids[idx], 10))
        ));
    };

    Messaging.getMessageField = async (mid: string, field: keyof Message) : Promise<MessageField> => {
        const fields = await Messaging.getMessageFields(mid, [field]);
        return fields ? fields[field] : null;
    };

    Messaging.getMessageFields = async (mid: string, fields: (keyof Message)[]) : Promise<Message | null> => {
        const messages: (Message[] | null) = await Messaging.getMessagesFields([mid], fields);
        return messages ? messages[0] : null;
    };

    Messaging.setMessageField = async (mid: string, field: keyof Message, content: string) : Promise<void> => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObjectField(`message:${mid}`, field, content);
    };

    Messaging.setMessageFields = async (mid: string, data: Message) : Promise<void> => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`message:${mid}`, data);
    };

    Messaging.getMessagesData = async (
        mids: string[],
        uid: string,
        roomId: string,
        isNew: boolean
    ): Promise<Message[]> => {
        let messages: Message[] = await Messaging.getMessagesFields(mids, []);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        messages = await user.blocks.filter(uid, 'fromuid', messages) as Message[];
        messages = messages
            .map((msg: Message, idx: number) => {
                if (msg) {
                    msg.messageId = parseInt(mids[idx], 10);
                    msg.ip = undefined;
                }
                return msg;
            })
            .filter(Boolean);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const users : User[] = await user.getUsersFields(
            messages.map(msg => msg && msg.fromuid),
            ['uid', 'username', 'userslug', 'picture', 'status', 'banned']
        ) as User[];

        messages.forEach((message: Message, index: number) => {
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

        messages = await Promise.all(messages.map(async (message) => {
            if (message.system) {
                message.content = validator.escape(String(message.content));
                message.cleanedContent = utils.stripHTMLTags(utils.decodeHTMLEntities(message.content));
                return message;
            }

            const result : string = await Messaging.parse(message.content, message.fromuid, uid, roomId, isNew);
            message.content = result;
            message.cleanedContent = utils.stripHTMLTags(utils.decodeHTMLEntities(result));
            return message;
        }));

        if (messages.length > 1) {
            // Add a spacer in between messages with time gaps between them
            messages = messages.map((message, index) => {
                // Compare timestamps with the previous message, and check if a spacer needs to be added
                if (index > 0 && message.timestamp > messages[index - 1].timestamp + Messaging.newMessageCutoff) {
                    // If it's been 5 minutes, this is a new set of messages
                    message.newSet = true;
                } else if (index > 0 && message.fromuid !== messages[index - 1].fromuid) {
                    // If the previous message was from the other person, this is also a new set
                    message.newSet = true;
                } else if (index === 0) {
                    message.newSet = true;
                }

                return message;
            });
        } else if (messages.length === 1) {
            // For single messages, we don't know the context, so look up the previous message and compare
            const key = `uid:${uid}:chat:room:${roomId}:mids`;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const index : number = await db.sortedSetRank(key, messages[0].messageId) as number;
            if (index > 0) {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                const mid: string = await db.getSortedSetRange(key, index - 1, index - 1) as string;
                const fields = await Messaging.getMessageFields(mid, ['fromuid', 'timestamp']);
                if ((messages[0].timestamp > fields.timestamp + Messaging.newMessageCutoff) ||
                    (messages[0].fromuid !== fields.fromuid)) {
                    // If it's been 5 minutes, this is a new set of messages
                    messages[0].newSet = true;
                }
            } else {
                messages[0].newSet = true;
            }
        } else {
            messages = [];
        }

        const data : MessagesWrapper | null = await plugins.hooks.fire('filter:messaging.getMessages', {
            messages: messages,
            uid: uid,
            roomId: roomId,
            isNew: isNew,
            mids: mids,
        }) as MessagesWrapper | null;

        return data && data.messages;
    };
};

