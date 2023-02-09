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
exports.get = exports.save = exports.delete = void 0;
const plugins_1 = __importDefault(require("../plugins"));
const database_1 = __importDefault(require("../database"));
const utils_1 = __importDefault(require("../utils"));
function saveConditions(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const rewardsPerCondition = {};
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield database_1.default.delete('conditions:active');
        const conditions = [];
        data.forEach((reward) => {
            conditions.push(reward.condition);
            rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
            rewardsPerCondition[reward.condition].push(reward.id);
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield database_1.default.setAdd('conditions:active', conditions);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield Promise.all(Object.keys(rewardsPerCondition).map(c => database_1.default.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c])));
    });
}
function _delete(data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            database_1.default.setRemove('rewards:list', data.id),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            database_1.default.delete(`rewards:id:${data.id}`),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            database_1.default.delete(`rewards:id:${data.id}:rewards`),
        ]);
    });
}
exports.delete = _delete;
function save(data) {
    return __awaiter(this, void 0, void 0, function* () {
        function save(data) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!Object.keys(data.rewards).length) {
                    return;
                }
                const rewardsData = data.rewards;
                delete data.rewards;
                if (!parseInt(data.id, 10)) {
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    data.id = (yield database_1.default.incrObjectField('global', 'rewards:id'));
                }
                yield _delete(data);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.setAdd('rewards:list', data.id);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.setObject(`rewards:id:${data.id}`, data);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
            });
        }
        yield Promise.all(data.map(data => save(data)));
        yield saveConditions(data);
        return data;
    });
}
exports.save = save;
function getActiveRewards() {
    return __awaiter(this, void 0, void 0, function* () {
        function load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                const [main, rewards] = yield Promise.all([
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    database_1.default.getObject(`rewards:id:${id}`),
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    database_1.default.getObject(`rewards:id:${id}:rewards`),
                ]);
                if (main) {
                    main.disabled = String(main.disabled === 'true');
                    main.rewards = rewards;
                }
                return main;
            });
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const rewardsList = yield database_1.default.getSetMembers('rewards:list');
        const rewardData = yield Promise.all(rewardsList.map(id => load(id)));
        return rewardData.filter(Boolean);
    });
}
function get() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils_1.default.promiseParallel({
            active: getActiveRewards(),
            conditions: plugins_1.default.hooks.fire('filter:rewards.conditions', []),
            conditionals: plugins_1.default.hooks.fire('filter:rewards.conditionals', []),
            rewards: plugins_1.default.hooks.fire('filter:rewards.rewards', []),
        });
    });
}
exports.get = get;
