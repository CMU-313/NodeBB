"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// import async from 'async';
const database_1 = __importDefault(require("../database"));
const batch_1 = __importDefault(require("../batch"));
const plugins_1 = __importDefault(require("../plugins"));
const topics_1 = __importDefault(require("../topics"));
const groups_1 = __importDefault(require("../groups"));
const privileges_1 = __importDefault(require("../privileges"));
const cache_1 = __importDefault(require("../cache"));
function default_1(Categories) {
    function removeFromParent(cid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [parentCid, children] = yield Promise.all([
                Categories.getCategoryField(cid, 'parentCid'),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.getSortedSetRange(`cid:${cid}:children`, 0, -1),
            ]);
            const bulkAdd = [];
            const childrenKeys = children.map((cid) => {
                bulkAdd.push(['cid:0:children', cid, cid]);
                return `category:${cid}`;
            });
            yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.sortedSetRemove(`cid:${parentCid}:children`, cid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.setObjectField(childrenKeys, 'parentCid', 0),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.sortedSetAddBulk(bulkAdd),
            ]);
            cache_1.default.del([
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
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const tags = yield database_1.default.getSortedSetMembers(`cid:${cid}:tags`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.deleteAll(tags.map(tag => `cid:${cid}:tag:${tag}:topics`));
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.delete(`cid:${cid}:tags`);
        });
    }
    function purgeCategory(cid, categoryData) {
        return __awaiter(this, void 0, void 0, function* () {
            const bulkRemove = [['categories:cid', cid]];
            if (categoryData && categoryData.name) {
                bulkRemove.push(['categories:name', `${categoryData.name.slice(0, 200).toLowerCase()}:${cid}`]);
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetRemoveBulk(bulkRemove);
            yield removeFromParent(cid);
            yield deleteTags(cid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.deleteAll([
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
            const privilegeList = yield privileges_1.default.categories.getPrivilegeList();
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield groups_1.default.destroy(privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`));
        });
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Categories.purge = function (cid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch_1.default.processSortedSet(`cid:${cid}:tids`, (tids) => __awaiter(this, void 0, void 0, function* () {
                // Use Promise.all with map to concurrently execute async operations
                yield Promise.all(tids.map((tid) => __awaiter(this, void 0, void 0, function* () {
                    // The next line calls a function in a module that has not been updated to TS yet
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
                    yield topics_1.default.purgePostsAndTopic(tid, uid);
                })));
            }), { alwaysStartAt: 0 });
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const pinnedTids = yield database_1.default.getSortedSetRevRange(`cid:${cid}:tids:pinned`, 0, -1);
            // Use Promise.all with map to concurrently execute async operations
            yield Promise.all(pinnedTids.map((tid) => __awaiter(this, void 0, void 0, function* () {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield topics_1.default.purgePostsAndTopic(tid, uid);
            })));
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const categoryData = yield Categories.getCategoryData(cid);
            yield purgeCategory(cid, categoryData);
            yield plugins_1.default.hooks.fire('action:category.delete', { cid: cid, uid: uid, category: categoryData });
        });
    };
}
exports.default = default_1;
