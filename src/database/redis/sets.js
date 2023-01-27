"use strict";
// import { execBatch, resultsToBool } from './helpers';
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
exports.setRemoveRandom = exports.setsCount = exports.setCount = exports.getSetsMembers = exports.getSetMembers = exports.isMemberOfSets = exports.isSetMembers = exports.isSetMember = exports.setsRemove = exports.setRemove = exports.setsAdd = exports.setAdd = void 0;
const helpers_1 = __importDefault(require("./helpers"));
let client;
function setAdd(key, value) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(value)) {
            value = [value];
        }
        if (!value.length) {
            return;
        }
        yield client.sadd(key, value);
    });
}
exports.setAdd = setAdd;
helpers_1.default.execBatch = function (batch) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = yield batch.exec();
        return results.map(([err, res]) => {
            if (err) {
                throw err;
            }
            return res;
        });
    });
};
function setsAdd(keys, value) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!Array.isArray(keys) || !keys.length) {
            return;
        }
        // const batch = client.batch();
        const batch = client.batch();
        keys.forEach(k => batch.sadd(String(k), String(value)));
        yield helpers_1.default.execBatch(batch);
    });
}
exports.setsAdd = setsAdd;
function setRemove(key, value) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const batch = client.batch();
        key.forEach(k => batch.srem(String(k), value));
        yield helpers_1.default.execBatch(batch);
    });
}
exports.setRemove = setRemove;
function setsRemove(keys, value) {
    return __awaiter(this, void 0, void 0, function* () {
        // const batch = client.batch();
        const batch = client.batch();
        keys.forEach(k => batch.srem(String(k), value));
        yield helpers_1.default.execBatch(batch);
    });
}
exports.setsRemove = setsRemove;
function isSetMember(key, value) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield client.sismember(key, value);
        return result === 1;
    });
}
exports.isSetMember = isSetMember;
function isSetMembers(key, values) {
    return __awaiter(this, void 0, void 0, function* () {
        // const batch = client.batch();
        const batch = client.batch();
        values.forEach(v => batch.sismember(String(key), String(v)));
        const results = yield helpers_1.default.execBatch(batch);
        return results ? helpers_1.default.resultsToBool(results) : null;
    });
}
exports.isSetMembers = isSetMembers;
function isMemberOfSets(sets, value) {
    return __awaiter(this, void 0, void 0, function* () {
        // const batch = client.batch();
        const batch = client.batch();
        sets.forEach(s => batch.sismember(String(s), String(value)));
        const results = yield helpers_1.default.execBatch(batch);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return results ? helpers_1.default.resultsToBool(results) : null;
    });
}
exports.isMemberOfSets = isMemberOfSets;
function getSetMembers(key) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield client.smembers(key);
    });
}
exports.getSetMembers = getSetMembers;
function getSetsMembers(keys) {
    return __awaiter(this, void 0, void 0, function* () {
        // const batch = client.batch();
        const batch = client.batch();
        keys.forEach(k => batch.smembers(String(k)));
        return yield helpers_1.default.execBatch(batch);
    });
}
exports.getSetsMembers = getSetsMembers;
function setCount(key) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield client.scard(key);
    });
}
exports.setCount = setCount;
function setsCount(keys) {
    return __awaiter(this, void 0, void 0, function* () {
        // const batch = client.batch();
        const batch = client.batch();
        keys.forEach(k => batch.scard(String(k)));
        return yield helpers_1.default.execBatch(batch);
    });
}
exports.setsCount = setsCount;
function setRemoveRandom(key) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield client.spop(key);
    });
}
exports.setRemoveRandom = setRemoveRandom;
