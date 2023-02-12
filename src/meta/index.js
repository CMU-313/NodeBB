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
exports.getSessionTTLSeconds = exports.restart = exports.userOrGroupExists = void 0;
const winston_1 = __importDefault(require("winston"));
const os_1 = __importDefault(require("os"));
const nconf_1 = __importDefault(require("nconf"));
const pubsub_1 = __importDefault(require("../pubsub"));
const slugify_1 = __importDefault(require("../slugify"));
const configs_1 = __importDefault(require("./configs"));
const user_1 = __importDefault(require("../user"));
const groups_1 = __importDefault(require("../groups"));
/* Assorted */
function restart_helper() {
    if (process.send) {
        process.send({
            action: 'restart',
        });
    }
    else {
        winston_1.default.error('[meta.restart] Could not restart, are you sure NodeBB was started with `./nodebb start`?');
    }
}
function userOrGroupExists(slug) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!slug) {
            throw new Error('[[error:invalid-data]]');
        }
        const slugified = (0, slugify_1.default)(slug);
        const [userExists, groupExists] = yield Promise.all([
            user_1.default.existsBySlug(slugified),
            groups_1.default.existsBySlug(slugified),
        ]);
        return userExists || groupExists;
    });
}
exports.userOrGroupExists = userOrGroupExists;
if (nconf_1.default.get('isPrimary')) {
    pubsub_1.default.on('meta:restart', (data) => {
        if (data.hostname !== os_1.default.hostname()) {
            restart_helper();
        }
    });
}
function restart() {
    pubsub_1.default.publish('meta:restart', { hostname: os_1.default.hostname() });
    restart_helper();
}
exports.restart = restart;
function getSessionTTLSeconds() {
    const ttlDays = 60 * 60 * 24 * configs_1.default.loginDays;
    const ttlSeconds = configs_1.default.loginSeconds;
    const ttl = ttlSeconds || ttlDays || 1209600; // Default to 14 days
    return ttl;
}
exports.getSessionTTLSeconds = getSessionTTLSeconds;
