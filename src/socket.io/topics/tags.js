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
const meta_1 = __importDefault(require("../../meta"));
const user_1 = __importDefault(require("../../user"));
const topics_1 = __importDefault(require("../../topics"));
const categories_1 = __importDefault(require("../../categories"));
const privileges_1 = __importDefault(require("../../privileges"));
const utils_1 = __importDefault(require("../../utils"));
function searchTags(uid, method, data) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const allowed = yield privileges_1.default.global.can('search:tags', uid);
        if (!allowed) {
            throw new Error('[[error:no-privileges]]');
        }
        if (data.cid) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const canRead = yield privileges_1.default.categories.can('topics:read', data.cid, uid);
            if (!canRead) {
                throw new Error('[[error:no-privileges]]');
            }
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const Cids = yield categories_1.default.getCidsByPrivilege('categories:cid', uid, 'topics:read');
        data.cids = Cids;
        return method(data);
    });
}
const SocketTopics = {
    isTagAllowed(socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !utils_1.default.isNumber(data.cid) || !data.tag) {
                throw new Error('[[error:invalid-data]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const systemTags = (meta_1.default.config.systemTags || '').split(',');
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const [tagWhitelist, isPrivileged] = yield Promise.all([
                categories_1.default.getTagWhitelist([data.cid]),
                user_1.default.isPrivileged(socket.uid),
            ]);
            return isPrivileged ||
                (!systemTags.includes(data.tag) && (!tagWhitelist[0].length || tagWhitelist[0].includes(data.tag)));
        });
    },
    canRemoveTag(socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !data.tag) {
                throw new Error('[[error:invalid-data]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const systemTags = (meta_1.default.config.systemTags || '').split(',');
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const isPrivileged = yield user_1.default.isPrivileged(socket.uid);
            return isPrivileged || !systemTags.includes(String(data.tag).trim());
        });
    },
    autocompleteTags(socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (data.cid) {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                const canRead = yield privileges_1.default.categories.can('topics:read', data.cid, socket.uid);
                if (!canRead) {
                    throw new Error('[[error:no-privileges]]');
                }
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const Cids = yield categories_1.default.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
            data.cids = Cids;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const result = yield topics_1.default.autocompleteTags(data);
            return result.map(tag => tag.value);
        });
    },
    searchTags(socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const result = yield searchTags(socket.uid, topics_1.default.searchTags, data);
            return result.map(tag => tag.value);
        });
    },
    searchAndLoadTags(socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield searchTags(socket.uid, topics_1.default.searchAndLoadTags, data);
        });
    },
    loadMoreTags(socket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || !utils_1.default.isNumber(data.after)) {
                throw new Error('[[error:invalid-data]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const start = parseInt(data.after, 10);
            const stop = start + 99;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const cids = yield categories_1.default.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const tags = yield topics_1.default.getCategoryTagsData(cids, start, stop);
            return { tags: tags.filter(Boolean), nextStart: stop + 1 };
        });
    },
};
exports.default = SocketTopics;
