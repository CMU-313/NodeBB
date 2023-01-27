const plugins = require('../plugins');
const slugify = require('../slugify');
const db = require('../database');
const batch = require('../batch');

interface Groups {
    destroy : (groupNames: string[]) => Promise<void>;
    getGroupsData : (content :string[]) => string[];
    cache : any;
    isPrivilegeGroup : (group : string) => Promise<void>;
}


export default function (Groups: Groups) {
    Groups.destroy = async function (groupNames) {
        if (!Array.isArray(groupNames)) {
            groupNames = [groupNames];
        }

        let groupsData : string[] = Groups.getGroupsData(groupNames);
        groupsData = groupsData.filter(Boolean);
        if (!groupsData.length) {
            return;
        }
        const keys = [];
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
        const fields = groupNames.map(groupName => slugify(groupName));

        async function removeGroupsFromPrivilegeGroups(groupNames) {
            await batch.processSortedSet('groups:createtime', async (otherGroups) => {
                const privilegeGroups = otherGroups.filter((group : string) => Groups.isPrivilegeGroup(group));
                const keys = privilegeGroups.map(group => `group:${group}:members`);
                await db.sortedSetRemove(keys, groupNames);
            }, {
                batch: 500,
            });
        }

        await Promise.all([
            db.deleteAll(keys),
            db.sortedSetRemove([
                'groups:createtime',
                'groups:visible:createtime',
                'groups:visible:memberCount',
            ], groupNames),
            db.sortedSetRemove('groups:visible:name', sets),
            db.deleteObjectFields('groupslug:groupname', fields),
            removeGroupsFromPrivilegeGroups(groupNames),
        ]);
        Groups.cache.reset();
        plugins.hooks.fire('action:groups.destroy', { groups: groupsData });
    };
}
