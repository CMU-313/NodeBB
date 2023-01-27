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
const async_1 = __importDefault(require("async"));
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
exports.default = (Topics) => {
    Topics.getUserBookmark = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return null;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield database_1.default.sortedSetScore(`tid:${tid}:bookmarks`, uid);
        });
    };
    Topics.getUserBookmarks = function (tids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (parseInt(uid, 10) <= 0) {
                return tids.map(() => null);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield database_1.default.sortedSetsScore(tids.map(tid => `tid:${tid}:bookmarks`), uid);
        });
    };
    Topics.setUserBookmark = function (tid, uid, index) {
        return __awaiter(this, void 0, void 0, function* () {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetAdd(`tid:${tid}:bookmarks`, index, uid);
        });
    };
    Topics.getTopicBookmarks = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield database_1.default.getSortedSetRangeWithScores(`tid:${tid}:bookmarks`, 0, -1);
        });
    };
    Topics.updateTopicBookmarks = function (tid, pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxIndex = yield Topics.getPostCount(tid);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const indices = yield database_1.default.sortedSetRanks(`tid:${tid}:posts`, pids);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const postIndices = indices.map((i) => (i === null ? 0 : i + 1));
            const minIndex = Math.min(...postIndices);
            const bookmarks = yield Topics.getTopicBookmarks(tid);
            const uidData = 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            bookmarks.map((b) => ({ uid: b.value, bookmark: parseInt(b.score, 10) })).filter((data) => data.bookmark >= minIndex);
            yield async_1.default.eachLimit(uidData, 50, (data) => __awaiter(this, void 0, void 0, function* () {
                let bookmark = Math.min(data.bookmark, maxIndex);
                postIndices.forEach((i) => {
                    if (i < data.bookmark) {
                        bookmark -= 1;
                    }
                });
                // make sure the bookmark is valid if we removed the last post
                bookmark = Math.min(bookmark, maxIndex - pids.length);
                if (bookmark === data.bookmark) {
                    return;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                const settings = yield user_1.default.getSettings(data.uid);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (settings.topicPostSort === 'most_votes') {
                    return;
                }
                yield Topics.setUserBookmark(tid, data.uid, bookmark);
            }));
        });
    };
};
