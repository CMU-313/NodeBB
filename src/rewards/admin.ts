import plugins from '../plugins';
import db from '../database';
import utils from '../utils';

interface Data {
    rewards: number[],
    id: string,
    condition: string,
    disabled: string
}

interface Reward {
    [key: string]: string[]
}

async function saveConditions(data: Data[]): Promise<void> {
    const rewardsPerCondition: Reward = {};

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.delete('conditions:active');
    const conditions: string[] = [];

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

async function _delete(data: Data): Promise<void> {
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
}
export { _delete as delete };

export async function save(data: Data[]): Promise<Data[]> {
    async function save(data: Data) {
        if (!Object.keys(data.rewards).length) {
            return;
        }
        const rewardsData: number[] = data.rewards;
        delete data.rewards;
        if (!parseInt(data.id, 10)) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            data.id = await db.incrObjectField('global', 'rewards:id') as string;
        }
        await _delete(data);
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
}

async function getActiveRewards(): Promise<Data[]> {
    async function load(id: string): Promise<Data> {
        const [main, rewards]: [Data, number[]] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getObject(`rewards:id:${id}`),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getObject(`rewards:id:${id}:rewards`),
        ]) as [Data, number[]];
        if (main) {
            main.disabled = String(main.disabled === 'true');
            main.rewards = rewards;
        }
        return main;
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const rewardsList: string[] = await db.getSetMembers('rewards:list') as string[];
    const rewardData: Data[] = await Promise.all(rewardsList.map(id => load(id)));
    return rewardData.filter(Boolean);
}

export async function get(): Promise<void> {
    return await utils.promiseParallel({
        active: getActiveRewards(),
        conditions: plugins.hooks.fire('filter:rewards.conditions', []),
        conditionals: plugins.hooks.fire('filter:rewards.conditionals', []),
        rewards: plugins.hooks.fire('filter:rewards.rewards', []),
    });
}
