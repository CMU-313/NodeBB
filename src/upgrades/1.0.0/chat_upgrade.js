'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const async = __importStar(require("async"));
const winston = __importStar(require("winston"));
const database_1 = __importDefault(require("../../database"));
module.exports = {
    name: 'Upgrading chats',
    timestamp: Date.UTC(2015, 11, 15),
    method: function (callback) {
        database_1.default.getObjectFields('global', ['nextMid', 'nextChatRoomId'], (err, globalData) => {
            if (err) {
                return callback(err);
            }
            const rooms = {};
            let roomId = globalData.nextChatRoomId || 1;
            let currentMid = 1;
            async.whilst((next) => {
                next(null, currentMid <= globalData.nextMid);
            }, (next) => {
                database_1.default.getObject(`message:${currentMid}`, (err, message) => {
                    if (err || !message) {
                        winston.verbose('skipping chat message ', currentMid);
                        currentMid += 1;
                        return next(err);
                    }
                    const pairID = [parseInt(message.fromuid, 10), parseInt(message.touid, 10)].sort().join(':');
                    const msgTime = parseInt(message.timestamp, 10);
                    function addMessageToUids(roomId, callback) {
                        async.parallel([
                            function (next) {
                                database_1.default.sortedSetAdd(`uid:${message.fromuid}:chat:room:${roomId}:mids`, msgTime, currentMid, next);
                            },
                            function (next) {
                                database_1.default.sortedSetAdd(`uid:${message.touid}:chat:room:${roomId}:mids`, msgTime, currentMid, next);
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
                    }
                    else {
                        winston.verbose(`adding message ${currentMid} to new roomID ${roomId}`);
                        async.parallel([
                            function (next) {
                                database_1.default.sortedSetAdd(`uid:${message.fromuid}:chat:rooms`, msgTime, roomId, next);
                            },
                            function (next) {
                                database_1.default.sortedSetAdd(`uid:${message.touid}:chat:rooms`, msgTime, roomId, next);
                            },
                            function (next) {
                                database_1.default.sortedSetAdd(`chat:room:${roomId}:uids`, [msgTime, msgTime + 1], [message.fromuid, message.touid], next);
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
                            database_1.default.setObjectField('global', 'nextChatRoomId', roomId, next);
                        });
                    }
                });
            }, callback);
        });
    },
};
