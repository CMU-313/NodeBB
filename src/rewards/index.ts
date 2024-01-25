import * as db from '../database'; // Ensure db has proper TypeScript types
import * as plugins from '../plugins'; // Ensure plugins have proper TypeScript types

interface Reward {
    id: string;
    claimable: string;
    conditional: string;
    rid: string;
    value: unknown;
}

interface RewardData {
    [key: string]: number;
}

interface RawRewardData {
    [key: string]: string;
}

interface Params {
    uid: number;
    condition: string;
    method: () => Promise<unknown>;
}

// Define the functions before they are used in the rewards object
async function isConditionActive(condition: string): Promise<boolean> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return await db.isSetMember('conditions:active', condition) as boolean; // Assuming isSetMember returns a boolean
}

async function getIDsByCondition(condition: string): Promise<string[]> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return await db.getSetMembers(`condition:${condition}:rewards`) as string[]; // Assuming getSetMembers returns an array of strings
}

async function getRewardDataByIDs(ids: string[]): Promise<Reward[]> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return await db.getObjects(ids.map(id => `rewards:id:${id}`)) as Reward[]; // Assuming getObjects returns an array of Rewards
}

async function getRewardsByRewardData(rewards: Reward[]): Promise<Reward[]> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return await db.getObjects(rewards.map(reward => `rewards:id:${reward.id}:rewards`)) as Reward[]; // Assuming getObjects returns an array of Rewards
}

async function filterCompletedRewards(uid: number, rewards: Reward[]): Promise<Reward[]> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const data : RawRewardData[] = await db.getSortedSetRangeByScoreWithScores(`uid:${uid}:rewards`, 0, -1, 1, '+inf') as RawRewardData[]; // Assuming getSortedSetRangeByScoreWithScores returns a suitable type
    const userRewards: RewardData = {};

    data.forEach((obj: { value: string; score: string }) => {
        userRewards[obj.value] = parseInt(obj.score, 10);
    });

    return rewards.filter((reward: Reward) => {
        if (!reward) {
            return false;
        }
        const claimable = parseInt(reward.claimable, 10);
        return claimable === 0 || (!userRewards[reward.id] || userRewards[reward.id] < claimable);
    });
}

async function checkCondition(reward: Reward, method: () => unknown | Promise<unknown>): Promise<boolean> {
    let value: unknown;

    // Check if method returns a Promise and handle accordingly
    if (method.constructor && method.constructor.name === 'AsyncFunction') {
        value = await method();
    } else {
        value = method();
        // If the return value is a Promise, await it
        if (value instanceof Promise) {
            value = await value;
        }
    }

    return await plugins.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, { left: value, right: reward.value }) as boolean; // Assuming fire returns a boolean
}


async function giveRewards(uid: number, rewards: Reward[]): Promise<void> {
    const rewardData : Reward[] = await getRewardsByRewardData(rewards);
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await Promise.all(rewards.map((reward, i) => plugins.hooks.fire(`action:rewards.award:${reward.rid}`, { uid, reward: rewardData[i] }).then(() => db.sortedSetIncrBy(`uid:${uid}:rewards`, 1, reward.id) as Promise<void>)));
}

// Now define the rewards object
const rewards = {
    checkConditionAndRewardUser: async function (params: Params): Promise<void> {
        const { uid, condition, method } = params;
        const isActive = await isConditionActive(condition);
        if (!isActive) {
            return;
        }
        const ids = await getIDsByCondition(condition);
        let rewardData = await getRewardDataByIDs(ids);
        rewardData = await filterCompletedRewards(uid, rewardData);
        rewardData = rewardData.filter(Boolean);
        if (!rewardData || !rewardData.length) {
            return;
        }
        const eligible = await Promise.all(rewardData.map(reward => checkCondition(reward, method)));
        const eligibleRewards = rewardData.filter((_, index) => eligible[index]);
        await giveRewards(uid, eligibleRewards);
    },
};

export default rewards;
