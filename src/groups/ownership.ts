import { Db } from '../database'; 
import { Plugins } from '../plugins'; 

interface Group {
    ownership: {
        isOwner(uid: number, groupName: string): Promise<boolean>;
        isOwners(uids: number[], groupName: string): Promise<boolean[]>;
        grant(toUid: number, groupName: string): Promise<void>;
        rescind(toUid: number, groupName: string): Promise<void>;
    };
}

class GroupClass implements Group {
    ownership = {
        isOwner: async (uid: number, groupName: string): Promise<boolean> => {
            if (!(uid > 0)) {
                return false;
            }
            
            return await Db.isSetMember(`group:${groupName}:owners`, uid.toString()) as boolean;
        },
        
        isOwners: async (uids: number[], groupName: string): Promise<boolean[]> => {
            if (!Array.isArray(uids)) {
                return [];
            }
            return await Db.isSetMembers(`group:${groupName}:owners`, uids.map(uid => uid.toString())) as boolean[];
        },

        grant: async (toUid: number, groupName: string): Promise<void> => {
            await (Db.setAdd(`group:${groupName}:owners`, toUid.toString()) as Promise<void>);
            Plugins.hooks.fire('action:group.grantOwnership', { uid: toUid, groupName: groupName });
        },
        
        rescind: async (toUid: number, groupName: string): Promise<void> => {
            const numOwners = await (Db.setCount(`group:${groupName}:owners`) as Promise<number>);
            const isOwner = await (Db.isSortedSetMember(`group:${groupName}:owners`) as Promise<boolean>);
            if (numOwners <= 1 && isOwner) {
                throw new Error('[[error:group-needs-owner]]');
            }
            await (Db.setRemove(`group:${groupName}:owners`, toUid.toString()) as Promise<void>);
            Plugins.hooks.fire('action:group.rescindOwnership', { uid: toUid, groupName: groupName });
        }
    }
}

export = GroupClass;


