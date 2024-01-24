"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const path = __importStar(require("path"));
const nconf = __importStar(require("nconf"));
const file = __importStar(require("../file"));
const user = __importStar(require("../user"));
const groups = __importStar(require("../groups"));
const topics = __importStar(require("../topics"));
const posts = __importStar(require("../posts"));
const messaging = __importStar(require("../messaging"));
const flags = __importStar(require("../flags"));
const slugify = __importStar(require("../slugify"));
const helpers = __importStar(require("./helpers"));
const controllerHelpers = __importStar(require("../controllers/helpers"));
// type NextFunction = (error?: unknown) => void;
const Assert = {
    user: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        if (!(yield user.exists(req.params.uid))) {
            return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-user]]'));
        }
        next();
    })),
    group: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const name = yield groups.getGroupNameByGroupSlug(req.params.slug);
        if (!name || !(yield groups.exists(name))) {
            return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-group]]'));
        }
        next();
    })),
    topic: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        if (!(yield topics.exists(req.params.tid))) {
            return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
        }
        next();
    })),
    post: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        if (!(yield posts.exists(req.params.pid))) {
            return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-post]]'));
        }
        next();
    })),
    flag: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const canView = yield flags.canView(req.params.flagId, req.uid);
        if (!canView) {
            return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-flag]]'));
        }
        next();
    })),
    path: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        let filePath = req.body.path;
        // file: URL support
        if (filePath.startsWith('file:///')) {
            filePath = new URL(filePath).pathname;
        }
        const uploadUrl = nconf.get('upload_url');
        if (filePath.startsWith(uploadUrl)) {
            filePath = filePath.slice(uploadUrl.length);
        }
        const uploadPath = nconf.get('upload_path');
        const pathToFile = path.join(uploadPath, filePath);
        res.locals.cleanedPath = pathToFile;
        if (!pathToFile.startsWith(uploadPath)) {
            return controllerHelpers.formatApiResponse(403, res, new Error('[[error:invalid-path]]'));
        }
        if (!(yield file.exists(pathToFile))) {
            return controllerHelpers.formatApiResponse(404, res, new Error('[[error:invalid-path]]'));
        }
        next();
    })),
    folderName: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const { body } = req;
        const folderName = slugify(path.basename((_b = (_a = body.folderName) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : ''));
        if (!folderName) {
            return controllerHelpers.formatApiResponse(403, res, new Error('[[error:invalid-path]]'));
        }
        if (!res.locals.cleanedPath) {
            return controllerHelpers.formatApiResponse(500, res, new Error('Server configuration error'));
        }
        const folderPath = path.join(res.locals.cleanedPath, folderName);
        if (yield file.exists(folderPath)) {
            return controllerHelpers.formatApiResponse(403, res, new Error('[[error:folder-exists]]'));
        }
        res.locals.folderPath = folderPath;
        next();
    })),
    room: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const roomId = parseInt(req.params.roomId, 10);
        if (!isFinite(roomId)) {
            return controllerHelpers.formatApiResponse(400, res, new Error('[[error:invalid-data]]'));
        }
        const roomExistsFunction = messaging.roomExists;
        const isUserInRoomFunction = messaging.isUserInRoom;
        const [exists, inRoom] = yield Promise.all([
            roomExistsFunction(roomId),
            isUserInRoomFunction(req.uid, roomId),
        ]);
        if (!exists) {
            return controllerHelpers.formatApiResponse(404, res, new Error('[[error:chat-room-does-not-exist]]'));
        }
        if (!inRoom) {
            return controllerHelpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
        }
        next();
    })),
    message: helpers.try((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const messageId = parseInt(req.params.mid, 10);
        if (!isFinite(messageId) ||
            !(yield messaging.messageExists(messageId)) ||
            !(yield messaging.canViewMessage(messageId, req.params.roomId, req.uid))) {
            return controllerHelpers.formatApiResponse(400, res, new Error('[[error:invalid-mid]]'));
        }
        next();
    })),
};
module.exports = Assert;
// export default Assert;
