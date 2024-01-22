// Note: ChatGPT is used for debugging and generating code snippets for this file
import plugins = require('../plugins');
import db = require('../database');
import utils = require('../utils');

type Condition = string;

type Reward = {
    id: string;
    rewards: Record<string, string>;
    condition: Condition;
    disabled: string | boolean;
};

type ActiveRewardsData = {
    active: Reward[];
    conditions: Condition[];
    conditionals: Record<string, string>[];
    rewards: Record<string, string>[];
};

type RewardsModule = {
    save: (data: Reward[]) => Promise<Reward[]>;
    delete: (data: Reward) => Promise<void>;
    get: () => Promise<ActiveRewardsData>;
};

const rewards: RewardsModule = module.exports as RewardsModule;

export async function saveConditions(data: Reward[]): Promise<void> {
    const rewardsPerCondition: Record<string, string[]> = {};
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.delete('conditions:active');
    const conditions: Condition[] = [];

    data.forEach((reward) => {
        conditions.push(reward.condition);
        rewardsPerCondition[reward.condition] = rewardsPerCondition[reward.condition] || [];
        rewardsPerCondition[reward.condition].push(reward.id);
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.setAdd('conditions:active', conditions);

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await Promise.all(Object.keys(rewardsPerCondition).map(c => db.setAdd(`condition:${c}:rewards`, rewardsPerCondition[c]) as void));
}

rewards.save = async function (data: Reward[]): Promise<Reward[]> {
    async function save(data: Reward): Promise<void> {
        if (!Object.keys(data.rewards).length) {
            return;
        }
        const rewardsData = data.rewards;
        delete data.rewards;

        if (!parseInt(data.id, 10)) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            data.id = await db.incrObjectField('global', 'rewards:id') as string;
        }

        await rewards.delete(data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setAdd('rewards:list', data.id);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`rewards:id:${data.id}`, data);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObject(`rewards:id:${data.id}:rewards`, rewardsData);
    }

    await Promise.all(data.map(data => save(data)));
    await saveConditions(data);
    return data;
};

rewards.delete = async function (data: Reward): Promise<void> {
    await Promise.all([
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
};


export async function getActiveRewards(): Promise<Reward[]> {
    async function load(id: string): Promise<Reward | null> {
        const [main, rewards]: [Reward | null, Record<string, string> | null] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getObject(`rewards:id:${id}`),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getObject(`rewards:id:${id}:rewards`),
        ]) as [Reward | null, Record<string, string> | null];

        if (main) {
            main.disabled = main.disabled === 'true';
            main.rewards = rewards;
        }

        return main;
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const rewardsList: string[] = await db.getSetMembers('rewards:list') as string[];
    const rewardData: (Reward | null)[] = await Promise.all(rewardsList.map(id => load(id)));
    return rewardData.filter(Boolean);
}


rewards.get = async function (): Promise<ActiveRewardsData> {
    return await utils.promiseParallel({
        active: getActiveRewards(),
        conditions: plugins.hooks.fire('filter:rewards.conditions', []),
        conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
        rewards: plugins.hooks.fire('filter:rewards.rewards', []),
    });
};


// require('../promisify')(rewards);
