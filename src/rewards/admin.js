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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveRewards = exports.saveConditions = void 0;
// Note: ChatGPT is used for debugging and generating code snippets for this file
const plugins = require("../plugins");
const db = require("../database");
const utils = require("../utils");
const rewards = module.exports;
function saveConditions(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const rewardsPerCondition = {};
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.delete('conditions:active');
        const conditions = [];
        data.forEach((reward) => {
            conditions.push(reward.condition);
            rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
            rewardsPerCondition[reward.condition].push(reward.id);
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield db.setAdd('conditions:active', conditions);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield Promise.all(Object.keys(rewardsPerCondition).map(c => db.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c])));
    });
}
exports.saveConditions = saveConditions;
rewards.save = function (data) {
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
                    data.id = (yield db.incrObjectField('global', 'rewards:id'));
                }
                yield rewards.delete(data);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield db.setAdd('rewards:list', data.id);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield db.setObject(`rewards:id:${data.id}`, data);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield db.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
            });
        }
        yield Promise.all(data.map(data => save(data)));
        yield saveConditions(data);
        return data;
    });
};
rewards.delete = function (data) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setRemove('rewards:list', data.id),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.delete(`rewards:id:${data.id}`),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.delete(`rewards:id:${data.id}:rewards`),
        ]);
    });
};
function getActiveRewards() {
    return __awaiter(this, void 0, void 0, function* () {
        function load(id) {
            return __awaiter(this, void 0, void 0, function* () {
                const [main, rewards] = yield Promise.all([
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    db.getObject(`rewards:id:${id}`),
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    db.getObject(`rewards:id:${id}:rewards`),
                ]);
                if (main) {
                    main.disabled = main.disabled === 'true';
                    main.rewards = rewards;
                }
                return main;
            });
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const rewardsList = yield db.getSetMembers('rewards:list');
        const rewardData = yield Promise.all(rewardsList.map(id => load(id)));
        return rewardData.filter(Boolean);
    });
}
exports.getActiveRewards = getActiveRewards;
rewards.get = function () {
    return __awaiter(this, void 0, void 0, function* () {
        return yield utils.promiseParallel({
            active: getActiveRewards(),
            conditions: plugins.hooks.fire('filter:rewards.conditions', []),
            conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
            rewards: plugins.hooks.fire('filter:rewards.rewards', []),
        });
    });
};
// require('../promisify')(rewards);
