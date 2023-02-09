import db from '../database';
import user from '../user';

interface groups {
    getUsersFromSet: (set: string, fields: string[]) => Promise<groups>;
    getUserGroups: (uids: string[]) => Promise<groups[]>;
    getUserGroupsFromSet: (set: string, uids: string[]) => Promise<groups[]>;
    getUserGroupMembership: (set: string, uids: string[]) => Promise<{name: string, i: number}[][]>;
    getGroupsData: (memberOf: {name: string; i: number;}[]) => Promise<groups>;
    isMemberOfGroups: (uid: string, groupNames: {name: string, i: number}[]) => Promise<groups[]>;
    getUserInviteGroups: (uid: string) => Promise<({name:string, displayName: string}|groups)[]>;
    getNonPrivilegeGroups: (set: string, start: number, stop: number) => Promise<groups[]>;
    ephemeralGroups: string[];
    name: string;
    displayName: string;
    hidden: number;
    system: number;
    private: number;
    ownership: {isOwner: (uid:string, name:string) => boolean};
}

export = function (Groups: groups) {
    Groups.getUsersFromSet = async function (set, fields): Promise<groups> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uids: string[] = await db.getSetMembers(set) as string[];

        if (fields) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
            return await user.getUsersFields(uids, fields);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await user.getUsersData(uids);
    };

    Groups.getUserGroups = async function (uids : string[]): Promise<groups[]> {
        return await Groups.getUserGroupsFromSet('groups:visible:createtime', uids);
    };

    Groups.getUserGroupsFromSet = async function (set, uids): Promise<groups[]> {
        const memberOf = await Groups.getUserGroupMembership(set, uids);
        return await Promise.all(memberOf.map(memberOf => Groups.getGroupsData(memberOf)));
    };

    async function findUserGroups(uid: string, groupNames: {name: string, i: number}[]):
                                                                                Promise<{name: string, i: number}[]> {
        const isMembers = await Groups.isMemberOfGroups(uid, groupNames);
        return groupNames.filter((name, i) => isMembers[i]);
    }

    Groups.getUserGroupMembership = async function (set, uids): Promise<{name: string, i: number}[][]> {
        // The next line calls a function in a module that has not been updated to TS yet
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,
                                    @typescript-eslint/no-unsafe-member-access,
                                    @typescript-eslint/no-unsafe-call
        */
        const groupNames: {name: string, i: number}[] = await db.getSortedSetRevRange(set, 0, -1);
        return await Promise.all(uids.map(uid => findUserGroups(uid, groupNames)));
    };


    Groups.getUserInviteGroups = async function (uid : string): Promise<({name:string, displayName: string}|groups)[]> {
        let allGroups = await Groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
        allGroups = allGroups.filter(group => !Groups.ephemeralGroups.includes(group.name));

        const publicGroups = allGroups.filter(group => group.hidden === 0 && group.system === 0 && group.private === 0);
        const adminModGroups = [
            { name: 'administrators', displayName: 'administrators' },
            { name: 'Global Moderators', displayName: 'Global Moderators' },
        ];
        // Private (but not hidden)
        const privateGroups = allGroups.filter(group => group.hidden === 0 &&
            group.system === 0 && group.private === 1);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [ownership, isAdmin, isGlobalMod] : [boolean[], boolean, boolean] = await Promise.all([
            Promise.all(privateGroups.map(group => Groups.ownership.isOwner(uid, group.name))),
            user.isAdministrator(uid),
            user.isGlobalModerator(uid),
        ]);
        const ownGroups = privateGroups.filter((group, index) => ownership[index]);

        let inviteGroups: ({name:string, displayName: string}|groups)[] = [];
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
