import db from '../database';
import plugins from '../plugins';
import utils from '../utils';

import { PostObject } from '../types';

const intFields: string[] = [
    'uid', 'pid', 'tid', 'deleted', 'timestamp',
    'upvotes', 'downvotes', 'deleterUid', 'edited',
    'replies', 'bookmarks',
];

interface PostObjectNew extends PostObject {
    edited: number,
    editedISO: string;
}
interface Posts {
    getPostsFields: (pids: number[], fields: string[]) => Promise<PostObject[]>,
    getPostData: (pid: number) => Promise<PostObject>,
    getPostsData: (pids: number[]) => Promise<PostObject[]>,
    getPostField: (pid: number, field: string) => Promise<PostObject>,
    getPostFields: (pid: number, fields: string[]) => Promise<PostObject>,
    setPostField: (pid: number, field: string, value: number) => Promise<void>,
    setPostFields: (pid: number, data: object) => Promise<void>;
}

function modifyPost(post: PostObjectNew, fields: string[]) {
    if (post) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.parseIntFields(post, intFields, fields);
        if (post.hasOwnProperty('upvotes') && post.hasOwnProperty('downvotes')) {
            post.votes = post.upvotes - post.downvotes;
        }
        if (post.hasOwnProperty('timestamp')) {
            post.timestampISO = utils.toISOString(post.timestamp) as string;
        }
        if (post.hasOwnProperty('edited')) {
            post.editedISO = (post.edited !== 0 ? utils.toISOString(post.edited) : '') as string;
        }
    }
}

export = function (Posts: Posts) {
    Posts.getPostsFields = async function (pids: number[], fields: string[]): Promise<PostObject[]> {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        const keys = pids.map(pid => `post:${pid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postData: PostObject[] = (await db.getObjects(keys, fields)) as PostObject[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result: {posts: PostObject[]} = (await plugins.hooks.fire('filter:post.getFields', {
            pids: pids,
            posts: postData,
            fields: fields,
        })) as {posts: PostObject[]};
        result.posts.forEach((post: PostObjectNew) => modifyPost(post, fields));
        return result.posts;
    };

    Posts.getPostData = async function (pid: number): Promise<PostObject> {
        const posts = await Posts.getPostsFields([pid], []);
        return posts && posts.length ? posts[0] : null;
    };

    Posts.getPostsData = async function (pids: number[]): Promise<PostObject[]> {
        return await Posts.getPostsFields(pids, []);
    };

    Posts.getPostField = async function (pid: number, field: string): Promise<PostObject> {
        const post = await Posts.getPostFields(pid, [field]);
        return (post ? post[field] : null) as PostObject;
    };

    Posts.getPostFields = async function (pid: number, fields: string[]): Promise<PostObject> {
        const posts = await Posts.getPostsFields([pid], fields);
        return posts ? posts[0] : null;
    };

    Posts.setPostField = async function (pid: number, field: string, value: number): Promise<void> {
        await Posts.setPostFields(pid, { [field]: value });
    };

    Posts.setPostFields = async function (pid: number, data: object): Promise<void> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`post:${pid}`, data);
        await plugins.hooks.fire('action:post.setFields', { data: { ...data, pid } });
    };
};
