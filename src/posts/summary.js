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
// 'use strict';
// 'Unsafe assignment of an `any` value' means u should define type on the right side of the variable assignment
const validator_1 = require("validator");
const lodash_1 = __importDefault(require("lodash"));
const topics_1 = __importDefault(require("../topics"));
const user_1 = __importDefault(require("../user"));
const plugins_1 = __importDefault(require("../plugins"));
const categories_1 = __importDefault(require("../categories"));
const utils_1 = __importDefault(require("../utils"));
module.exports = function (Posts) {
    function stripTags(content) {
        if (content) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return utils_1.default.stripHTMLTags(content, utils_1.default.stripTags);
        }
        return content;
    }
    function parsePosts(posts, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (!post.content || !options.parse) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    post.content = (post.content ? validator_1.validator.escape(String(post.content)) : post.content);
                    return post;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                post = yield Posts.parsePost(post);
                // im not sure what type post should be defined as, i think it is a dictionary
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (options.stripTags) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    post.content = stripTags(post.content);
                }
                return post;
            })));
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Posts.getPostSummaryByPids = function (pids, uid, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(pids) || !pids.length) {
                return [];
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            options.stripTags = (options.hasOwnProperty('stripTags') ? options.stripTags : false);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            options.parse = (options.hasOwnProperty('parse') ? options.parse : true);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            options.extraFields = (options.hasOwnProperty('extraFields') ? options.extraFields : []);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const fields = ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted', 'upvotes', 'downvotes', 'replies', 'handle'].concat(options.extraFields);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            let posts = yield Posts.getPostsFields(pids, fields);
            // i think getPostsFields returns a dictionary?? not sure how to define that
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            posts = posts.filter(Boolean);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            posts = (yield user_1.default.blocks.filter(uid, posts));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const uids = lodash_1.default.uniq(posts.map(p => p && p.uid));
            // is it because .map returns an any typed value?
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const tids = lodash_1.default.uniq(posts.map(p => p && p.tid));
            function getTopicAndCategories(tids) {
                return __awaiter(this, void 0, void 0, function* () {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    const topicsData = yield topics_1.default.getTopicsFields(tids, [
                        'uid', 'tid', 'title', 'cid', 'tags', 'slug',
                        'deleted', 'scheduled', 'postcount', 'mainPid', 'teaserPid',
                    ]);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    const cids = lodash_1.default.uniq(topicsData.map(topic => topic && topic.cid));
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    const categoriesData = yield categories_1.default.getCategoriesFields(cids, [
                        'cid', 'name', 'icon', 'slug', 'parentCid',
                        'bgColor', 'color', 'backgroundImage', 'imageClass',
                    ]);
                    return { topics: topicsData, categories: categoriesData };
                });
            }
            const [users, topicsAndCategories] = yield Promise.all([
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                user_1.default.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status']),
                getTopicAndCategories(tids),
            ]);
            function toObject(key, data) {
                const obj = {};
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                for (let i = 0; i < data.length; i += 1) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    obj[data[i][key]] = data[i];
                }
                return obj;
            }
            const uidToUser = toObject('uid', users);
            const tidToTopic = toObject('tid', topicsAndCategories.topics);
            const cidToCategory = toObject('cid', topicsAndCategories.categories);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            posts.forEach((post) => {
                // If the post author isn't represented in the retrieved users' data,
                // then it means they were deleted, assume guest.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (!uidToUser.hasOwnProperty(post.uid)) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    post.uid = 0;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                post.user = uidToUser[post.uid];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                Posts.overrideGuestHandle(post, post.handle);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                post.handle = undefined;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                post.topic = tidToTopic[post.tid];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                post.category = (post.topic && cidToCategory[post.topic.cid]);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                post.isMainPost = post.topic && post.pid === post.topic.mainPid;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                post.deleted = post.deleted === true;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                post.timestampISO = utils_1.default.toISOString(post.timestamp);
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            posts = posts.filter(post => tidToTopic[post.tid]);
            posts = yield parsePosts(posts, options);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const result = yield plugins_1.default.hooks.fire('filter:post.getPostSummaryByPids', { posts: posts, uid: uid });
            // i think result is a dictionary?
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return result.posts;
        });
    };
};
