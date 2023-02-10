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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = __importDefault(require("../../api"));
const messaging_1 = __importDefault(require("../../messaging"));
const helpers_1 = __importDefault(require("../../helpers"));
const Chats = null;
Chats.list = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = (isFinite(Number(req.query.page)) && parseInt(String(req.query.page), 10)) || 1;
    const perPage = (isFinite(Number(req.query.perPage)) &&
        parseInt(String(req.query.perPage), 10)) || 20;
    const start = Math.max(0, page - 1) * perPage;
    const stop = start + perPage;
    // eslint-disable-next-line max-len
    const rooms = yield messaging_1.default.getRecentChats(req.query.uid, req.query.uid, start, stop);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, { rooms });
});
Chats.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const roomObj = yield api_1.default.chats.create(req, req.body);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, roomObj);
});
Chats.exists = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    yield helpers_1.default.formatApiResponse(200, res);
});
Chats.get = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const roomObj = yield messaging_1.default.loadRoom(req.query.uid, {
        uid: req.query.uid,
        roomId: req.params.roomId,
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, roomObj);
});
Chats.post = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const messageObj = yield api_1.default.chats.post(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, messageObj);
});
Chats.rename = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const roomObj = yield api_1.default.chats.rename(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, roomObj);
});
Chats.users = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield api_1.default.chats.users(req, Object.assign({}, req.params));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, users);
});
Chats.invite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield api_1.default.chats.invite(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, users);
});
Chats.kick = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield api_1.default.chats.kick(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, users);
});
Chats.kickUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    req.body.uids = [req.params.uid];
    const users = yield api_1.default.chats.kick(req, Object.assign(Object.assign({}, req.body), { roomId: req.params.roomId }));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, users);
});
Chats.messages.list = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const messages = yield messaging_1.default.getMessages({
        callerUid: req.query.uid,
        uid: req.query.uid,
        roomId: req.params.roomId,
        start: parseInt(String(req.query.start), 10) || 0,
        count: 50,
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, { messages });
});
Chats.messages.get = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, max-len
    const messages = yield messaging_1.default.getMessagesData([req.params.mid], req.query.uid, req.params.roomId, false);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, messages.pop());
});
Chats.messages.edit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    yield messaging_1.default.canEdit(req.params.mid, req.query.uid);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    yield messaging_1.default.editMessage(req.query.uid, req.params.mid, req.params.roomId, req.body.message);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, max-len
    const messages = yield messaging_1.default.getMessagesData([req.params.mid], req.query.uid, req.params.roomId, false);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res, messages.pop());
});
Chats.messages.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    yield messaging_1.default.canDelete(req.params.mid, req.query.uid);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    yield messaging_1.default.deleteMessage(req.params.mid, req.query.uid);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res);
});
Chats.messages.restore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    yield messaging_1.default.canDelete(req.params.mid, req.query.uid);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    yield messaging_1.default.restoreMessage(req.params.mid, req.query.uid);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    helpers_1.default.formatApiResponse(200, res);
});
exports.default = Chats;
