"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const database_1 = __importDefault(require("../database"));
const plugins_1 = __importDefault(require("../plugins"));
const utils_1 = __importDefault(require("../utils"));
const intFields = [
    'uid', 'pid', 'tid', 'deleted', 'timestamp',
    'upvotes', 'downvotes', 'deleterUid', 'edited',
    'replies', 'bookmarks',
];
function modifyPost(post, fields) {
    if (post) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        database_1.default.parseIntFields(post, intFields, fields);
        if (post.hasOwnProperty('upvotes') && post.hasOwnProperty('downvotes')) {
            post.votes = post.upvotes - post.downvotes;
        }
        if (post.hasOwnProperty('timestamp')) {
            post.timestampISO = utils_1.default.toISOString(post.timestamp);
        }
        if (post.hasOwnProperty('edited')) {
            post.editedISO = (post.edited !== 0 ? utils_1.default.toISOString(post.edited) : '');
        }
    }
}
module.exports = function (Posts) {
    Posts.getPostsFields = async function (pids, fields) {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        const keys = pids.map(pid => `post:${pid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postData = (await database_1.default.getObjects(keys, fields));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result = (await plugins_1.default.hooks.fire('filter:post.getFields', {
            pids: pids,
            posts: postData,
            fields: fields,
        }));
        result.posts.forEach((post) => modifyPost(post, fields));
        return result.posts;
    };
    Posts.getPostData = async function (pid) {
        const posts = await Posts.getPostsFields([pid], []);
        return posts && posts.length ? posts[0] : null;
    };
    Posts.getPostsData = async function (pids) {
        return await Posts.getPostsFields(pids, []);
    };
    Posts.getPostField = async function (pid, field) {
        const post = await Posts.getPostFields(pid, [field]);
        return (post ? post[field] : null);
    };
    Posts.getPostFields = async function (pid, fields) {
        const posts = await Posts.getPostsFields([pid], fields);
        return posts ? posts[0] : null;
    };
    Posts.setPostField = async function (pid, field, value) {
        await Posts.setPostFields(pid, { [field]: value });
    };
    Posts.setPostFields = async function (pid, data) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await database_1.default.setObject(`post:${pid}`, data);
        await plugins_1.default.hooks.fire('action:post.setFields', { data: Object.assign(Object.assign({}, data), { pid }) });
    };
};
