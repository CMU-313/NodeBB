import { db } from '../../database';
import { user } from '../../user';
import { topics } from '../../topics';

interface Socket {
    uid: number;
    id: number;
}

interface Topic {
    tid: number;
    cid: number;
}

interface SocketTopics {
    markAsRead(socket: Socket, tids: number[]): Promise<void>;
    markTopicNotificationsRead(socket: Socket, tids: number[]): Promise<void>;
    markAllRead(socket: Socket): Promise<void>;
    markCategoryTopicsRead(socket: Socket, cid: number): Promise<void>;
    markUnread(socket: Socket, tid: number): Promise<void>;
    markAsUnreadForAll(socket: Socket, tids: number[]): Promise<void>;
  }

export = function (SocketTopics: SocketTopics) {
    SocketTopics.markAsRead = async function (socket: Socket, tids: number[]): Promise<void> {
        if (!Array.isArray(tids) || socket.uid <= 0) {
            throw new Error('[[error:invalid-data]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const hasMarked: boolean = await topics.markAsRead(tids, socket.uid) as boolean;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const promises = [topics.markTopicNotificationsRead(tids, socket.uid)];
        if (hasMarked) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            promises.push(topics.pushUnreadCount(socket.uid));
        }
        await Promise.all(promises);
    };

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    SocketTopics.markTopicNotificationsRead = async function (socket: Socket, tids: number[]): Promise<void> {
        if (!Array.isArray(tids) || !socket.uid) {
            throw new Error('[[error:invalid-data]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await topics.markTopicNotificationsRead(tids, socket.uid);
    };

    SocketTopics.markAllRead = async function (socket: Socket): Promise<void> {
        if (socket.uid <= 0) {
            throw new Error('[[error:invalid-uid]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await topics.markAllRead(socket.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        topics.pushUnreadCount(socket.uid);
    };

    SocketTopics.markCategoryTopicsRead = async function (socket: Socket, cid: number): Promise<void> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tids: number[] = await topics.getUnreadTids({ cid: cid, uid: socket.uid, filter: '' }) as number[];
        await SocketTopics.markAsRead(socket, tids);
    };

    SocketTopics.markUnread = async function (socket: Socket, tid: number): Promise<void> {
        if (!tid || socket.uid <= 0) {
            throw new Error('[[error:invalid-data]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await topics.markUnread(tid, socket.uid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        topics.pushUnreadCount(socket.uid);
    };

    SocketTopics.markAsUnreadForAll = async function (socket: Socket, tids: number[]): Promise<void> {
        if (!Array.isArray(tids)) {
            throw new Error('[[error:invalid-tid]]');
        }

        if (socket.uid <= 0) {
            throw new Error('[[error:no-privileges]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isAdmin: boolean = await user.isAdministrator(socket.uid) as boolean;
        const now = Date.now();
        await Promise.all(tids.map(async (tid) => {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const topicData: Topic = await topics.getTopicFields(tid, ['tid', 'cid']) as Topic;
            if (!topicData.tid) {
                throw new Error('[[error:no-topic]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const isMod: boolean = await user.isModerator(socket.uid, topicData.cid) as boolean;
            if (!isAdmin && !isMod) {
                throw new Error('[[error:no-privileges]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await topics.markAsUnreadForAll(tid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await topics.updateRecent(tid, now);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, now, tid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await topics.setTopicField(tid, 'lastposttime', now);
        }));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        topics.pushUnreadCount(socket.uid);
    };
};
