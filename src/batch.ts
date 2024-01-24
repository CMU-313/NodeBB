import util from 'util';

import db from './database';
import utils from './utils';

import promisify from './promisify';

const DEFAULT_BATCH_SIZE = 100;

const sleep: (ms: number) => Promise<void> = util.promisify(setTimeout);

interface Options {
    progress?: {total: number}; // to do
    batch?: number;
    doneIf?: ((start: number, stop: number, ids: number[]) => void) | (() => void);
    alwaysStartAt?: number;
    withScores?: boolean;
    interval?: number;
}

export async function processSortedSet(setKey: string,
    process: ((stuff: number[]) => (void)) | ((stuff: number[]) => Promise<void>),
    options: Options): Promise<void> {
    options = options || {};

    if (typeof process !== 'function') {
        throw new Error('[[error:process-not-a-function]]');
    }

    // Progress bar handling (upgrade scripts)
    if (options.progress) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        options.progress.total = await db.sortedSetCard(setKey) as number;
    }

    options.batch = options.batch || DEFAULT_BATCH_SIZE;

    // use the fast path if possible
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    if (db.processSortedSet && typeof options.doneIf !== 'function' && !utils.isNumber(options.alwaysStartAt)) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await db.processSortedSet(setKey, process, options) as Promise<void>;
    }

    // custom done condition (currently not used anywhere)
    options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () { return undefined; };

    let start = 0;
    let stop: number = options.batch - 1;

    if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
        // Prof. Eduardo told me to leave this here to suppress the error
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        process = util.promisify(process);
    }

    while (true) {
        /* eslint-disable no-await-in-loop */
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const ids: number[] = await db[`getSortedSetRange${options.withScores ? 'WithScores' : ''}`](setKey, start, stop) as number[];
        if (!ids.length || options.doneIf(start, stop, ids)) {
            return;
        }
        await process(ids);

        start += utils.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch;
        stop = start + options.batch - 1;

        if (options.interval) {
            await sleep(options.interval);
        }
    }
}

export async function processArray(array: number[],
    process: (stuff: number[]) => void,
    options: Options): Promise<void> {
    options = options || {};

    if (!Array.isArray(array) || !array.length) {
        return;
    }
    if (typeof process !== 'function') {
        throw new Error('[[error:process-not-a-function]]');
    }

    const batch: number = options.batch || DEFAULT_BATCH_SIZE;
    let start = 0;
    if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
        // Prof. Eduardo told me to leave this here to suppress the error
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        process = util.promisify(process);
    }

    while (true) {
        const currentBatch: number[] = array.slice(start, start + batch);

        if (!currentBatch.length) {
            return;
        }

        process(currentBatch);

        start += batch;

        if (options.interval) {
            await sleep(options.interval);
        }
    }
}

promisify(exports);
