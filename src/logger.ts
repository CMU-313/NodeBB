// 'use strict';

import express from 'express';

/*
 * Logger module: ability to dynamically turn on/off logging for http requests & socket.io events
 */

import fs = require('fs');
import path = require('path');
import winston = require('winston');
import util = require('util');
import morgan = require('morgan');

import file from './file';
import meta from './meta';


const opts = {
    /*
     * state used by Logger
     */
    express: {
        app: express(),
        set: 0 as number,
        ofn: null,
    },
    streams: {
        log: { f: process.stdout },
    },
};

type Stream = NodeJS.WriteStream & {fd : 1} | fs.WriteStream;
type Log = { f : Stream };
type Socket = {
    io: { sockets: {sockets: Socket[][]}},
    emit: (arg0: unknown, arg1: unknown[]) => void,
    oEmit: (arg0: unknown, arg1: unknown[]) => void,
    onevent: (arg0: unknown, arg1: unknown[]) => void,
    $onevent: (arg0: unknown, arg1: unknown[]) => void,
    $onvent: unknown,
    uid: string
};


/* -- Logger -- */
export function expressLogger(req : express.Request, res : express.Response, next: () => unknown) {
    /*
        * The new express.logger
        *
        * This hijack allows us to turn logger on/off dynamically within express
        */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (meta.config.loggerStatus > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return opts.express.ofn(req, res, next) as unknown;
    }
    return next();
}

export function express_open() {
    if (opts.express.set !== 1) {
        opts.express.set = 1;
        opts.express.app.use(expressLogger);
    }
    /*
        * Always initialize "ofn" (original function) with the original logger function
        */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    opts.express.ofn = morgan('combined', { stream: opts.streams.log.f }) as unknown;
}

export function open(value: string) {
    /* Open the streams to log to: either a path or stdout */
    let stream : Stream;
    if (value) {
        if (file.existsSync(value)) {
            const stats = fs.statSync(value);
            if (stats) {
                if (stats.isDirectory()) {
                    stream = fs.createWriteStream(path.join(value, 'nodebb.log'), { flags: 'a' });
                } else {
                    stream = fs.createWriteStream(value, { flags: 'a' });
                }
            }
        } else {
            stream = fs.createWriteStream(value, { flags: 'a' });
        }
        if (stream) {
            stream.on('error', (err) => {
                winston.error(err.stack);
            });
        }
    } else {
        stream = process.stdout;
    }
    return stream;
}

export function close(stream : Log) {
    if (stream.f !== process.stdout && stream.f) {
        let stream : fs.WriteStream;
        stream.end();
    }
    stream.f = null;
}

export function setup_one_log(value : string) : void {
    /*
        * If logging is currently enabled, create a stream.
        * Otherwise, close the current stream
        */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (meta.config.loggerStatus > 0 || meta.config.loggerIOStatus) {
        const stream : Stream = open(value);
        if (stream) {
            opts.streams.log.f = stream as NodeJS.WriteStream & {fd : 1};
        } else {
            opts.streams.log.f = process.stdout;
        }
    } else {
        close(opts.streams.log);
    }
}

export function setup_one(key : string, value: unknown) {
    /*
        * 1. Open the logger stream: stdout or file
        * 2. Re-initialize the express logger hijack
        */
    if (key === 'loggerPath') {
        setup_one_log(value as string);
        express_open();
    }
}

export function setup() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    setup_one('loggerPath', meta.config.loggerPath);
}

export function init(app : express.Express): void {
    opts.express.app = app;
    /* Open log file stream & initialize express logging if meta.config.logger* variables are set */
    setup();
}

export function prepare_io_string(_type : string, _uid : string, _args : unknown[]) {
    /*
        * This prepares the output string for intercepted socket.io events
        *
        * The format is: io: <uid> <event> <args>
        */
    try {
        return `io: ${_uid} ${_type} ${util.inspect(Array.prototype.slice.call(_args), { depth: 3 })}\n`;
    } catch (err) {
        winston.info('Logger.prepare_io_string: Failed', err);
        return 'error';
    }
}

export function io_one(socket: Socket, uid : string) : void {
    /*
        * This function replaces a socket's .emit/.on functions in order to intercept events
        */
    function override(method: { apply: (arg0: unknown, arg1: unknown[]) => void; }, name:string, errorMsg:string) {
        return (...args: unknown[]) => {
            if (opts.streams.log.f) {
                opts.streams.log.f.write(prepare_io_string(name, uid, args));
            }
            try {
                method.apply(socket, args);
            } catch (err) {
                winston.info(errorMsg, err);
            }
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (socket && meta.config.loggerIOStatus > 0) {
        // courtesy of: http://stackoverflow.com/a/9674248
        socket.oEmit = socket.emit;
        const { emit } = socket;
        socket.emit = override(emit, 'emit', 'Logger.io_one: emit.apply: Failed');
        socket.$onvent = socket.onevent;
        const $onevent = socket.onevent;
        socket.onevent = override($onevent, 'on', 'Logger.io_one: $emit.apply: Failed');
    }
}

export function io_close(socket : Socket) {
    /*
        * Restore all hijacked sockets to their original emit/on functions
        */
    if (!socket || !socket.io || !socket.io.sockets || !socket.io.sockets.sockets) {
        return;
    }
    const clientsMap = socket.io.sockets.sockets;
    for (const [, client] of clientsMap) {
        if (client.oEmit && client.oEmit !== client.emit) {
            client.emit = client.oEmit;
        }
        if (client.$onevent && client.$onevent !== client.onevent) {
            client.onevent = client.$onevent;
        }
    }
}

export function io(socket: Socket) : void {
    /*
        * Go through all of the currently established sockets & hook their .emit/.on
        */
    if (!socket || !socket.io || !socket.io.sockets || !socket.io.sockets.sockets) {
        return;
    }
    const clientsMap = socket.io.sockets.sockets;
    for (const [, socketObj] of clientsMap) {
        io_one(socketObj, socketObj.uid);
    }
}

export function monitorConfig(socket : Socket, data: { key: string; value: unknown; }) {
    /*
        * This monitor's when a user clicks "save" in the Logger section of the admin panel
        */
    setup_one(data.key, data.value);
    io_close(socket);
    io(socket);
}
