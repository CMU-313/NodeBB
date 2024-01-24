import plugins from '../plugins';
import slugify from '../slugify';
import db from '../database';
import batch from '../batch';

interface Cache {
    reset: () => void;
}

interface GroupsInterface {
    isPrivilegeGroup: (name: string) => boolean;
    getGroupsData: (groupNames: string[]) => Promise<string []>;
    cache: Cache;
    destroy: (groupNames : string[]) => Promise<void>;
}

export default function (Groups : GroupsInterface) {
    async function removeGroupsFromPrivilegeGroups(groupNames : string[]) {
        await batch.processSortedSet('groups:createtime', async (otherGroups : string[]) => {
            const privilegeGroups = otherGroups.filter(group => Groups.isPrivilegeGroup(group));
            const keys = privilegeGroups.map(group => `group:${group}:members`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.sortedSetRemove(keys, groupNames);
        }, {
            batch: 500,
        });
    }
    Groups.destroy = async function (groupNames : string[]) {
        if (!Array.isArray(groupNames)) {
            groupNames = [groupNames];
        }

        let groupsData : string[] = await Groups.getGroupsData(groupNames);
        groupsData = groupsData.filter(Boolean);
        if (!groupsData.length) {
            return;
        }
        const keys : string[] = [];
        groupNames.forEach((groupName) => {
            keys.push(
                `group:${groupName}`,
                `group:${groupName}:members`,
                `group:${groupName}:pending`,
                `group:${groupName}:invited`,
                `group:${groupName}:owners`,
                `group:${groupName}:member:pids`
            );
        });
        const sets = groupNames.map(groupName => `${groupName.toLowerCase()}:${groupName}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
        const fields = groupNames.map(groupName => slugify(groupName));

        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.deleteAll(keys),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetRemove([
                'groups:createtime',
                'groups:visible:createtime',
                'groups:visible:memberCount',
            ], groupNames),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetRemove('groups:visible:name', sets),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.deleteObjectFields('groupslug:groupname', fields),
            removeGroupsFromPrivilegeGroups(groupNames),
        ]);
        Groups.cache.reset();
        plugins.hooks.fire('action:groups.destroy', { groups: groupsData }).catch((e: Error) => console.error(e));
    };
}
