import async from 'async';
import winston from 'winston';
import db from '../../database';

interface GlobalData {
  nextMid: number;
  nextChatRoomId: number;
}

interface Message {
  fromuid: string;
  touid: string;
  timestamp: string;
}

interface Rooms {
  [key: string]: number;
}

const upgradeChats = {
  name: 'Upgrading chats',
  timestamp: Date.UTC(2015, 11, 15),
  method: function (callback: (err?: Error) => void) {
    db.getObjectFields('global', ['nextMid', 'nextChatRoomId'], (err: Error, globalData: GlobalData) => {
      if (err) {
        return callback(err);
      }

      const rooms: Rooms = {};
      let roomId: number = globalData.nextChatRoomId || 1;
      let currentMid: number = 1;

      async.whilst(
        (next: (err: Error | null, result: boolean) => void) => {
          next(null, currentMid <= globalData.nextMid);
        },
        (next: (err?: Error) => void) => {
          db.getObject(`message:${currentMid}`, (err: Error, message: Message) => {
            if (err || !message) {
              winston.verbose('skipping chat message ', currentMid);
              currentMid += 1;
              return next(err);
            }

            const pairID: string = [parseInt(message.fromuid, 10), parseInt(message.touid, 10)].sort().join(':');
            const msgTime: number = parseInt(message.timestamp, 10);

            function addMessageToUids(roomId: number, callback: (err?: Error) => void) {
              async.parallel([
                function (next) {
                  db.sortedSetAdd(`uid:${message.fromuid}:chat:room:${roomId}:mids`, msgTime, currentMid, next);
                },
                function (next) {
                  db.sortedSetAdd(`uid:${message.touid}:chat:room:${roomId}:mids`, msgTime, currentMid, next);
                },
              ], callback);
            }

            if (rooms[pairID]) {
              winston.verbose(`adding message ${currentMid} to existing roomID ${roomId}`);
              addMessageToUids(rooms[pairID], (err) => {
                if (err) {
                  return next(err);
                }
                currentMid += 1;
                next();
              });
            } else {
              winston.verbose(`adding message ${currentMid} to new roomID ${roomId}`);
              async.parallel([
                function (next) {
                  db.sortedSetAdd(`uid:${message.fromuid}:chat:rooms`, msgTime, roomId, next);
                },
                function (next) {
                  db.sortedSetAdd(`uid:${message.touid}:chat:rooms`, msgTime, roomId, next);
                },
                function (next) {
                  db.sortedSetAdd(`chat:room:${roomId}:uids`, [msgTime, msgTime + 1], [message.fromuid, message.touid], next);
                },
                function (next) {
                  addMessageToUids(roomId, next);
                },
              ], (err) => {
                if (err) {
                  return next(err);
                }
                rooms[pairID] = roomId;
                roomId += 1;
                currentMid += 1;
                db.setObjectField('global', 'nextChatRoomId', roomId, next);
              });
            }
          });
        },
        callback
      );
    });
  },
};

export default upgradeChats;