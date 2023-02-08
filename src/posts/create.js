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
const _ = require("lodash");
const meta = require("../meta");
const db = require("../database");
const plugins = require("../plugins");
const user = require("../user");
const topics = require("../topics");
const categories = require("../categories");
const groups = require("../groups");
const utils = require("../utils");
module.exports = function (Posts) {
    Posts.create = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            // This is an internal method, consider using Topics.reply instead
            const { uid } = data;
            const { tid } = data;
            const content = data.content.toString();
            const timestamp = data.timestamp || Date.now();
            const isMain = data.isMain || false;
            if (!uid && parseInt(uid, 10) !== 0) {
                throw new Error('[[error:invalid-uid]]');
            }
            if (data.toPid && !utils.isNumber(data.toPid)) {
                throw new Error('[[error:invalid-pid]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const pid = yield db.incrObjectField('global', 'nextPid');
            let postData = {
                pid: pid,
                uid: uid,
                tid: tid,
                content: content,
                timestamp: timestamp,
            };
            if (data.toPid) {
                postData.toPid = data.toPid;
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (data.ip && meta.config.trackIpPerPost) {
                postData.ip = data.ip;
            }
            if (data.handle && !parseInt(uid, 10)) {
                postData.handle = data.handle;
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            let result = yield plugins.hooks.fire('filter:post.create', { post: postData, data: data });
            postData = result.post;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield db.setObject(`post:${postData.pid}`, postData);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const topicData = yield topics.getTopicFields(tid, ['cid', 'pinned']);
            postData.cid = topicData.cid;
            function addReplyTo(postData, timestamp) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (!postData.toPid) {
                        return;
                    }
                    yield Promise.all([
                        // The next line calls a function in a module that has not been updated to TS yet
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                        db.sortedSetAdd(`pid:${postData.toPid}:replies`, timestamp, postData.pid),
                        // The next line calls a function in a module that has not been updated to TS yet
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                        db.incrObjectField(`post:${postData.toPid}`, 'replies'),
                    ]);
                });
            }
            yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                db.sortedSetAdd('posts:pid', timestamp, postData.pid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                db.incrObjectField('global', 'postCount'),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                user.onNewPostMade(postData),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                topics.onNewPostMade(postData),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                categories.onNewPostMade(topicData.cid, topicData.pinned, postData),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                groups.onNewPostMade(postData),
                addReplyTo(postData, timestamp),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                Posts.uploads.sync(postData.pid),
            ]);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            result = (yield plugins.hooks.fire('filter:post.get', { post: postData, uid: data.uid }));
            result.post.isMain = isMain;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            plugins.hooks.fire('action:post.save', { post: _.clone(result.post) });
            return result.post;
        });
    };
};
