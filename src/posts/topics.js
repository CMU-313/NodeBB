"use strict";
// 'use strict';
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
// const topics = require('../topics');
const topics = require("../topics");
// const user = require('../user');
const user = require("../user");
// const utils = require('../utils');
const utils = require("../utils");
exports.default = (Posts) => {
    // The next line is a local declaration of a method for the object argument of the exported funtion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Posts.getPostsFromSet = function (set, start, stop, uid, reverse) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line is a local declaration of a method for the object argument of the exported funtion
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            const pids = yield Posts.getPidsFromSet(set, start, stop, reverse);
            // The next line is a local declaration of a method for the object argument of the exported funtion
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            const posts = yield Posts.getPostsByPids(pids, uid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            return yield user.blocks.filter(uid, posts);
        });
    };
    // The next line is a local declaration of a method for the object argument of the exported funtion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Posts.isMain = function (pids) {
        return __awaiter(this, void 0, void 0, function* () {
            const isArray = Array.isArray(pids);
            // TypeScript is unable to correctly reason about the type here
            pids = isArray ? pids : [pids];
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            const postData = yield Posts.getPostsFields(pids, ['tid']);
            // PostObject
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
            const topicData = yield topics.getTopicsFields(postData.map(t => t.tid), ['mainPid']);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            const result = pids.map((pid, i) => parseInt(pid, 10) === parseInt(topicData[i].mainPid, 10));
            return isArray ? result : result[0];
        });
    };
    // The next line is a local declaration of a method for the object argument of the exported funtion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Posts.getTopicFields = function (pid, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            const tid = yield Posts.getPostField(pid, 'tid');
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            return yield topics.getTopicFields(tid, fields);
        });
    };
    // The next line is a local declaration of a method for the object argument of the exported funtion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Posts.generatePostPath = function (pid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            const paths = yield Posts.generatePostPaths([pid], uid);
            return Array.isArray(paths) && paths.length ? paths[0] : null;
        });
    };
    // The next line is a local declaration of a method for the object argument of the exported funtion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Posts.generatePostPaths = function (pids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line max-len
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
            const postData = yield Posts.getPostsFields(pids, ['pid', 'tid']);
            const tids = postData.map(post => post && post.tid);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const [indices, topicData] = yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                Posts.getPostIndices(postData, uid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                topics.getTopicsFields(tids, ['slug']),
            ]);
            const paths = pids.map((pid, index) => {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
                const slug = topicData[index] ? topicData[index].slug : null;
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line max-len
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
                const postIndex = utils.isNumber(indices[index]) ? parseInt(indices[index], 10) + 1 : null;
                if (slug && postIndex) {
                    return `/topic/${slug}/${postIndex}`;
                }
                return null;
            });
            return paths;
        });
    };
};
