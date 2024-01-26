import db from '../database';
import plugins from '../plugins';
import utils from '../utils';
import { CategoryObject } from './category';
import { TopicObject } from '../types/topic';
import { UserObjectSlim } from './user';

const intFields: string[] = [
    'uid', 'pid', 'tid', 'deleted', 'timestamp',
    'upvotes', 'downvotes', 'deleterUid', 'edited',
    'replies', 'bookmarks',
];

interface PostObjectNew {
    pid: number;
    tid: number;
    content: string;
    uid: number;
    timestamp: number;
    deleted: boolean;
    upvotes: number;
    downvotes: number;
    votes: number;
    timestampISO: string;
    user: UserObjectSlim;
    topic: TopicObject;
    category: CategoryObject;
    isMainPost: boolean;
    replies: number;
    editedISO: string;
    edited: number;
}

type dataObj = {
    [key: string]: boolean;
};


interface PostResult {
    pids: number[];
    posts: PostObjectNew[];
    fields: string[];
}

interface PostsFunctions {
    getPostsFields: (pids: number[], fields: string[]) => Promise<PostObjectNew[]>;
    getPostData: (pid: number) => Promise<PostObjectNew | null>;
    getPostsData: (pids: number[]) => Promise<PostObjectNew[]>;
    getPostField: (pid: number, field: string) => Promise<number | null>;
    getPostFields: (pid: number, fields: string[]) => Promise<PostObjectNew | null>;
    setPostField: (pid: number, field: string, value: boolean) => Promise<void>;
    setPostFields: (pid: number, data: object) => Promise<void>;
}

function modifyPost(post: PostObjectNew, fields: string[]): void {
    if (post) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.parseIntFields(post, intFields, fields);
        if (post.hasOwnProperty('upvotes') && post.hasOwnProperty('downvotes')) {
            post.votes = post.upvotes - post.downvotes;
        }
        if (post.hasOwnProperty('timestamp')) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            post.timestampISO = utils.toISOString(post.timestamp) as string;
        }
        if (post.hasOwnProperty('edited')) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            post.editedISO = (post.edited !== 0 ? utils.toISOString(post.edited) : '') as string;
        }
    }
}

export = function (Posts: PostsFunctions) {
    Posts.getPostsFields = async function (pids: number[], fields: string[]): Promise<PostObjectNew[]> {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        const keys = pids.map(pid => `post:${pid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postData: PostObjectNew[] = await db.getObjects(keys, fields) as PostObjectNew[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result: PostResult = await plugins.hooks.fire('filter:post.getFields', {
            pids: pids,
            posts: postData,
            fields: fields,
        }) as PostResult;
        result.posts.forEach((post: PostObjectNew) => modifyPost(post, fields));
        return result.posts;
    };

    Posts.getPostData = async function (pid: number, callback?:(err:Error | null,
postData: PostObjectNew | null) => void): Promise<PostObjectNew | null> {
        if (typeof callback === 'function') {
            try {
                const posts = await Posts.getPostsFields([pid], []);
                const result = posts && posts.length ? posts[0] : null;
                callback(null, result);
            } catch (error) {
                callback(error as Error, null);
            }
        } else {
            const posts = await Posts.getPostsFields([pid], []);
            return posts && posts.length ? posts[0] : null;
        }
    };

    Posts.getPostsData = async function (pids: number[]): Promise<PostObjectNew[]> {
        return Posts.getPostsFields(pids, []);
    };

    Posts.getPostField = async function (pid: number, field: string): Promise<number | null> {
        const post: PostObjectNew | null = await Posts.getPostFields(pid, [field]);
        return (post ? post[field] : null) as number | null;
    };

    Posts.getPostFields = async function (pid: number, fields: string[]): Promise<PostObjectNew | null> {
        const posts: PostObjectNew[] = await Posts.getPostsFields([pid], fields);
        return posts ? posts[0] : null;
    };

    Posts.setPostField = async function (pid: number, field: string, value: boolean,
        callback?:(err:Error | null) => void): Promise<void> {
        if (typeof callback === 'function') {
            try {
                await Posts.setPostFields(pid, { [field]: value });
                callback(null);
            } catch (error) {
                callback(error as Error);
            }
        } else {
            await Posts.setPostFields(pid, { [field]: value });
        }
    };

    Posts.setPostFields = async function (pid: number, data: dataObj): Promise<void> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`post:${pid}`, data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await plugins.hooks.fire('action:post.setFields', { data: { ...data, pid } });
    };
}

