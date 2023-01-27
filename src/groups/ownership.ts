// 'use strict';

// import db = require('../database');
// import plugins = require('../plugins');


import db from '../database';
import ownership from '../ownership';

interface groups {
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
    ownership: {
        plugins: (toUid: any , groupName: any) => Promise<void>;
        grant: (toUid: any , groupName: any) => Promise<void>;
        rescind: (toUid:
            any, groupName: any) => Promise<void>;isOwner: (uid:string, name:string) => boolean
};
}


exports = function (Groups : groups) {

    // Groups.ownership = {};

    Groups.ownership.isOwner = function (uid, groupName): Promise {
        return __awaiter(this, void 0, void 0, function* (){
        if (!(parseInt(uid, 10) > 0)) {
            return false;
        }
        return await db.isSetMember(`group:${groupName}:owners`, uid);
    }
    };

    Groups.ownership.isOwners = async function (uids, groupName) {
        if (!Array.isArray(uids)) {
            return [];
        }

        return await db.isSetMembers(`group:${groupName}:owners`, uids);
    };

    Groups.ownership.grant = async function (toUid, groupName) {
        await db.setAdd(`group:${groupName}:owners`, toUid);
        plugin.hooks.fire('action:group.grantOwnership', { uid: toUid, groupName: groupName });
    };
    // The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-n
ext-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Groups.ownership.rescind = async function (toUid, groupName) {
        // If the owners set only contains one member (and toUid is that member), error out!
        const numOwners = await db.setCount(`group:${groupName}:owners`);
        const isOwner = await db.isSortedSetMember(`group:${groupName}:owners`);
        if (numOwners <= 1 && isOwner) {
            throw new Error('[[error:group-needs-owner]]');
        }
        await db.setRemove(`group:${groupName}:owners`, toUid);
        plugins.hooks.fire('action:group.rescindOwnership', { uid: toUid, groupName: groupName });
    };
};
