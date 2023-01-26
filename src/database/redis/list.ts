import helpers from './helpers';

export = function (module: { client: { lpush: (arg0: string, arg1:
    number) => any; rpush: (arg0: string, arg1: number) => any; rpop:
    (arg0: string)=> void | PromiseLike<void>; batch: () => any; lrem:
    (arg0: string, arg1: number, arg2: number) => any; ltrim: (arg0: string,
    arg1: number, arg2: number) => any; lrange: (arg0: string, arg1: number,
    arg2: number) => any; llen: (arg0: string) => any; }; }) {
    async function listPrepend(key: string, value: number):Promise<void> {
        if (!key) {
            return;
        }
        await module.client.lpush(key, value) as Promise<void>;
    }

    async function listAppend(key:string, value:number):Promise<void> {
        if (!key) {
            return;
        }
        await module.client.rpush(key, value)as Promise<void>;
    }

    async function listRemoveLast(key:string): Promise<void> {
        if (!key) {
            return;
        }
        await module.client.rpop(key) as void | Promise<void>;
    }

    interface batchType {
        lrem: (key: string, num: number, value: any) => void
    }



    async function listRemoveAll(key:string, value:number):Promise<void> {
        if (!key) {
            return;
        }
        if (Array.isArray(value)) {
            const batch: batchType = module.client.batch() as batchType;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            value.forEach(value => batch.lrem(key, 0, value));
            await helpers.execBatch(batch) as Promise<void>;
        } else {
            await module.client.lrem(key, 0, value) as Promise<void>;
        }
    }

    async function listTrim(key:string, start:number, stop:number): Promise<void> {
        if (!key) {
            return;
        }
        await module.client.ltrim(key, start, stop)as Promise<number>;
    }

    async function getListRange(key:string, start:number, stop:number):Promise<number[]> {
        if (!key) {
            return;
        }
        return await module.client.lrange(key, start, stop)as Promise<number[]>;
    }

    async function listLength(key:string):Promise<number> {
        return await module.client.llen(key)as Promise<number>;
    }
}
