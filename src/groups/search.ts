import user from '../user';
import db from '../database';
import { GroupFullObject } from '../types/group';
import { UserObjectFull } from '../types/user';

type Options = {
    sort: string;
    filterHidden: boolean;
    showMembers: boolean;
    hideEphemeralGroups: boolean;
};

type Data = {
    query: string | number | string[] | undefined;
    groupName: string;
    uid: number;
};

type NewUserObject = UserObjectFull & {isOwner: boolean};
        type UserArray = NewUserObject[];

type Ownership = {
    isOwner: (uid: number, groupName: string) => Promise<boolean>;
    isOwners: (uids: number[], groupName: string) => Promise<boolean[]>
};

type SearchResult = {
    matchCount: number;
    timing: string;
    users: UserArray;
};

type Group = {
    search: (query: string, options: Options) => Promise<GroupFullObject[]>;
    ephemeralGroups: string[];
    BANNED_USERS: string;
    isPrivilegeGroup: (groupName: string) => boolean;
    getGroupsAndMembers: (groupNames: string[]) => Promise<GroupFullObject[]>;
    getGroupsData: (groupNames: string[]) => Promise<GroupFullObject[]>;
    sort: (strategy: string, groups: GroupFullObject[]) => GroupFullObject[];
    searchMembers: (data: Data) => Promise<SearchResult | {users: UserArray}>;
    getOwnersAndMembers: (groupName: string, uid: number, start: number, stop: number) => Promise<UserArray>;
    ownership: Ownership
};
export = function (Groups: Group) {
    Groups.search = async function (query: string, options: Options) {
        if (!query) {
            return [];
        }
        query = String(query).toLowerCase();
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let groupNames: string[] = await db.getSortedSetRange('groups:createtime', 0, -1) as string[];
        if (!options.hideEphemeralGroups) {
            groupNames = Groups.ephemeralGroups.concat(groupNames);
        }
        groupNames = groupNames.filter(name => name.toLowerCase().includes(query) &&
            name !== Groups.BANNED_USERS && // hide banned-users in searches
            !Groups.isPrivilegeGroup(name));
        groupNames = groupNames.slice(0, 100);

        let groupsData: GroupFullObject[];
        if (options.showMembers) {
            groupsData = await Groups.getGroupsAndMembers(groupNames);
        } else {
            groupsData = await Groups.getGroupsData(groupNames);
        }
        groupsData = groupsData.filter(Boolean);
        if (options.filterHidden) {
            groupsData = groupsData.filter(group => !group.hidden);
        }
        return Groups.sort(options.sort, groupsData);
    };

    Groups.sort = function (strategy: string, groups: GroupFullObject[]) {
        switch (strategy) {
        case 'count':
            groups.sort((a, b) => (a.slug > b.slug ? 1 : -1))
                .sort((a, b) => b.memberCount - a.memberCount);
            break;

        case 'date':
            groups.sort((a, b) => b.createtime - a.createtime);
            break;

        case 'alpha': // intentional fall-through
        default:
            groups.sort((a, b) => (a.slug > b.slug ? 1 : -1));
        }

        return groups;
    };

    Groups.searchMembers = async function (data: Data) {
        if (!data.query) {
            const users: UserArray = await Groups.getOwnersAndMembers(data.groupName, data.uid, 0, 19);
            return { users: users };
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const results: SearchResult = await user.search({
            ...data,
            paginate: false,
            hardCap: -1,
        }) as SearchResult;

        const uids = results.users.map(user => user && user.uid);

        const isOwners: boolean[] = await Groups.ownership.isOwners(uids, data.groupName);

        results.users.forEach((user, index) => {
            if (user) {
                user.isOwner = isOwners[index];
            }
        });

        results.users.sort((a, b) => {
            if (a.isOwner && !b.isOwner) {
                return -1;
            } else if (!a.isOwner && b.isOwner) {
                return 1;
            }
            return 0;
        });
        return results;
    };
}
