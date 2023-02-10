import { Request, Response } from 'express';

import api from '../../api';
import messaging from '../../messaging';
import helpers from '../../helpers';
import { MessageObject, RoomObject } from '../../types/chat';

interface Chats {
    messages: Messages,
    list: (req: Request, res: Response) => Promise<void>,
    create: (req: Request, res: Response) => Promise<void>,
    exists: (req: Request, res: Response) => Promise<void>,
    get: (req: Request, res: Response) => Promise<void>,
    post: (req: Request, res: Response) => Promise<void>,
    rename: (req: Request, res: Response) => Promise<void>,
    users: (req: Request, res: Response) => Promise<void>,
    invite: (req: Request, res: Response) => Promise<void>,
    kick: (req: Request, res: Response) => Promise<void>,
    kickUser: (req: Request, res: Response) => Promise<void>
}

interface Messages {
    list: (req: Request, res: Response) => Promise<void>,
    get: (req: Request, res: Response) => Promise<void>,
    edit: (req: Request, res: Response) => Promise<void>,
    delete: (req: Request, res: Response) => Promise<void>,
    restore: (req: Request, res: Response) => Promise<void>
}

const Chats: Chats | null = null;

Chats.list = async (req: Request, res: Response): Promise<void> => {
    const page: number = (isFinite(Number(req.query.page)) && parseInt(String(req.query.page), 10)) || 1 as number;
    const perPage: number = (isFinite(Number(req.query.perPage)) &&
                                parseInt(String(req.query.perPage), 10)) || 20 as number;
    const start: number = Math.max(0, page - 1) * perPage;
    const stop: number = start + perPage;
    // eslint-disable-next-line max-len
    const rooms: RoomObject[] = await messaging.getRecentChats(req.query.uid, req.query.uid, start, stop) as RoomObject[];
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, { rooms });
};

Chats.create = async (req: Request, res: Response): Promise<void> => {
    const roomObj: RoomObject = await api.chats.create(req, req.body) as RoomObject;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, roomObj);
};

Chats.exists = async (req: Request, res: Response): Promise<void> => {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await helpers.formatApiResponse(200, res);
};

Chats.get = async (req: Request, res: Response): Promise<void> => {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const roomObj: RoomObject = await messaging.loadRoom(req.query.uid, {
        uid: req.query.uid,
        roomId: req.params.roomId,
    }) as RoomObject;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, roomObj);
};

Chats.post = async (req: Request, res: Response): Promise<void> => {
    const messageObj: MessageObject = await api.chats.post(req, {
        ...req.body,
        roomId: req.params.roomId,
    }) as MessageObject;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, messageObj);
};

Chats.rename = async (req: Request, res: Response): Promise<void> => {
    const roomObj: RoomObject = await api.chats.rename(req, {
        ...req.body,
        roomId: req.params.roomId,
    }) as RoomObject;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, roomObj);
};

Chats.users = async (req: Request, res: Response): Promise<void> => {
    const users = await api.chats.users(req, {
        ...req.params,
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, users);
};

Chats.invite = async (req: Request, res: Response): Promise<void> => {
    const users = await api.chats.invite(req, {
        ...req.body,
        roomId: req.params.roomId,
    });

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, users);
};

Chats.kick = async (req: Request, res: Response): Promise<void> => {
    const users = await api.chats.kick(req, {
        ...req.body,
        roomId: req.params.roomId,
    });

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, users);
};

Chats.kickUser = async (req: Request, res: Response): Promise<void> => {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    req.body.uids = [req.params.uid];
    const users = await api.chats.kick(req, {
        ...req.body,
        roomId: req.params.roomId,
    });

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, users);
};

Chats.messages.list = async (req: Request, res: Response): Promise<void> => {
    const messages: MessageObject[] = await messaging.getMessages({
        callerUid: req.query.uid,
        uid: req.query.uid,
        roomId: req.params.roomId,
        start: parseInt(String(req.query.start), 10) || 0,
        count: 50,
    }) as MessageObject[];

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, { messages });
};

Chats.messages.get = async (req: Request, res: Response): Promise<void> => {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, max-len
    const messages: MessageObject[] = await messaging.getMessagesData([req.params.mid], req.query.uid, req.params.roomId, false) as MessageObject[];
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, messages.pop());
};

Chats.messages.edit = async (req: Request, res: Response): Promise<void> => {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.canEdit(req.params.mid, req.query.uid);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.editMessage(req.query.uid, req.params.mid, req.params.roomId, req.body.message);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, max-len
    const messages: MessageObject[] = await messaging.getMessagesData([req.params.mid], req.query.uid, req.params.roomId, false) as MessageObject[];
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res, messages.pop());
};

Chats.messages.delete = async (req: Request, res: Response): Promise<void> => {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.canDelete(req.params.mid, req.query.uid);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.deleteMessage(req.params.mid, req.query.uid);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res);
};

Chats.messages.restore = async (req: Request, res: Response): Promise<void> => {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.canDelete(req.params.mid, req.query.uid);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.restoreMessage(req.params.mid, req.query.uid);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers.formatApiResponse(200, res);
};

export default Chats;
