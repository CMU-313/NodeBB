
// 'use strict';
// 'Unsafe assignment of an `any` value' means u should define type on the right side of the variable assignment
import { validator } from 'validator';
import _ from 'lodash';
import topics from '../topics';
import user from '../user';
import plugins from '../plugins';
import categories from '../categories';
import utils from '../utils';

import { CategoryObject, PostObject, TagObject } from '../types';

interface PostObjectNew extends PostObject {
    handle;
}

interface Posts {
    getPostSummaryByPids: (pids: number[], uid, options) => Promise<PostObject[]>,
    getPostsFields: (pids: number[], fields: string[]) => Promise<PostObject[]>,
    overrideGuestHandle(postData, handle),
    parsePost: (post: PostObject) => Promise<PostObject>;
}
type TopicObject = {
    map(arg0: (topic: TopicObject) => number): _.List<unknown>;
    uid: number,
    tid: number,
    title: string,
    cid: number,
    tags: TagObject[],
    slug: string,
    deleted: string,
    scheduled: string,
    postcount: string,
    mainPid: number,
    teaserPid: number | string;
};

export = function (Posts: Posts) {
    function stripTags(content:string) {
        if (content) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return utils.stripHTMLTags(content, utils.stripTags);
        }
        return content;
    }
    async function parsePosts(posts: PostObject[], options) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await Promise.all(posts.map(async (post) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (!post.content || !options.parse) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                post.content = (post.content ? validator.escape(String(post.content)) : post.content) as string;
                return post;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            post = await Posts.parsePost(post);
            // im not sure what type post should be defined as, i think it is a dictionary
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (options.stripTags) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                post.content = stripTags(post.content);
            }
            return post;
        }));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Posts.getPostSummaryByPids = async function (pids, uid, options) {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        options.stripTags = (options.hasOwnProperty('stripTags') ? options.stripTags : false) as boolean;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        options.parse = (options.hasOwnProperty('parse') ? options.parse : true) as boolean;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        options.extraFields = (options.hasOwnProperty('extraFields') ? options.extraFields : []) as boolean | ConcatArray<string>;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const fields = ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted', 'upvotes', 'downvotes', 'replies', 'handle'].concat(options.extraFields as string);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let posts = await Posts.getPostsFields(pids, fields);
        // i think getPostsFields returns a dictionary?? not sure how to define that
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        posts = posts.filter(Boolean);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        posts = await user.blocks.filter(uid, posts) as PostObject[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uids = _.uniq(posts.map(p => p && p.uid));
        // is it because .map returns an any typed value?
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tids = _.uniq(posts.map(p => p && p.tid));

        async function getTopicAndCategories(tids: number[]) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const topicsData: TopicObject = await topics.getTopicsFields(tids, [
                'uid', 'tid', 'title', 'cid', 'tags', 'slug',
                'deleted', 'scheduled', 'postcount', 'mainPid', 'teaserPid',
            ]) as TopicObject;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const cids = _.uniq(topicsData.map(topic => topic && topic.cid));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const categoriesData: string[] = await categories.getCategoriesFields(cids, [
                'cid', 'name', 'icon', 'slug', 'parentCid',
                'bgColor', 'color', 'backgroundImage', 'imageClass',
            ]) as string[];
            return { topics: topicsData, categories: categoriesData };
        }

        const [users, topicsAndCategories] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status']),
            getTopicAndCategories(tids),
        ]);
        function toObject(key, data) {
            const obj = {};
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            for (let i = 0; i < data.length; i += 1) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                obj[data[i][key]] = data[i] as string;
            }
            return obj;
        }

        const uidToUser = toObject('uid', users);
        const tidToTopic = toObject('tid', topicsAndCategories.topics);
        const cidToCategory = toObject('cid', topicsAndCategories.categories);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        posts.forEach((post: PostObjectNew) => {
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
            post.category = (post.topic && cidToCategory[post.topic.cid]) as CategoryObject;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            post.isMainPost = post.topic && post.pid === post.topic.mainPid;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            post.deleted = post.deleted === true as boolean;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            post.timestampISO = utils.toISOString(post.timestamp) as string;
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        posts = posts.filter(post => tidToTopic[post.tid]);

        posts = await parsePosts(posts, options);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result: {posts: PostObject[]} = await plugins.hooks.fire('filter:post.getPostSummaryByPids', { posts: posts, uid: uid as number });
        // i think result is a dictionary?
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return result.posts;
    };
};
