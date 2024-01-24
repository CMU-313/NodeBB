
import db from '../database';
import plugins from '../plugins';
import utils from '../utils';

const intFields: string[] = [
    'uid', 'pid', 'tid', 'deleted', 'timestamp',
    'upvotes', 'downvotes', 'deleterUid', 'edited',
    'replies', 'bookmarks',
];

interface PostData {
    deleted?: number;
    timestamp?: number;
    upvotes?: number;
    downvotes?: number;
    edited?: number;
    votes?: number;
    timestampISO?: string;
    editedISO?: string;
    [key: string]: number | string | boolean | undefined;
}

interface PostResult {
    pids: number[];
    posts: PostData[];
    fields: string[];
}

interface PostsFunctions {
    getPostsFields: (pids: number[], fields: string[]) => Promise<PostData[]>;
    getPostData: (pid: number) => Promise<PostData | null>;
    getPostsData: (pids: number[]) => Promise<PostData[]>;
    getPostField: (pid: number, field: string) => Promise<number | string | boolean | null>;
    getPostFields: (pid: number, fields: string[]) => Promise<PostData | null>;
    setPostField: (pid: number, field: string, value: string | number | boolean) => Promise<void>;
    setPostFields: (pid: number, data: PostData) => Promise<void>;
}

function modifyPost(post: PostData, fields: string[]): void {
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
    Posts.getPostsFields = async function (pids: number[], fields: string[]): Promise<PostData[]> {
        if (!Array.isArray(pids) || !pids.length) {
            return [];
        }
        const keys = pids.map(pid => `post:${pid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const postData: PostData[] = await db.getObjects(keys, fields) as PostData[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result: PostResult = await plugins.hooks.fire('filter:post.getFields', {
            pids: pids,
            posts: postData,
            fields: fields,
        }) as PostResult;
        result.posts.forEach((post: PostData) => modifyPost(post, fields));
        return result.posts;
    };

    Posts.getPostData = async function (pid: number): Promise<PostData | null> {
        const posts = await Posts.getPostsFields([pid], []);
        return posts && posts.length ? posts[0] : null;
    };

    Posts.getPostsData = async function (pids: number[]): Promise<PostData[]> {
        return Posts.getPostsFields(pids, []);
    };

    Posts.getPostField = async function (pid: number, field: string): Promise<number | string | boolean | null> {
        const post: PostData = await Posts.getPostFields(pid, [field]);
        return post ? post[field] : null;
    };

    Posts.getPostFields = async function (pid: number, fields: string[]): Promise<PostData | null> {
        const posts: PostData[] = await Posts.getPostsFields([pid], fields);
        return posts && posts.length ? posts[0] : null;
    };

    Posts.setPostField = async function (pid: number, field: string, value: string | number | boolean): Promise<void> {
        await Posts.setPostFields(pid, { [field]: value });
    };
    Posts.setPostFields = async function (pid: number, data: PostData): Promise<void> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`post:${pid}`, data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await plugins.hooks.fire('action:post.setFields', { data: { ...data, pid } });
    };
}


