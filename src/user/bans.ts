
import winston from 'winston';

import meta from '../meta';
import emailer from '../emailer';
import db from '../database';
import groups from '../groups';
import privileges from '../privileges';

interface UserObject {
    bans : BansObject,
    setUserField: (uid: string, field: string, value: number) => Promise<void>,
    getUserField: (uid: string, field: string,) => Promise<DataObject>,
    getUsersFields: (uid: string[], fields: string[]) => Promise<DataObject[]>,
}

interface BansObject {
    ban : (uid : string, until : number, reason : string) => Promise<BanDataObject>,
    unban : (uids : string[]) => Promise<void>,
    isBanned : (uids: string[]) => Promise<boolean | boolean[]>,
    canLoginIfBanned : (uid : string) => Promise<boolean>,
    unbanIfExpired : (uids: string[]) => Promise<{banned: boolean}[]>,
    calcExpiredFromUserData : (userData: DataObject[]) => Promise<{banned: boolean}[]>,
    filterBanned : (uids : string[]) => Promise<string[]>,
    getReason : (uid : string) => Promise<string>,
}

interface DataObject {
    uids: string[],
    uid: string,
}

interface BanDataObject {
    uid : string,
    timestamp : number,
    expire : number,
    reason : string,
}

const User: UserObject | null = null;

User.bans.ban = async function (uid : string, until : number, reason : string) {
    // "until" (optional) is unix timestamp in milliseconds
    // "reason" (optional) is a string
    until = until || 0;
    reason = reason || '';

    const now = Date.now();

    until = parseInt(String(until), 10);
    if (isNaN(until)) {
        throw new Error('[[error:ban-expiry-missing]]');
    }

    const banKey = `uid:${uid}:ban:${now}`;
    const banData : BanDataObject = {
        uid: uid,
        timestamp: now,
        expire: until > now ? until : 0,
    } as BanDataObject;
    if (reason) {
        banData.reason = reason;
    }

    // Leaving all other system groups to have privileges constrained to the "banned-users" group
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const systemGroups = groups.systemGroups.filter(group => group !== groups.BANNED_USERS);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await groups.leave(systemGroups, uid);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await groups.join(groups.BANNED_USERS, uid);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.sortedSetAdd('users:banned', now, uid);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.sortedSetAdd(`uid:${uid}:bans:timestamp`, now, banKey);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.setObject(banKey, banData);
    await User.setUserField(uid, 'banned:expire', banData.expire);
    if (until > now) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd('users:banned:expire', until, uid);
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemove('users:banned:expire', uid);
    }

    // Email notification of ban
    const username = await User.getUserField(uid, 'username');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const siteTitle : string = (meta.config.title || 'NodeBB') as string;

    const data = {
        subject: `[[email:banned.subject, ${siteTitle}]]`,
        username: username,
        until: until ? (new Date(until)).toUTCString().replace(/,/g, '\\,') : false,
        reason: reason,
    };
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/restrict-template-expressions */
    await emailer.send('banned', uid, data).catch(err => winston.error(`[emailer.send] ${err.stack}`));

    return banData;
};

User.bans.unban = async function (uids : string[]) {
    uids = Array.isArray(uids) ? uids : [uids];
    const userData : DataObject[] = await User.getUsersFields(uids, ['email:confirmed']);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.setObject(uids.map(uid => `user:${uid}`), { 'banned:expire': 0 });

    /* eslint-disable no-await-in-loop */
    for (const user of userData) {
        const systemGroupsToJoin : string[] = [
            'registered-users',
            (parseInt(user['email:confirmed'] as string, 10) === 1 ? 'verified-users' : 'unverified-users'),
        ] as string[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await groups.leave(groups.BANNED_USERS, user.uid);
        // An unbanned user would lost its previous "Global Moderator" status
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await groups.join(systemGroupsToJoin, user.uid);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await db.sortedSetRemove(['users:banned', 'users:banned:expire'], uids);
};

User.bans.isBanned = async function (uids : string[]) {
    uids = Array.isArray(uids) ? uids : [uids];
    const result : {banned: boolean}[] = await User.bans.unbanIfExpired(uids);
    return Array.isArray(uids) ? result.map(r => r.banned) : result[0].banned;
};

User.bans.canLoginIfBanned = async function (uid : string) {
    let canLogin = true;

    const { banned } = (await User.bans.unbanIfExpired([uid]))[0];
    // Group privilege overshadows individual one
    if (banned) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        canLogin = await privileges.global.canGroup('local:login', groups.BANNED_USERS) as boolean;
    }
    if (banned && !canLogin) {
        // Checking a single privilege of user
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        canLogin = await groups.isMember(uid, 'cid:0:privileges:local:login') as boolean;
    }

    return canLogin;
};

User.bans.unbanIfExpired = async function (uids : string[]) {
    // loading user data will unban if it has expired -barisu
    const userData = await User.getUsersFields(uids, ['banned:expire']);
    return User.bans.calcExpiredFromUserData(userData);
};

User.bans.calcExpiredFromUserData = async function (userData : DataObject[]) {
    const isArray = Array.isArray(userData);
    const uids = userData.map(u => u.uid);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const banned : boolean[] = await groups.isMembers(uids, groups.BANNED_USERS) as boolean[];
    const result = userData.map((userData : DataObject, index : number) => ({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        banned: banned[index],
        'banned:expire': userData && userData['banned:expire'] as boolean,
        banExpired: userData && userData['banned:expire'] <= Date.now() && userData['banned:expire'] !== 0,
    }));
    return isArray ? result : result;
};

User.bans.filterBanned = async function (uids : string[]) {
    const isBanned = await User.bans.isBanned(uids);
    return uids.filter((uid, index) => !isBanned[index]);
};

User.bans.getReason = async function (uid : string) {
    if (parseInt(uid, 10) <= 0) {
        return '';
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const keys : string[] = await db.getSortedSetRevRange(`uid:${uid}:bans:timestamp`, 0, 0) as string[];
    if (!keys.length) {
        return '';
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const banObj : BanDataObject = await db.getObject(keys[0]) as BanDataObject;
    return banObj && banObj.reason ? banObj.reason : '';
};

export default User;
