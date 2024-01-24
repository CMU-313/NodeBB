"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processArray = exports.processSortedSet = void 0;
const util_1 = __importDefault(require("util"));
const database_1 = __importDefault(require("./database"));
const utils_1 = __importDefault(require("./utils"));
const promisify_1 = __importDefault(require("./promisify"));
const DEFAULT_BATCH_SIZE = 100;
const sleep = util_1.default.promisify(setTimeout);
function processSortedSet(setKey, process, options) {
    return __awaiter(this, void 0, void 0, function* () {
        options = options || {};
        if (typeof process !== 'function') {
            throw new Error('[[error:process-not-a-function]]');
        }
        // Progress bar handling (upgrade scripts)
        if (options.progress) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            options.progress.total = (yield database_1.default.sortedSetCard(setKey));
        }
        options.batch = options.batch || DEFAULT_BATCH_SIZE;
        // use the fast path if possible
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        if (database_1.default.processSortedSet && typeof options.doneIf !== 'function' && !utils_1.default.isNumber(options.alwaysStartAt)) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield database_1.default.processSortedSet(setKey, process, options);
        }
        // custom done condition (currently not used anywhere)
        options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () { return undefined; };
        let start = 0;
        let stop = options.batch - 1;
        if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
            // Prof. Eduardo told me to leave this here to suppress the error
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            process = util_1.default.promisify(process);
        }
        while (true) {
            /* eslint-disable no-await-in-loop */
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const ids = yield database_1.default[`getSortedSetRange${options.withScores ? 'WithScores' : ''}`](setKey, start, stop);
            if (!ids.length || options.doneIf(start, stop, ids)) {
                return;
            }
            yield process(ids);
            start += utils_1.default.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch;
            stop = start + options.batch - 1;
            if (options.interval) {
                yield sleep(options.interval);
            }
        }
    });
}
exports.processSortedSet = processSortedSet;
function processArray(array, process, options) {
    return __awaiter(this, void 0, void 0, function* () {
        options = options || {};
        if (!Array.isArray(array) || !array.length) {
            return;
        }
        if (typeof process !== 'function') {
            throw new Error('[[error:process-not-a-function]]');
        }
        const batch = options.batch || DEFAULT_BATCH_SIZE;
        let start = 0;
        if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
            // Prof. Eduardo told me to leave this here to suppress the error
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            process = util_1.default.promisify(process);
        }
        while (true) {
            const currentBatch = array.slice(start, start + batch);
            if (!currentBatch.length) {
                return;
            }
            process(currentBatch);
            start += batch;
            if (options.interval) {
                yield sleep(options.interval);
            }
        }
    });
}
exports.processArray = processArray;
(0, promisify_1.default)(exports);
