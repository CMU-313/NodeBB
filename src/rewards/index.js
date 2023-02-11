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
exports.checkConditionAndRewardUser = exports.giveRewards = exports.checkCondition = exports.getRewardsByRewardData = exports.getRewardDataByIDs = exports.filterCompletedRewards = exports.getIDsByCondition = exports.isConditionActive = void 0;
const util_1 = __importDefault(require("util"));
const database_1 = __importDefault(require("../database"));
const plugins_1 = __importDefault(require("../plugins"));
// import promisify from '../promisify';
// const rewards = promisify(rewards);
function isConditionActive(condition) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const setMember = yield database_1.default.isSetMember('conditions:active', condition);
        return setMember;
    });
}
exports.isConditionActive = isConditionActive;
function getIDsByCondition(condition) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const getSetMember = yield database_1.default.isSetMember('conditions:active', condition);
        return getSetMember;
    });
}
exports.getIDsByCondition = getIDsByCondition;
function filterCompletedRewards(uid, rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const data = yield database_1.default.getSortedSetRangeByScoreWithScores(`uid:${uid}:rewards`, 0, -1, 1, '+inf');
        const userRewards = {};
        data.forEach((obj) => {
            userRewards[obj.value] = parseInt(obj.score, 10);
        });
        return rewards.filter((reward) => {
            if (!reward) {
                return false;
            }
            const claimable = parseInt(reward.claimable, 10);
            return claimable === 0 || (!userRewards[reward.id] || userRewards[reward.id] < reward.claimable);
        });
    });
}
exports.filterCompletedRewards = filterCompletedRewards;
function getRewardDataByIDs(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const objects = yield database_1.default.getObjects(ids.map(id => `rewards:id:${id}`));
        return objects;
    });
}
exports.getRewardDataByIDs = getRewardDataByIDs;
function getRewardsByRewardData(rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const objects = yield database_1.default.getObjects(rewards.map(reward => `rewards:id:${reward.id}:rewards`));
        return objects;
    });
}
exports.getRewardsByRewardData = getRewardsByRewardData;
function checkCondition(reward, method) {
    return __awaiter(this, void 0, void 0, function* () {
        if (method.constructor && method.constructor.name !== 'AsyncFunction') {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const value = util_1.default.promisify(method);
            const bool = yield plugins_1.default.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, { left: value, right: reward.value });
            return bool;
        }
        const value = yield method();
        const bool = yield plugins_1.default.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, { left: value, right: reward.value });
        return bool;
    });
}
exports.checkCondition = checkCondition;
function giveRewards(uid, rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        const rewardData = yield getRewardsByRewardData(rewards);
        for (let i = 0; i < rewards.length; i++) {
            /* eslint-disable no-await-in-loop */
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield plugins_1.default.hooks.fire(`action:rewards.award:${rewards[i].rid}`, { uid: uid, reward: rewardData[i] });
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetIncrBy(`uid:${uid}:rewards`, 1, rewards[i].id);
        }
    });
}
exports.giveRewards = giveRewards;
function checkConditionAndRewardUser(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { uid, condition, method } = params;
        const isActive = yield isConditionActive(condition);
        if (!isActive) {
            return;
        }
        const ids = yield getIDsByCondition(condition);
        let rewardData = yield getRewardDataByIDs(ids);
        rewardData = yield filterCompletedRewards(uid, rewardData);
        rewardData = rewardData.filter(Boolean);
        if (!rewardData || !rewardData.length) {
            return;
        }
        const eligible = yield Promise.all(rewardData.map(reward => checkCondition(reward, method)));
        const eligibleRewards = rewardData.filter((reward, index) => eligible[index]);
        yield giveRewards(uid, eligibleRewards);
    });
}
exports.checkConditionAndRewardUser = checkConditionAndRewardUser;
