var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import async from 'async';
import db from '../database';
import batch from '../batch';
import plugins from '../plugins';
import topics from '../topics';
import groups from '../groups';
import privileges from '../privileges';
import cache from '../cache';
export default function (Categories) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Categories.purge = function (cid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch.processSortedSet(`cid:${cid}:tids`, (tids) => __awaiter(this, void 0, void 0, function* () {
                yield async.eachLimit(tids, 10, (tid) => __awaiter(this, void 0, void 0, function* () {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                    yield topics.purgePostsAndTopic(tid, uid);
                }));
            }), { alwaysStartAt: 0 });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const pinnedTids = yield db.getSortedSetRevRange(`cid:${cid}:tids:pinned`, 0, -1);
            yield async.eachLimit(pinnedTids, 10, (tid) => __awaiter(this, void 0, void 0, function* () {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield topics.purgePostsAndTopic(tid, uid);
            }));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const categoryData = yield Categories.getCategoryData(cid);
            yield purgeCategory(cid, categoryData);
            yield plugins.hooks.fire('action:category.delete', { cid: cid, uid: uid, category: categoryData });
        });
    };
    function purgeCategory(cid, categoryData) {
        return __awaiter(this, void 0, void 0, function* () {
            const bulkRemove = [['categories:cid', cid]];
            if (categoryData && categoryData.name) {
                bulkRemove.push(['categories:name', `${categoryData.name.slice(0, 200).toLowerCase()}:${cid}`]);
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield db.sortedSetRemoveBulk(bulkRemove);
            yield removeFromParent(cid);
            yield deleteTags(cid);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield db.deleteAll([
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
            const privilegeList = yield privileges.categories.getPrivilegeList();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield groups.destroy(privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`));
        });
    }
    function removeFromParent(cid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [parentCid, children] = yield Promise.all([
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                Categories.getCategoryField(cid, 'parentCid'),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                db.getSortedSetRange(`cid:${cid}:children`, 0, -1),
            ]);
            const bulkAdd = [];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const childrenKeys = children.map((cid) => {
                bulkAdd.push(['cid:0:children', cid, cid]);
                return `category:${cid}`;
            });
            yield Promise.all([
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
        });
    }
    function deleteTags(cid) {
        return __awaiter(this, void 0, void 0, function* () {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const tags = yield db.getSortedSetMembers(`cid:${cid}:tags`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield db.deleteAll(tags.map(tag => `cid:${cid}:tag:${tag}:topics`));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield db.delete(`cid:${cid}:tags`);
        });
    }
}
