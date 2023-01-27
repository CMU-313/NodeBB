import { createClient } from 'redis';
import helpers from './helpers';

let client: ReturnType<typeof createClient>;

// interface Helpers {
//     resultsToBool(results: any[]): boolean;
//     execBatch(batch: any): Promise<any>;
//     // any other functions in the helpers module
// }
// declare function helpers.resultsToBool(results: any[]): boolean;

interface batchType{
    sadd: (key:string, value: string) => void;
    srem: (key:string, value:Array<string> | Array<number>) => void;
    sismember: (key:string, value: string) => void;
    smembers: (key:string) => void;
    scard: (key:string) => void;
    exec: () => Promise<Array<[Error | null, number, string]>>
}

export async function setAdd(key: string, value: Array<string> | Array<number>) {
    if (!Array.isArray(value)) {
        value = [value];
    }
    if (!value.length) {
        return;
    }
    await client.sadd(key, value) as Promise<void>;
}


helpers.execBatch = async function (batch: batchType) {
    const results = await batch.exec();
    return results.map(([err, res]) => {
        if (err) {
            throw err;
        }
        return res;
    });
};

export async function setsAdd(keys: Array<string>, value: number | string) {
    if (!Array.isArray(keys) || !keys.length) {
        return;
    }
    // const batch = client.batch();
    const batch: batchType = client.batch() as batchType;
    keys.forEach(k => batch.sadd(String(k), String(value)));
        await helpers.execBatch(batch) as Promise<void>;
}

export async function setRemove(key: Array<string>, value: Array<string> | Array<number>) {
    if (!Array.isArray(value)) {
        value = [value];
    }
    if (!Array.isArray(key)) {
        key = [key];
    }
    if (!value.length) {
        return;
    }

    // const batch = client.batch();
    const batch: batchType = client.batch() as batchType;
    key.forEach(k => batch.srem(String(k), value));
        await helpers.execBatch(batch) as Promise<void>;
}

export async function setsRemove(keys: Array<string>, value: Array<string> | Array<number>) {
    // const batch = client.batch();
    const batch: batchType = client.batch() as batchType;
    keys.forEach(k => batch.srem(String(k), value));
        await helpers.execBatch(batch) as Promise<void>;
}

export async function isSetMember(key: string, value: number) {
    const result = await client.sismember(key, value);
    return result === 1;
}

export async function isSetMembers(key: string, values: string[] | number[]) {
    // const batch = client.batch();
    const batch: batchType = client.batch() as batchType;
    values.forEach(v => batch.sismember(String(key), String(v)));
    const results: Array<boolean> = await helpers.execBatch(batch);
    return results ? helpers.resultsToBool(results) : null;
}

export async function isMemberOfSets(sets: Array<string>, value: string | number) {
    // const batch = client.batch();
    const batch: batchType = client.batch() as batchType;
    sets.forEach(s => batch.sismember(String(s), String(value)));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const results: Array<boolean> = await helpers.execBatch(batch);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const returnVar = results ? helpers.resultsToBool(results) : null;
    return returnVar;
}

export async function getSetMembers(key: string) {
    return await client.smembers(key) as Promise<void>;
}

export async function getSetsMembers(keys: string[]) {
    // const batch = client.batch();
    const batch: batchType = client.batch() as batchType;
    keys.forEach(k => batch.smembers(String(k)));
    return await helpers.execBatch(batch) as Promise<void>;
}

export async function setCount(key: string) {
    return await client.scard(key) as Promise<void>;
}

export async function setsCount(keys: string[]) {
    // const batch = client.batch();
    const batch: batchType = client.batch() as batchType;
    keys.forEach(k => batch.scard(String(k)));
    return await helpers.execBatch(batch) as Promise<void>;
}

export async function setRemoveRandom(key: string) {
    return await client.spop(key) as Promise<void>;
}
