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
exports.SocketUser = void 0;
const user_1 = require("../../user");
const privileges_1 = require("../../privileges");
const plugins_1 = require("../../plugins");
const __1 = require("..");
const api_1 = require("../../api");
function SocketUser(SocketUser) {
    SocketUser.updateCover = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid) {
                throw new Error('[[error:no-privileges]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield user_1.user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield user_1.user.checkMinReputation(socket.uid, data.uid, 'min:rep:cover-picture');
            return yield user_1.user.updateCoverPicture(data);
        });
    };
    SocketUser.uploadCroppedPicture = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid || !(yield privileges_1.privileges.users.canEdit(socket.uid, data.uid))) {
                throw new Error('[[error:no-privileges]]');
            }
            yield user_1.user.checkMinReputation(socket.uid, data.uid, 'min:rep:profile-picture');
            data.callerUid = socket.uid;
            return yield user_1.user.uploadCroppedPicture(data);
        });
    };
    SocketUser.removeCover = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!socket.uid) {
                throw new Error('[[error:no-privileges]]');
            }
            yield user_1.user.isAdminOrGlobalModOrSelf(socket.uid, data.uid);
            const userData = yield user_1.user.getUserFields(data.uid, ['cover:url']);
            // 'keepAllUserImages' is ignored, since there is explicit user intent
            yield user_1.user.removeCoverPicture(data);
            plugins_1.plugins.hooks.fire('action:user.removeCoverPicture', {
                callerUid: socket.uid,
                uid: data.uid,
                user: userData,
            });
        });
    };
    SocketUser.toggleBlock = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const isBlocked = yield user_1.user.blocks.is(data.blockeeUid, data.blockerUid);
            yield user_1.user.blocks.can(socket.uid, data.blockerUid, data.blockeeUid, isBlocked ? 'unblock' : 'block');
            yield user_1.user.blocks[isBlocked ? 'remove' : 'add'](data.blockeeUid, data.blockerUid);
            return !isBlocked;
        });
    };
    SocketUser.exportProfile = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield doExport(socket, data, 'profile');
        });
    };
    SocketUser.exportPosts = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield doExport(socket, data, 'posts');
        });
    };
    SocketUser.exportUploads = function (socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield doExport(socket, data, 'uploads');
        });
    };
    function doExport(socket, data, type) {
        return __awaiter(this, void 0, void 0, function* () {
            __1.sockets.warnDeprecated(socket, 'POST /api/v3/users/:uid/exports/:type');
            if (!socket.uid) {
                throw new Error('[[error:invalid-uid]]');
            }
            if (!data || parseInt(data.uid, 10) <= 0) {
                throw new Error('[[error:invalid-data]]');
            }
            yield user_1.user.isAdminOrSelf(socket.uid, data.uid);
            api_1.api.users.generateExport(socket, Object.assign({ type }, data));
        });
    }
}
exports.SocketUser = SocketUser;
