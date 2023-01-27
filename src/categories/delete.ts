

import async, { IterableCollection } from 'async';
import db from '../database';
import batch from '../batch';
import plugins from '../plugins';
import topics from '../topics';
import groups from '../groups';
import privileges from '../privileges';
import cache from '../cache';


type functionType = (tid) => void;

export default function (Categories) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Categories.purge = async function (cid: number, uid: number) {
        await batch.processSortedSet(`cid:${cid}:tids`, async <T extends IterableCollection<T>>(tids: T) => {
            const temp = (tid) => {
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-call */
                topics.purgePostsAndTopic(tid, uid);
            }
            await async.eachLimit(tids, 10, temp);
        }, { alwaysStartAt: 0 });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const pinnedTids: IterableCollection<unknown> = await db.getSortedSetRevRange(`cid:${cid}:tids:pinned`, 0, -1);
        await async.eachLimit(pinnedTids, 10, (async (tid) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await topics.purgePostsAndTopic(tid, uid);
        }) as functionType);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const categoryData: { name: string; } = await Categories.getCategoryData(cid);

        await purgeCategory(cid, categoryData);
        await plugins.hooks.fire('action:category.delete', { cid: cid, uid: uid, category: categoryData });
    };

    async function purgeCategory(cid: number, categoryData: { name: string; }) {
        const bulkRemove = [['categories:cid', cid]];
        if (categoryData && categoryData.name) {
            bulkRemove.push(['categories:name', `${categoryData.name.slice(0, 200).toLowerCase()}:${cid}`]);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemoveBulk(bulkRemove);

        await removeFromParent(cid);
        await deleteTags(cid);
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
        const privilegeList = await privileges.categories.getPrivilegeList();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await groups.destroy(privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`));
    }

    async function removeFromParent(cid: number) {
        const [parentCid, children] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            Categories.getCategoryField(cid, 'parentCid'),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.getSortedSetRange(`cid:${cid}:children`, 0, -1),
        ]);

        const bulkAdd = [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const childrenKeys = children.map((cid: number) => {
            bulkAdd.push(['cid:0:children', cid, cid]);
            return `category:${cid}`;
        });

        await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetRemove(`cid:${parentCid}:children`, cid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setObjectField(childrenKeys, 'parentCid', 0),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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

    async function deleteTags(cid: number) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tags = await db.getSortedSetMembers(`cid:${cid}:tags`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.deleteAll(tags.map(tag => `cid:${cid}:tag:${tag}:topics`));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.delete(`cid:${cid}:tags`);
    }
}
