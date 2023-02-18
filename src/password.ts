import * as path from 'path';
import * as crypto from 'crypto';
import * as util from 'util';
import * as bcrypt from 'bcryptjs';
import fork from './meta/debugFork';

type Message1 = {
    type: string,
    rounds: string,
    password: string
};

type Message2 = {
    type: string,
    hash: string,
    password: string
};

type Message = Message1 | Message2;

function forkChild(message: Message, callback: (...args: Array<Error | null | unknown>) => void) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const child = fork(path.join(__dirname, 'password'));

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    child.on('message', (msg: { err: string; result: unknown; }) => {
        callback(msg.err ? new Error(msg.err) : null, msg.result);
    });

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    child.on('error', (err: { stack: unknown; }) => {
        console.error(err.stack);
        callback(err);
    });

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    child.send(message);
}

const forkChildAsync = util.promisify(forkChild);

export async function hash(rounds: string, password: string): Promise<string> {
    password = crypto.createHash('sha512').update(password).digest('hex');
    return await forkChildAsync({ type: 'hash', rounds: rounds, password: password }) as string;
}

let fakeHashCache: string;
async function getFakeHash(): Promise<string> {
    if (fakeHashCache) {
        return fakeHashCache;
    }
    fakeHashCache = await hash('12', Math.random().toString());
    return fakeHashCache;
}

export async function compare(password: string, hash: string, shaWrapped: boolean): Promise<boolean> {
    const fakeHash: string = await getFakeHash();

    if (shaWrapped) {
        password = crypto.createHash('sha512').update(password).digest('hex');
    }

    return await forkChildAsync({ type: 'compare', password: password, hash: hash || fakeHash }) as boolean;
}

async function hashPassword(msg: Message1): Promise<string> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const salt = await bcrypt.genSalt(parseInt(msg.rounds, 10)) as string;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const hash = await bcrypt.hash(msg.password, salt) as string;
    return hash;
}

async function tryMethod(method: (Message) => Promise<boolean> | Promise<string>, msg: Message): Promise<void> {
    try {
        const result: boolean | string = await method(msg);
        process.send({ result: result });
    } catch (err: unknown) {
        if (err instanceof Error) {
            process.send({ err: err.message });
        }
    } finally {
        process.disconnect();
    }
}

async function compareHelper(msg: Message2): Promise<boolean> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return await bcrypt.compare(String(msg.password || ''), String(msg.hash || '')) as boolean;
}

// child process
process.on('message', (msg: Message2) => {
    if (msg.type === 'hash') {
        tryMethod(hashPassword, msg)
            .then()
            .catch(err => console.log(err));
    } else if (msg.type === 'compare') {
        tryMethod(compareHelper, msg).catch()
            .then()
            .catch(err => console.log(err));
    }
});



