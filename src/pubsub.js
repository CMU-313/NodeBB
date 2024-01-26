"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const nconf_1 = __importDefault(require("nconf"));
const ps = require("./database/redis/pubsub");
let real;
let noCluster;
let singleHost;
function get() {
    if (real) {
        return real;
    }
    let pubsub;
    if (!nconf_1.default.get('isCluster')) {
        if (noCluster) {
            real = noCluster;
            return real;
        }
        noCluster = new events_1.EventEmitter();
        noCluster.publish = noCluster.emit.bind(noCluster);
        pubsub = noCluster;
    }
    else if (nconf_1.default.get('singleHostCluster')) {
        if (singleHost) {
            real = singleHost;
            return real;
        }
        singleHost = new events_1.EventEmitter();
        if (!process.send) {
            noCluster.publish = noCluster.emit.bind(noCluster);
        }
        else {
            singleHost.publish = function (event, data) {
                process.send({
                    action: 'pubsub',
                    event,
                    data,
                });
            };
            process.on('message', (message) => {
                if (message && typeof message === 'object' && message.action === 'pubsub') {
                    const pubsubMessage = message;
                    singleHost.emit(pubsubMessage.event, pubsubMessage.data);
                }
            });
        }
        pubsub = singleHost;
    }
    else if (nconf_1.default.get('redis')) {
        // Assuming this is a valid import path for your Redis module
        pubsub = ps;
    }
    else {
        throw new Error('[[error:redis-required-for-pubsub]]');
    }
    real = pubsub;
    return pubsub;
}
exports.default = {
    publish: function (event, data) {
        get().publish(event, data);
    },
    on: function (event, callback) {
        get().on(event, callback);
    },
    removeAllListeners: function (event) {
        get().removeAllListeners(event);
    },
    reset: function () {
        real = null;
    },
};
