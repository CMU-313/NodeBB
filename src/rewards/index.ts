import util from 'util';

import db from '../database';

import plugins from '../plugins';

// import promisify from '../promisify';

// const rewards = promisify(rewards);


export async function isConditionActive(condition : Array<string>): Promise<boolean> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const setMember: boolean = await db.isSetMember('conditions:active', condition) as boolean;
    return setMember;
}

export async function getIDsByCondition(condition) : Promise<string[]> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const getSetMember: Array<string> = await db.isSetMember('conditions:active', condition) as Array<string>;
    return getSetMember;
}

interface ScoreObject {
    value: number | string;
    score: string;
}

interface rewardType {
    id: number;
    rid:number;
    claimable: string;
    conditional: number|string;
    value: number;
}


export async function filterCompletedRewards(uid : number, rewards: rewardType[]) {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const data: ScoreObject[] = await db.getSortedSetRangeByScoreWithScores(`uid:${uid}:rewards`, 0, -1, 1, '+inf') as ScoreObject[];
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
}

export async function getRewardDataByIDs(ids: Array<string>): Promise<rewardType[]> | Promise<rewardType[]> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const objects: Array<rewardType> = await db.getObjects(ids.map(id => `rewards:id:${id}`)) as Array<rewardType>;
    return objects;
}

export async function getRewardsByRewardData(rewards:rewardType[]) : Promise<rewardType[]> {
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const objects: Array<rewardType> = await db.getObjects(rewards.map(reward => `rewards:id:${reward.id}:rewards`)) as Array<rewardType>;
    return objects;
}

export async function checkCondition(reward:rewardType,
    method: ((() => Promise<unknown>)|(() => unknown))) {
    if (method.constructor && method.constructor.name !== 'AsyncFunction') {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const value = util.promisify(method);
        const bool : Promise<boolean> =
        await plugins.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, { left: value, right: reward.value }) as Promise<boolean>;
        return bool;
    }
    const value = await method();
    const bool : Promise<boolean> =
    await plugins.hooks.fire(`filter:rewards.checkConditional:${reward.conditional}`, { left: value, right: reward.value }) as Promise<boolean>;
    return bool;
}

export async function giveRewards(uid:number, rewards:rewardType[]) {
    const rewardData = await getRewardsByRewardData(rewards);
    for (let i = 0; i < rewards.length; i++) {
        /* eslint-disable no-await-in-loop */
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call

        await plugins.hooks.fire(`action:rewards.award:${rewards[i].rid}`, { uid: uid, reward: rewardData[i] })as Promise<boolean>;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetIncrBy(`uid:${uid}:rewards`, 1, rewards[i].id);
    }
}

export async function checkConditionAndRewardUser(params:
            { uid: number, condition: string[], method: typeof Function }) {
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
    const eligibleRewards = rewardData.filter((reward, index) => eligible[index]);
    await giveRewards(uid, eligibleRewards);
}



