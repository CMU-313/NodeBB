// import async from 'async';
import db from '../database';
import batch from '../batch';
import plugins from '../plugins';
import topics from '../topics';
import groups from '../groups';
import privileges from '../privileges';
import cache from '../cache';

// type CategoryObject in category.ts
import { CategoryObject } from '../types';

// Define an interface for the Categories object
interface Categories {
    purge: (cid: number, uid: number) => Promise<void>;
    getCategoryData: (cid: number) => Promise<CategoryObject>;
    getCategoryField: (cid: number, field: string) => Promise<any>;
    getSortedSetRange: (key: string, start: number, stop: number) => Promise<number[]>;
    // Add other methods as needed
  }
export default function (Categories : Categories) {
    async function removeFromParent(cid : number) {
        const [parentCid, children] : [number, number[]] = await Promise.all([
            Categories.getCategoryField(cid, 'parentCid'),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getSortedSetRange(`cid:${cid}:children`, 0, -1),
        ]) as [number, number[]];

        const bulkAdd : Array<Array<any>> = [];
        const childrenKeys = children.map((cid) => {
            bulkAdd.push(['cid:0:children', cid, cid]);
            return `category:${cid}`;
        });

        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetRemove(`cid:${parentCid}:children`, cid),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setObjectField(childrenKeys, 'parentCid', 0),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetAddBulk(bulkAdd),
        ]);

        cache.del([
            'categories:cid',
            'cid:0:children',
            `cid:${parentCid}:children`,
            `cid:${parentCid}:children:all`,
            `cid:${cid}:children`,
            `cid:${cid}:children:all`,
            `cid:${cid}:tag:whitelist`,
        ]);
    }

    async function deleteTags(cid : number): Promise<void> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tags : string[] = await db.getSortedSetMembers(`cid:${cid}:tags`) as string[];

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.deleteAll(tags.map(tag => `cid:${cid}:tag:${tag}:topics`));

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.delete(`cid:${cid}:tags`);
    }

    async function purgeCategory(cid : number, categoryData : CategoryObject) {
        const bulkRemove : Array<object> = [['categories:cid', cid]];
        if (categoryData && categoryData.name) {
            bulkRemove.push(['categories:name', `${categoryData.name.slice(0, 200).toLowerCase()}:${cid}`]);
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemoveBulk(bulkRemove);

        await removeFromParent(cid);
        await deleteTags(cid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.deleteAll([
            `cid:${cid}:tids`,
            `cid:${cid}:tids:pinned`,
            `cid:${cid}:tids:posts`,
            `cid:${cid}:tids:votes`,
            `cid:${cid}:tids:views`,
            `cid:${cid}:tids:lastposttime`,
            `cid:${cid}:recent_tids`,
            `cid:${cid}:pids`,
            `cid:${cid}:read_by_uid`,
            `cid:${cid}:uid:watch:state`,
            `cid:${cid}:children`,
            `cid:${cid}:tag:whitelist`,
            `category:${cid}`,
        ]);
        const privilegeList : Array<string> = await privileges.categories.getPrivilegeList() as Array<string>;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await groups.destroy(privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`));
    }

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Categories.purge = async function (cid : number, uid : number) : Promise<void> {
        await batch.processSortedSet(`cid:${cid}:tids`, async (tids: Array<number>) => {
            // Use Promise.all with map to concurrently execute async operations
            await Promise.all(tids.map(async (tid) => {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                await topics.purgePostsAndTopic(tid, uid);
            }));
        }, { alwaysStartAt: 0 });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const pinnedTids : Array<number> = await db.getSortedSetRevRange(`cid:${cid}:tids:pinned`, 0, -1) as Array<number>;
        // Use Promise.all with map to concurrently execute async operations
        await Promise.all(pinnedTids.map(async (tid) => {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await topics.purgePostsAndTopic(tid, uid);
        }));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const categoryData = await Categories.getCategoryData(cid);
        await purgeCategory(cid, categoryData);
        await plugins.hooks.fire('action:category.delete', { cid: cid, uid: uid, category: categoryData });
    };
}
