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
Object.defineProperty(exports, "__esModule", { value: true });
const messaging = require("../../messaging");
const meta = require("../../meta");
const user = require("../../user");
const privileges = require("../../privileges");
const helpers = require("../helpers");
const chatsController = {
    get: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (meta.config.disableChat) {
            return next();
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uid = yield user.getUidByUserslug(req.params.userslug);
        if (!uid) {
            return next();
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const canChat = yield privileges.global.can('chat', req.params.uid);
        if (!canChat) {
            return next(new Error('[[error:no-privileges]]'));
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const recentChats = yield messaging.getRecentChats(req.params.uid, uid, 0, 19);
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
        const room = yield messaging.loadRoom(req.params.uid, { uid: uid, roomId: req.params.roomid });
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
        room.canViewInfo = yield privileges.global.can('view:users:info', uid);
        res.render('chats', room);
    }),
    redirectToChat: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        if (!req.params.loggedIn) {
            return next();
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userslug = yield user.getUserField(req.params.uid, 'userslug');
        if (!userslug) {
            return next();
        }
        const roomid = parseInt(req.params.roomid, 10);
        helpers.redirect(res, `/user/${userslug}/chats${roomid ? `/${roomid}` : ''}`);
    }),
};
exports.default = chatsController;
