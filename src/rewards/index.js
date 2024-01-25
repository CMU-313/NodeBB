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
Object.defineProperty(exports, "__esModule", { value: true });
const db = __importStar(require("../database")); // Ensure db has proper TypeScript types
const plugins = __importStar(require("../plugins")); // Ensure plugins have proper TypeScript types
// Define the functions before they are used in the rewards object
function isConditionActive(condition) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return yield db.isSetMember('conditions:active', condition); // Assuming isSetMember returns a boolean
    });
}
function getIDsByCondition(condition) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return yield db.getSetMembers(`condition:${condition}:rewards`); // Assuming getSetMembers returns an array of strings
    });
}
function getRewardDataByIDs(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return yield db.getObjects(ids.map(id => `rewards:id:${id}`)); // Assuming getObjects returns an array of Rewards
    });
}
function getRewardsByRewardData(rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return yield db.getObjects(rewards.map(reward => `rewards:id:${reward.id}:rewards`)); // Assuming getObjects returns an array of Rewards
    });
}
function filterCompletedRewards(uid, rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const data = yield db.getSortedSetRangeByScoreWithScores(`uid:${uid}:rewards`, 0, -1, 1, '+inf'); // Assuming getSortedSetRangeByScoreWithScores returns a suitable type
        const userRewards = {};
        data.forEach((obj) => {
            userRewards[obj.value] = parseInt(obj.score, 10);
        });
        return rewards.filter((reward) => {
            if (!reward) {
                return false;
            }
            const claimable = parseInt(reward.claimable, 10);
            return claimable === 0 || (!userRewards[reward.id] || userRewards[reward.id] < claimable);
        });
    });
}
function checkCondition(reward, method) {
    return __awaiter(this, void 0, void 0, function* () {
        let value;
        // Check if method returns a Promise and handle accordingly
        if (method.constructor && method.constructor.name === 'AsyncFunction') {
            value = yield method();
        }
        else {
            value = method();
            // If the return value is a Promise, await it
            if (value instanceof Promise) {
                value = yield value;
            }
        }
        return yield plugins.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, { left: value, right: reward.value }); // Assuming fire returns a boolean
    });
}
function giveRewards(uid, rewards) {
    return __awaiter(this, void 0, void 0, function* () {
        const rewardData = yield getRewardsByRewardData(rewards);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield Promise.all(rewards.map((reward, i) => plugins.hooks.fire(`action:rewards.award:${reward.rid}`, { uid, reward: rewardData[i] }).then(() => db.sortedSetIncrBy(`uid:${uid}:rewards`, 1, reward.id))));
    });
}
// Now define the rewards object
const rewards = {
    checkConditionAndRewardUser: function (params) {
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
            const eligibleRewards = rewardData.filter((_, index) => eligible[index]);
            yield giveRewards(uid, eligibleRewards);
        });
    },
};
exports.default = rewards;
