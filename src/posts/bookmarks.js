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
const database_1 = __importDefault(require("../database"));
const plugins_1 = __importDefault(require("../plugins"));
module.exports = function (Posts) {
    function toggleBookmark(type, pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                throw new Error('[[error:not-logged-in]]');
            }
            const isBookmarking = type === 'bookmark';
            const [postData, hasBookmarked] = yield Promise.all([
                Posts.getPostFields(pid, ['pid', 'uid']),
                Posts.hasBookmarked(pid, uid),
            ]);
            if (isBookmarking && hasBookmarked) {
                throw new Error('[[error:already-bookmarked]]');
            }
            if (!isBookmarking && !hasBookmarked) {
                throw new Error('[[error:already-unbookmarked]]');
            }
            if (isBookmarking) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.sortedSetAdd(`uid:${uid}:bookmarks`, Date.now(), pid);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.sortedSetRemove(`uid:${uid}:bookmarks`, pid);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default[isBookmarking ? 'setAdd' : 'setRemove'](`pid:${pid}:users_bookmarked`, uid);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            postData.bookmarks = (yield database_1.default.setCount(`pid:${pid}:users_bookmarked`));
            yield Posts.setPostField(pid, 'bookmarks', postData.bookmarks);
            yield plugins_1.default.hooks.fire(`action:post.${type}`, {
                pid: pid,
                uid: uid,
                owner: postData.uid,
                current: hasBookmarked ? 'bookmarked' : 'unbookmarked',
            });
            return {
                post: postData,
                isBookmarked: isBookmarking,
            };
        });
    }
    Posts.bookmark = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield toggleBookmark('bookmark', pid, uid);
        });
    };
    Posts.unbookmark = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield toggleBookmark('unbookmark', pid, uid);
        });
    };
    Posts.hasBookmarked = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return Array.isArray(pid) ? pid.map(() => false) : false;
            }
            if (Array.isArray(pid)) {
                const sets = pid.map(pid => `pid:${pid}:users_bookmarked`);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                const returnBool = yield database_1.default.isMemberOfSets(sets, uid);
                return returnBool;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const returnBool = yield database_1.default.isSetMember(`pid:${pid}:users_bookmarked`, uid);
            return returnBool;
        });
    };
};
