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
const helpers_1 = __importDefault(require("./helpers"));
module.exports = function (module) {
    function listPrepend(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.client.lpush(key, value);
        });
    }
    function listAppend(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.client.rpush(key, value);
        });
    }
    function listRemoveLast(key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.client.rpop(key);
        });
    }
    function listRemoveAll(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            if (Array.isArray(value)) {
                const batch = module.client.batch();
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                value.forEach(value => batch.lrem(key, 0, value));
                yield helpers_1.default.execBatch(batch);
            }
            else {
                yield module.client.lrem(key, 0, value);
            }
        });
    }
    function listTrim(key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.client.ltrim(key, start, stop);
        });
    }
    function getListRange(key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            return yield module.client.lrange(key, start, stop);
        });
    }
    function listLength(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.llen(key);
        });
    }
};
