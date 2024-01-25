
import db from '../database';
import user from '../user';

interface Group {
    name: string;
    displayName: string;
    hidden: number;
    system: number;
    private: number;
}

interface GroupsModel {
    getUsersFromSet(set: string, fields?: string[]): Promise<any[]>;
    getUserGroups(uids: string[]): Promise<any>;
    getUserGroupsFromSet(set: string, uids: string[]): Promise<any[]>;
    getUserGroupMembership(set: string, uids: string[]): Promise<any[]>;
    isMemberOfGroups(uid: string, groupNames: string[]): Promise<boolean[]>;
    getUserInviteGroups(uid: string): Promise<any>;
    getGroupsData(groupName: string): Promise<any>;
    getNonPrivilegeGroups(set: string, start: number, end: number): Promise<Group[]>;
    ownership: {
        isOwner(uid: string, groupName: string): Promise<boolean>;
    };
    ephemeralGroups: string[];
}

module.exports = function (Groups: GroupsModel) {
    Groups.getUsersFromSet = async function (set: string, fields?: string[]) {
        const uids: string[] = await db.getSetMembers(set);

        if (fields) {
            return await user.getUsersFields(uids, fields);
        }
        return await user.getUsersData(uids);
    };

    Groups.getUserGroups = async function (uids: string[]) {
        return await Groups.getUserGroupsFromSet('groups:visible:createtime', uids);
    };

    Groups.getUserGroupsFromSet = async function (set: string, uids: string[]) {
        const memberOf: any[] = await Groups.getUserGroupMembership(set, uids);
        return await Promise.all(memberOf.map((memberOf: any) => Groups.getGroupsData(memberOf)));
    };

    Groups.getUserGroupMembership = async function (set: string, uids: string[]) {
        const groupNames: string[] = await db.getSortedSetRevRange(set, 0, -1);
        return await Promise.all(uids.map((uid: string) => findUserGroups(uid, groupNames)));
    };

    async function findUserGroups(uid: string, groupNames: string[]) {
        const isMembers: boolean[] = await Groups.isMemberOfGroups(uid, groupNames);
        return groupNames.filter((name: string, i: number) => isMembers[i]);
    }

    Groups.getUserInviteGroups = async function (uid: string) {
        let allGroups: Group[] = await Groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
        allGroups = allGroups.filter((group: Group) => !Groups.ephemeralGroups.includes(group.name));

        const publicGroups: Group[] = allGroups.filter((group: Group) => group.hidden === 0 
                                    && group.system === 0 && group.private === 0);
        const adminModGroups: Group[] = [
            { name: 'administrators', displayName: 'administrators', hidden: 0, system: 0, private: 0 },
            { name: 'Global Moderators', displayName: 'Global Moderators', hidden: 0, system: 0, private: 0 },
        ];
        // Private (but not hidden)
        const privateGroups: Group[] = allGroups.filter((group: Group) => group.hidden === 0 &&
            group.system === 0 && group.private === 1);

        const [ownership, isAdmin, isGlobalMod] = await Promise.all([
            Promise.all(privateGroups.map((group: Group) => Groups.ownership.isOwner(uid, group.name))),
            user.isAdministrator(uid),
            user.isGlobalModerator(uid),
        ]);
        const ownGroups: Group[] = privateGroups.filter((group: Group, index: number) => ownership[index]);

        let inviteGroups: Group[] = [];
        if (isAdmin) {
            inviteGroups = inviteGroups.concat(adminModGroups).concat(privateGroups);
        } else if (isGlobalMod) {
            inviteGroups = inviteGroups.concat(privateGroups);
        } else {
            inviteGroups = inviteGroups.concat(ownGroups);
        }

        return inviteGroups
            .concat(publicGroups);
    };
};
