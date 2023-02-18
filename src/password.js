"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.compare = exports.hash = void 0;
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const util = __importStar(require("util"));
const bcrypt = __importStar(require("bcryptjs"));
const debugFork_1 = __importDefault(require("./meta/debugFork"));
function forkChild(message, callback) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const child = (0, debugFork_1.default)(path.join(__dirname, 'password'));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    child.on('message', (msg) => {
        callback(msg.err ? new Error(msg.err) : null, msg.result);
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    child.on('error', (err) => {
        console.error(err.stack);
        callback(err);
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    child.send(message);
}
const forkChildAsync = util.promisify(forkChild);
function hash(rounds, password) {
    return __awaiter(this, void 0, void 0, function* () {
        password = crypto.createHash('sha512').update(password).digest('hex');
        return yield forkChildAsync({ type: 'hash', rounds: rounds, password: password });
    });
}
exports.hash = hash;
let fakeHashCache;
function getFakeHash() {
    return __awaiter(this, void 0, void 0, function* () {
        if (fakeHashCache) {
            return fakeHashCache;
        }
        fakeHashCache = yield hash('12', Math.random().toString());
        return fakeHashCache;
    });
}
function compare(password, hash, shaWrapped) {
    return __awaiter(this, void 0, void 0, function* () {
        const fakeHash = yield getFakeHash();
        if (shaWrapped) {
            password = crypto.createHash('sha512').update(password).digest('hex');
        }
        return yield forkChildAsync({ type: 'compare', password: password, hash: hash || fakeHash });
    });
}
exports.compare = compare;
function hashPassword(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const salt = yield bcrypt.genSalt(parseInt(msg.rounds, 10));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const hash = yield bcrypt.hash(msg.password, salt);
        return hash;
    });
}
function tryMethod(method, msg) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield method(msg);
            process.send({ result: result });
        }
        catch (err) {
            if (err instanceof Error) {
                process.send({ err: err.message });
            }
        }
        finally {
            process.disconnect();
        }
    });
}
function compareHelper(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return yield bcrypt.compare(String(msg.password || ''), String(msg.hash || ''));
    });
}
// child process
process.on('message', (msg) => {
    if (msg.type === 'hash') {
        tryMethod(hashPassword, msg)
            .then()
            .catch(err => console.log(err));
    }
    else if (msg.type === 'compare') {
        tryMethod(compareHelper, msg).catch()
            .then()
            .catch(err => console.log(err));
    }
});
