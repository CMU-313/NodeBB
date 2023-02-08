import _ = require('lodash');

import meta = require('../meta');
import db = require('../database');
import plugins = require('../plugins');
import user = require('../user');
import topics = require('../topics');
import categories = require ('../categories');
import groups = require('../groups');
import utils = require('../utils');

export type PostObject = {
    pid: number;
    tid: number;
    content: string;
    uid: string;
    timestamp: number;
    isMain?: boolean;
    create?: (data: PostObject) => Promise<PostObject>;
    toPid?: number;
    ip?: number;
    handle?: number;
    cid?: number;
    uploads?: any;
  };
// type PostObject = {
//     uploads?: any;
//     pid: number;
//     tid: number;
//     content: string;
//     uid: string;
//     timestamp: number;
//     isMain: boolean;
//     create?: (data: ComposerData) => Promise<PostObject>;
//     toPid?: number;
//     ip?: number;
//     handle?: number;
//     cid?: number;
//   };

type TopicObject = {
    cid: number;
    pinned: number;
  };

type Result = {
    post: PostObject;
}

module.exports = function (Posts:PostObject) {
    Posts.create = async function (data:PostObject) {
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
        const pid:number = await db.incrObjectField('global', 'nextPid') as number;
        let postData:PostObject = {
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
        let result:Result = await plugins.hooks.fire('filter:post.create', { post: postData, data: data }) as Result;
        postData = result.post;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`post:${postData.pid}`, postData);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const topicData:TopicObject = await topics.getTopicFields(tid, ['cid', 'pinned']) as TopicObject;
        postData.cid = topicData.cid;

        async function addReplyTo(postData:PostObject, timestamp:number) {
            if (!postData.toPid) {
                return;
            }
            await Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                db.sortedSetAdd(`pid:${postData.toPid}:replies`, timestamp, postData.pid) as PostObject,
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                db.incrObjectField(`post:${postData.toPid}`, 'replies') as PostObject,
            ]);
        }

        await Promise.all([
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
        result = await plugins.hooks.fire('filter:post.get', { post: postData, uid: data.uid }) as Result;
        result.post.isMain = isMain;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        plugins.hooks.fire('action:post.save', { post: _.clone(result.post) }) as Promise<void>;
        return result.post;
    };
};
