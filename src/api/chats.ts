
import validator from 'validator';

import user from '../user';
import meta from '../meta';
import messaging from '../messaging';
import plugins from '../plugins';

import socketHelpers from '../socket.io/helpers';



type Session = {
    lastChatMessageTime : number
}

type Data = {
    uids : string[]
    roomId: number
    message: string
    name : string
}

type Request = {
    session : Session
}

type Caller = {
    request : Request,
    session : Session
    uid : string
    ip : string
}



type EventData = {
    roomId : number,
    newName : string
}

type User = {
    uid : string,
    canKick : boolean
}



type Hook = {
    data : Data
    uid : number
}



function rateLimitExceeded(caller : Caller) : boolean {
    const session : Session = caller.request ? caller.request.session : caller.session; // socket vs req
    const now : number = Date.now();
    session.lastChatMessageTime = session.lastChatMessageTime || 0;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (now - session.lastChatMessageTime < meta.config.chatMessageDelay) {
        return true;
    }
    session.lastChatMessageTime = now;
    return false;
}


export async function create(caller : Caller, data : Data) {
    if (rateLimitExceeded(caller)) {
        throw new Error('[[error:too-many-messages]]');
    }

    if (!data.uids || !Array.isArray(data.uids)) {
        throw new Error(`[[error:wrong-parameter-type, uids, ${typeof data.uids}, Array]]`);
    }


    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await Promise.all(data.uids.map(async uid => messaging.canMessageUser(caller.uid, uid)));

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const roomId : number = await messaging.newRoom(caller.uid, data.uids) as number;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call,
    return await messaging.getRoomData(roomId);
}



export async function post(caller : Caller, data : Data) {
    if (rateLimitExceeded(caller)) {
        throw new Error('[[error:too-many-messages]]');
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const aggregateHook : Hook = await plugins.hooks.fire('filter:messaging.send', {
        data,
        uid: caller.uid,
    }) as Hook;
    ({ data } = aggregateHook);
    // This part has been modified from the original code so that we can first get the data
    // in its aggregated form, then deconstruct to get the data from the return value
    // This helps ensure the types in between

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.canMessageRoom(caller.uid, data.roomId);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const message : string = await messaging.sendMessage({
        uid: caller.uid,
        roomId: data.roomId,
        content: data.message,
        timestamp: Date.now(),
        ip: caller.ip,
    }) as string;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    messaging.notifyUsersInRoom(caller.uid, data.roomId, message);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    user.updateOnlineUsers(caller.uid);

    return message;
}



export async function rename(caller : Caller, data : Data) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.renameRoom(caller.uid, data.roomId, data.name);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const uids : number[] = await messaging.getUidsInRoom(data.roomId, 0, -1) as number[];
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const eventData : EventData = { roomId: data.roomId, newName: validator.escape(String(data.name)) as string };

    await socketHelpers.emitToUids('event:chats.roomRename', eventData, uids);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return messaging.loadRoom(caller.uid, {
        roomId: data.roomId,
    });
}



export async function users(caller : Caller, data : Data) {
    const [isOwner, users] : [boolean, User[]] = await Promise.all([
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        messaging.isRoomOwner(caller.uid, data.roomId),
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        messaging.getUsersInRoom(data.roomId, 0, -1),
    ] as [boolean, User[]]);
    users.forEach((user) => {
        user.canKick = (parseInt(user.uid, 10) !== parseInt(caller.uid, 10)) && isOwner;
    });
    return { users };
}


export async function invite(caller : Caller, data : Data) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const userCount : number = await messaging.getUserCountInRoom(data.roomId) as number;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const maxUsers : number = meta.config.maximumUsersInChatRoom as number;
    if (maxUsers && userCount >= maxUsers) {
        throw new Error('[[error:cant-add-more-users-to-chat-room]]');
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const uidsExist : boolean[] = await user.exists(data.uids) as boolean[];
    if (!uidsExist.every(Boolean)) {
        throw new Error('[[error:no-user]]');
    }
    await Promise.all(data.uids.map(async uid => messaging.canMessageUser(caller.uid, uid)));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await messaging.addUsersToRoom(caller.uid, data.uids, data.roomId);

    delete data.uids;
    return users(caller, data);
}


export async function kick(caller : Caller, data: Data) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const uidsExist : boolean[] = await user.exists(data.uids) as boolean[];
    if (!uidsExist.every(Boolean)) {
        throw new Error('[[error:no-user]]');
    }

    // Additional checks if kicking vs leaving
    if (data.uids.length === 1 && parseInt(data.uids[0], 10) === parseInt(caller.uid, 10)) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await messaging.leaveRoom([caller.uid], data.roomId);
    } else {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await messaging.removeUsersFromRoom(caller.uid, data.uids, data.roomId);
    }

    delete data.uids;
    return users(caller, data);
}
