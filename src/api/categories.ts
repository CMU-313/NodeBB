import categories from '../categories';
import events from '../events';
import user from '../user';
import groups from '../groups';
import privileges from '../privileges';


import { UserObjectACP } from '../types';

type Data ={
    cid: string;
    privilege: string[];
    member: string;
    set: string;
}
type UserPriv ={
    read: boolean;
}
type Response ={
    cid: string;
}
interface CategoriesAPI {
    get: (caller: UserObjectACP, data: Data) => Promise<unknown>;
    create: (caller: UserObjectACP, data: Data) => Promise<unknown>;
    update: (caller: UserObjectACP, data: Data) => Promise<unknown>;
    delete: (caller: UserObjectACP, data: Data) => Promise<unknown>;
    getPrivileges(caller: UserObjectACP, cid: string): Promise<unknown>;
    setPrivilege(caller: UserObjectACP, data: Data): Promise<unknown>;
}
interface Priv {
    includes(priv: string): Promise<unknown>;
}
const categoriesAPI: CategoriesAPI = {
    get: async function (caller, data) {
        const privCat: [UserPriv, boolean] = await Promise.all([
            privileges.categories.get(data.cid, caller.uid),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            categories.getCategoryData(data.cid),
        ]) as [UserPriv, boolean];
        if (!privCat[1] || !privCat[0].read) {
            return null;
        }

        return privCat[1];
    },

    create: async function (caller, data) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const response: Response = await categories.create(data) as Response;
        const categoryObjs: number[] = await categories.getCategories([response.cid], caller.uid) as number[];
        return categoryObjs[0];
    },

    update: async function (caller, data) {
        if (!data) {
            throw new Error('[[error:invalid-data]]');
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await categories.update(data);
    },

    delete: async function (caller, data) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const name: string = await categories.getCategoryField(data.cid, 'name') as string;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await categories.purge(data.cid, caller.uid);
        await events.log({
            type: 'category-purge',
            uid: caller.uid,
            ip: caller.ip,
            cid: data.cid,
            name: name,
        });
    },

    getPrivileges: async (caller, cid) => {
        let responsePayload: string;

        if (cid === 'admin') {
            responsePayload = await privileges.admin.list(caller.uid);
        } else if (!parseInt(cid, 10)) {
            responsePayload = await privileges.global.list();
        } else {
            responsePayload = await privileges.categories.list(cid);
        }

        return responsePayload;
    },

    setPrivilege: async (caller, data) => {
        const existsCheck:[boolean, boolean] = await Promise.all([
            user.exists(data.member),
            groups.exists(data.member),
        ]) as [boolean, boolean];

        if (!existsCheck[0] && !existsCheck[1]) {
            throw new Error('[[error:no-user-or-group]]');
        }
        const privs = Array.isArray(data.privilege) ? data.privilege : [data.privilege];
        const type = data.set ? 'give' : 'rescind';
        if (!privs.length) {
            throw new Error('[[error:invalid-data]]');
        }
        if (parseInt(data.cid, 10) === 0) {
            const adminPrivList: Priv = await privileges.admin.getPrivilegeList() as Priv;
            const adminPrivs = privs.filter(priv => adminPrivList.includes(priv));
            if (adminPrivs.length) {
                await privileges.admin[type](adminPrivs, data.member);
            }
            const globalPrivList: Priv = await privileges.global.getPrivilegeList() as Priv;
            const globalPrivs = privs.filter(priv => globalPrivList.includes(priv));
            if (globalPrivs.length) {
                await privileges.global[type](globalPrivs, data.member);
            }
        } else {
            const categoryPrivList: Priv = await privileges.categories.getPrivilegeList() as Priv;
            const categoryPrivs = privs.filter(priv => categoryPrivList.includes(priv));
            await privileges.categories[type](categoryPrivs, data.cid, data.member);
        }

        await events.log({
            uid: caller.uid,
            type: 'privilege-change',
            ip: caller.ip,
            privilege: data.privilege.toString(),
            cid: data.cid,
            action: data.set ? 'grant' : 'rescind',
            target: data.member,
        });
    },
};
export = categoriesAPI;
