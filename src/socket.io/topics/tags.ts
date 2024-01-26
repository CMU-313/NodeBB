import meta from '../../meta';
import user from '../../user';
import topics from '../../topics';
import categories from '../../categories';
import privileges from '../../privileges';
import utils from '../../utils';

interface Socket {
    uid: number;
    id: number;
}

interface Tag {
    value: string;
}

type SearchTagsFunction = (arg1: { cids?: number[]; cid?: number }) => Tag[];

async function searchTags(uid: number, method: SearchTagsFunction, data: {
    cids?: number[]; cid?: number
}) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const allowed: boolean = await privileges.global.can('search:tags', uid) as boolean;
    if (!allowed) {
        throw new Error('[[error:no-privileges]]');
    }
    if (data.cid) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const canRead: boolean = await privileges.categories.can('topics:read', data.cid, uid) as boolean;
        if (!canRead) {
            throw new Error('[[error:no-privileges]]');
        }
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const Cids: number[] = await categories.getCidsByPrivilege('categories:cid', uid, 'topics:read') as number[];
    data.cids = Cids;
    return method(data);
}

interface SocketTopics {
    isTagAllowed(socket: Socket, data: { cid: number; tag: string }): Promise<boolean>;
    canRemoveTag(socket: Socket, data: { tag: string }): Promise<boolean>;
    autocompleteTags(socket: Socket, data: {
        cids: number[]; cid?: number
    }): Promise<string[]>;
    searchTags(socket: Socket, data: { cids?: number[]; cid?: number }): Promise<string[]>;
    searchAndLoadTags(socket: Socket, data: { cid?: number }): Promise<Tag[]>;
    loadMoreTags(socket: Socket, data: { after: string }): Promise<{ tags: string[]; nextStart: number }>;
}

const SocketTopics: SocketTopics = {
    async isTagAllowed(socket, data) {
        if (!data || !utils.isNumber(data.cid) || !data.tag) {
            throw new Error('[[error:invalid-data]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const systemTags: string = (meta.config.systemTags || '').split(',') as string;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const [tagWhitelist, isPrivileged]: [string[], boolean] = await Promise.all([
            categories.getTagWhitelist([data.cid]),
            user.isPrivileged(socket.uid),
        ]) as [string[], boolean];
        return isPrivileged ||
            (!systemTags.includes(data.tag) && (!tagWhitelist[0].length || tagWhitelist[0].includes(data.tag)));
    },
    async canRemoveTag(socket, data) {
        if (!data || !data.tag) {
            throw new Error('[[error:invalid-data]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const systemTags: string = (meta.config.systemTags || '').split(',') as string;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isPrivileged: boolean = await user.isPrivileged(socket.uid) as boolean;
        return isPrivileged || !systemTags.includes(String(data.tag).trim());
    },
    async autocompleteTags(socket, data) {
        if (data.cid) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const canRead: boolean = await privileges.categories.can('topics:read', data.cid, socket.uid) as boolean;
            if (!canRead) {
                throw new Error('[[error:no-privileges]]');
            }
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const Cids: number[] = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read') as number[];
        data.cids = Cids;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result: Tag[] = await topics.autocompleteTags(data) as Tag[];
        return result.map(tag => tag.value);
    },
    async searchTags(socket, data) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result = await searchTags(socket.uid, (topics.searchTags as SearchTagsFunction), data);
        return result.map(tag => tag.value);
    },
    async searchAndLoadTags(socket, data) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await searchTags(socket.uid, (topics.searchAndLoadTags as SearchTagsFunction), data);
    },
    async loadMoreTags(socket, data) {
        if (!data || !utils.isNumber(data.after)) {
            throw new Error('[[error:invalid-data]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const start = parseInt(data.after, 10);
        const stop = start + 99;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const cids: number[] = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read') as number[];
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tags: string[] = await topics.getCategoryTagsData(cids, start, stop) as string[];
        return { tags: tags.filter(Boolean), nextStart: stop + 1 };
    },
};

export default SocketTopics;
