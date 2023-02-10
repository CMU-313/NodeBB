import db from '../database';
import user from '../user';
import plugins from '../plugins';
import cache from '../cache';

interface groups {
    leave: (groupNames: string[] | string, uid: string) => Promise<void>;
    isMemberOfGroups: (uid: string, groupNames: string[]) => Promise<boolean>;
    clearCache: (uid: string, groupsToLeave: string[]) =>Promise<void>;
    getGroupsFields: (groupsToLeave: string[], fields: string[]) => Promise<groups[]>;
    isPrivilegeGroup: (name: string) => boolean;
    destroy: Promise<void>;
    leaveAllGroups: (uid: string) => Promise<void>;
    rejectMembership: (groups: string[], uid: string) => Promise<void>;
    kick: (uid: string, groupName: string, isOwner: boolean) => Promise<void>;
    memberCount: number;
    groupNames: string[];
    name: string;
    hidden: boolean;
}

type UserData = {
    groupTitleArray: string[];
}


export = (Groups: groups) => {
    async function clearGroupTitleIfSet(groupNames: string[], uid: string): Promise<groups> {
        groupNames = groupNames.filter(groupName => groupName !== 'registered-users' && !Groups.isPrivilegeGroup(groupName));
        if (!groupNames.length) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const userData: UserData = await user.getUserData(uid) as UserData;
        if (!userData) {
            return;
        }

        const newTitleArray = userData.groupTitleArray.filter((groupTitle: string) => !groupNames.includes(groupTitle));
        if (newTitleArray.length) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.setObjectField(`user:${uid}`, 'groupTitle', JSON.stringify(newTitleArray));
        } else {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await db.deleteObjectField(`user:${uid}`, 'groupTitle');
        }
    }

    Groups.leave = async (groupNames : string[], uid : string): Promise<void> => {
        if (Array.isArray(groupNames) && !groupNames.length) {
            return;
        }
        if (!Array.isArray(groupNames)) {
            groupNames = [groupNames];
        }

        const isMembers: boolean = await Groups.isMemberOfGroups(uid, groupNames);

        const groupsToLeave: string[] = groupNames.filter((groupName, index) => isMembers[index]);

        if (!groupsToLeave.length) {
            return;
        }

        await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetRemove(groupsToLeave.map(groupName => `group:${groupName}:members`), uid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setRemove(groupsToLeave.map(groupName => `group:${groupName}:owners`), uid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.decrObjectField(groupsToLeave.map(groupName => `group:${groupName}`), 'memberCount'),
        ]);

        await Groups.clearCache(uid, groupsToLeave);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        cache.del(groupsToLeave.map(name => `group:${name}:members`));

        const groupData: groups[] = await Groups.getGroupsFields(groupsToLeave, ['name', 'hidden', 'memberCount']);
        if (!groupData) {
            return;
        }

        const emptyPrivilegeGroups: groups[] = groupData.filter((g: { name: string; memberCount: number; }) => g &&
                                             Groups.isPrivilegeGroup(g.name) && g.memberCount === 0);
        const visibleGroups: groups[] = groupData.filter((g: { hidden: boolean; }) => g && !g.hidden);

        const promises = [];
        if (emptyPrivilegeGroups.length) {
            promises.push(Groups.destroy, emptyPrivilegeGroups);
        }
        if (visibleGroups.length) {
            promises.push(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                db.sortedSetAdd,
                'groups:visible:memberCount',
                visibleGroups.map(groupData => groupData.memberCount),
                visibleGroups.map(groupData => groupData.name)
            );
        }

        await Promise.all(promises);

        await clearGroupTitleIfSet(groupsToLeave, uid);

        await plugins.hooks.fire('action:group.leave', {
            groupNames: groupsToLeave,
            uid: uid,
        });
    };

    Groups.leaveAllGroups = async function (uid: string) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const groups: string[] = await db.getSortedSetRange('groups:createtime', 0, -1) as string[];
        await Promise.all([
            Groups.leave(groups, uid),
            Groups.rejectMembership(groups, uid),
        ]);
    };

    Groups.kick = async function (uid: string, groupName: string, isOwner: boolean): Promise<void> {
        if (isOwner) {
            // If the owners set only contains one member, error out!
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const numOwners: number = await db.setCount(`group:${groupName}:owners`) as number;
            if (numOwners <= 1) {
                throw new Error('[[error:group-needs-owner]]');
            }
        }
        await Groups.leave(groupName, uid);
    };
};
