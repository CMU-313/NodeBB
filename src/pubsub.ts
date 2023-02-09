import EventEmitter from 'events';
import nconf from 'nconf';

let real : null|PubSub;
let noCluster : PubSub;
let singleHost : PubSub;

class PubSub extends EventEmitter {
    publish: (event : string | symbol, data : object) => void;
}


interface Message {
    action: string,
    event : string | symbol,
    data: object
}

function get(): PubSub {
    if (real) {
        return real;
    }

    let pubsub : PubSub;

    if (!nconf.get('isCluster')) {
        if (noCluster) {
            real = noCluster;
            return real;
        }
        noCluster = new PubSub();
        noCluster.publish = noCluster.emit.bind(noCluster) as PubSub['publish'];
        pubsub = noCluster;
    } else if (nconf.get('singleHostCluster')) {
        if (singleHost) {
            real = singleHost;
            return real;
        }
        singleHost = new PubSub();
        if (!process.send) {
            singleHost.publish = singleHost.emit.bind(singleHost) as PubSub['publish'];
        } else {
            singleHost.publish = function (event : string | symbol, data : object): void {
                process.send?.({
                    action: 'pubsub',
                    event: event,
                    data: data,
                });
            };
            process.on('message', (message : Message) => {
                if (message && typeof message === 'object' && message.action === 'pubsub') {
                    singleHost.emit(message.event, message.data);
                }
            });
        }
        pubsub = singleHost;
    } else if (nconf.get('redis')) {
        // The next line calls a module that has not been updated to TS yet
        // My code should be able to be extended to the following file though!
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        pubsub = require('./database/redis/pubsub');
    } else {
        throw new Error('[[error:redis-required-for-pubsub]]');
    }

    real = pubsub;
    return pubsub;
}

export function publish(event: string | symbol, data: object) {
    get().publish(event, data);
}

// The on() function in EventEmitter class defines the callback with type (...args: any[]) => void)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function on(event: string | symbol, callback: (...args: any[]) => void) {
    get().on(event, callback);
}

export function removeAllListeners(event: string | symbol) {
    get().removeAllListeners(event);
}

export function reset() {
    real = null;
}
