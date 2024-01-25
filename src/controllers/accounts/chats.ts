import { Request, Response, NextFunction } from 'express';
import messaging = require('../../messaging');
import meta = require('../../meta');
import user = require('../../user');
import privileges = require('../../privileges');
import helpers = require('../helpers');

interface RecentChats {
    rooms: unknown;
    nextStart: unknown;
}

interface Room {
    rooms: unknown;
    nextStart: unknown;
    title: string;
    roomName: string;
    usernames: string;
    uid: number;
    userslug: unknown;
    canViewInfo: unknown;
}

interface ChatsController {
    get: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    redirectToChat: (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
}

const chatsController: ChatsController = {
    get: async (req: Request, res: Response, next: NextFunction) => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config.disableChat) {
            return next();
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uid: number = await user.getUidByUserslug(req.params.userslug) as number;
        if (!uid) {
            return next();
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const canChat: boolean = await privileges.global.can('chat', req.params.uid) as boolean;
        if (!canChat) {
            return next(new Error('[[error:no-privileges]]'));
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const recentChats: RecentChats = await messaging.getRecentChats(req.params.uid, uid, 0, 19) as RecentChats;
        if (!recentChats) {
            return next();
        }

        if (!req.params.roomid) {
            return res.render('chats', {
                rooms: recentChats.rooms,
                uid: uid,
                userslug: req.params.userslug,
                nextStart: recentChats.nextStart,
                allowed: true,
                title: '[[pages:chats]]',
            });
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const room: Room = await messaging.loadRoom(req.params.uid, { uid: uid, roomId: req.params.roomid }) as Room;
        if (!room) {
            return next();
        }

        room.rooms = recentChats.rooms;
        room.nextStart = recentChats.nextStart;
        room.title = room.roomName || room.usernames || '[[pages:chats]]';
        room.uid = uid;
        room.userslug = req.params.userslug;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        room.canViewInfo = await privileges.global.can('view:users:info', uid);

        res.render('chats', room);
    },
    redirectToChat: async (req: Request, res: Response, next: NextFunction) => {
        if (!req.params.loggedIn) {
            return next();
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userslug: string = await user.getUserField(req.params.uid, 'userslug') as string;
        if (!userslug) {
            return next();
        }
        const roomid = parseInt(req.params.roomid, 10);
        helpers.redirect(res, `/user/${userslug}/chats${roomid ? `/${roomid}` : ''}`);
    },
};

export default chatsController;
