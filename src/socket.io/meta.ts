

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
import user from '../user';
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
import topics from '../topics';

// socket interface
interface Socket {
    uid: any;
    currentRoom: any;
    leave: (_:any) => Promise<void>; // is a function
    join: (_:any) => Promise<void>; //is a function
}
// data's interface
interface Data {
    enter: string;
}

// interface Callback {
//     (void) : void;
// } // is a function which inputs void or error

interface SocketMeta {
    rooms: {
        enter (Socket, Date, (void) => void|never) : void|never;
        leaveCurrent (Socket, Date, () => void|never) : void|never;
    }
    reconnected (Socket, Date, (void) => void|never) : void|never;
};

SocketMeta.reconnected = function (socket: Socket, _data : Data, callback : (void) => void|never) : void {
    callback = callback || function () {};
    if (socket.uid) {
        topics.pushUnreadCount(socket.uid);
        user.notifications.pushCount(socket.uid);
    }
    callback();
};

/* Rooms */

function leaveCurrentRoom(socket: Socket) : void {
    if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
        socket.currentRoom = '';
    }
}

SocketMeta.rooms.enter = function (socket : Socket, data : Data, callback : () => void | never) : void | never {
    if (!socket.uid) {
        return callback();
    }

    if (!data) {
        return callback(new Error('[[error:invalid-data]]'));
    }

    if (data.enter) {
        data.enter = data.enter.toString();
    }

    if (data.enter && data.enter.startsWith('uid_') && data.enter !== `uid_${socket.uid}`) {
        return callback(new Error('[[error:not-allowed]]'));
    }

    leaveCurrentRoom(socket);

    if (data.enter) {
        socket.join(data.enter);
        socket.currentRoom = data.enter;
    }
    callback();
};

SocketMeta.rooms.leaveCurrent = function (socket, _data, callback) : void {
    if (!socket.uid || !socket.currentRoom) {
        return callback();
    }
    leaveCurrentRoom(socket);
    callback();
};

module.exports = SocketMeta;
