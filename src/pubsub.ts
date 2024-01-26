import { EventEmitter } from 'events';
import nconf from 'nconf';
import ps = require('./database/redis/pubsub');

interface CustomEventEmitter extends EventEmitter {
    publish(event: string, data: object): void;
}
type PublishFunction = (arg: string) => void;
let real: CustomEventEmitter | null;
let noCluster: CustomEventEmitter | undefined;
let singleHost: CustomEventEmitter | undefined;



type messageData = {
    action: string;
};

function get(): CustomEventEmitter {
    if (real) {
        return real;
    }


    let pubsub: CustomEventEmitter;

    if (!nconf.get('isCluster')) {
        if (noCluster) {
            real = noCluster;
            return real;
        }
        noCluster = new EventEmitter() as CustomEventEmitter;
        noCluster.publish = (noCluster.emit.bind(noCluster) as unknown) as PublishFunction;
        pubsub = noCluster;
    } else if (nconf.get('singleHostCluster')) {
        if (singleHost) {
            real = singleHost;
            return real;
        }
        singleHost = new EventEmitter() as CustomEventEmitter;
        if (!process.send) {
            noCluster.publish = (noCluster.emit.bind(noCluster) as unknown) as PublishFunction;
        } else {
            singleHost.publish = function (event: string, data: object) {
                process.send({
                    action: 'pubsub',
                    event,
                    data,
                });
            };
            process.on('message', (message: messageData) => {
                if (message && typeof message === 'object' && message.action === 'pubsub') {
                    const pubsubMessage = message as { action: string, event: string, data: string };
                    singleHost.emit(pubsubMessage.event, pubsubMessage.data);
                }
            });
        }
        pubsub = singleHost;
    } else if (nconf.get('redis')) {
        // Assuming this is a valid import path for your Redis module
        pubsub = ps as CustomEventEmitter;
    } else {
        throw new Error('[[error:redis-required-for-pubsub]]');
    }

    real = pubsub;
    return pubsub;
}

export default {
    publish: function (event: string, data: object) {
        get().publish(event, data);
    },
    on: function (event: string, callback: (...args: string[]) => void) {
        get().on(event, callback);
    },
    removeAllListeners: function (event: string) {
        get().removeAllListeners(event);
    },
    reset: function () {
        real = null;
    },
};
