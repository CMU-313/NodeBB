


import db from '../database';
import user from '../user';


export default function (Groups) {
    Groups.getUsersFromSet = async function (set: string, fields: string[]) {
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
        const memberOf: string[] = await Groups.getUserGroupMembership(set, uids);
        return await Promise.all(memberOf.map(memberOf => Groups.getGroupsData(memberOf)));
    };

    Groups.getUserGroupMembership = async function (set: string, uids: string[]) {
        const groupNames: string[] = await db.getSortedSetRevRange(set, 0, -1);
        return await Promise.all(uids.map(uid => findUserGroups(uid, groupNames)));
    };

    async function findUserGroups(uid: string, groupNames: string[]) {
        const isMembers: boolean[] = await Groups.isMemberOfGroups(uid, groupNames);
        return groupNames.filter((name, i) => isMembers[i]);
    }

    Groups.getUserInviteGroups = async function (uid: string) {
        let allGroups: any[] = await Groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
        allGroups = allGroups.filter(group => !Groups.ephemeralGroups.includes(group.name));

        const publicGroups = allGroups.filter(group => group.hidden === 0 && group.system === 0 && group.private === 0);
        const adminModGroups = [
            { name: 'administrators', displayName: 'administrators' },
            { name: 'Global Moderators', displayName: 'Global Moderators' },
        ];
        // Private (but not hidden)
        const privateGroups = allGroups.filter(group => group.hidden === 0 &&
            group.system === 0 && group.private === 1);

        const [ownership, isAdmin, isGlobalMod] = await Promise.all([
            Promise.all(privateGroups.map(group => Groups.ownership.isOwner(uid, group.name))),
            user.isAdministrator(uid),
            user.isGlobalModerator(uid),
        ]);
        const ownGroups = privateGroups.filter((group, index) => ownership[index]);

        let inviteGroups: any[] = [];
        if (isAdmin) {
            inviteGroups = inviteGroups.concat(adminModGroups).concat(privateGroups);
        } else if (isGlobalMod) {
            inviteGroups = inviteGroups.concat(privateGroups);
        } else {
            inviteGroups = inviteGroups.concat(ownGroups);
        }

        return inviteGroups
            .concat(publicGroups);
    }
}