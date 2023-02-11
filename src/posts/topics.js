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
const topics_1 = __importDefault(require("../topics"));
const user_1 = __importDefault(require("../user"));
const utils_1 = __importDefault(require("../utils"));
module.exports = function Posts(Posts) {
    Posts.getPostsFromSet = function (set, start, stop, uid, reverse) {
        return __awaiter(this, void 0, void 0, function* () {
            const pids = Posts.getPidsFromSet(set, start, stop, reverse);
            const posts = Posts.getPostsByPids(pids, uid);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield user_1.default.blocks.filter(uid, posts);
        });
    };
    Posts.isMain = function (pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = yield Posts.getPostsFields(pids, ['tid']);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const topicData = yield topics_1.default.getTopicsFields(postData.map(t => t.tid), ['mainPid']);
            console.log(typeof pids);
            console.log('line 42');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const result = pids.map((value, i) => parseInt(value, 10) === parseInt(topicData[i].mainPid, 10));
            return result[0];
        });
    };
    Posts.getTopicFields = function (pid, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const tid = yield Posts.getPostField(pid, 'tid');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield topics_1.default.getTopicFields(tid, fields);
        });
    };
    Posts.generatePostPath = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = Posts.generatePostPaths([pid], uid);
            return yield paths[0];
        });
    };
    Posts.generatePostPaths = function (pids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = yield Posts.getPostsFields(pids, ['pid', 'tid']);
            const tids = postData.map(post => post && post.tid);
            const [indices, topicData] = yield Promise.all([
                Posts.getPostIndices(postData, uid),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                topics_1.default.getTopicsFields(tids, ['slug']),
            ]);
            console.log(typeof pids);
            const paths = pids.map((pid, index) => {
                const slug = topicData[index] ? topicData[index].slug : null;
                const postIndex = utils_1.default.isNumber(indices[index]) ? parseInt(indices[index], 10) + 1 : null;
                if (slug && postIndex) {
                    return `/topic/${slug}/${postIndex}`;
                }
                return null;
            });
            return paths;
        });
    };
};
