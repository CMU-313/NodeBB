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
const database_1 = require("../database");
const plugins_1 = require("../plugins");
class GroupClass {
    constructor() {
        this.ownership = {
            isOwner: (uid, groupName) => __awaiter(this, void 0, void 0, function* () {
                if (!(uid > 0)) {
                    return false;
                }
                return yield database_1.Db.isSetMember(`group:${groupName}:owners`, uid.toString());
            }),
            isOwners: (uids, groupName) => __awaiter(this, void 0, void 0, function* () {
                if (!Array.isArray(uids)) {
                    return [];
                }
                return yield database_1.Db.isSetMembers(`group:${groupName}:owners`, uids.map(uid => uid.toString()));
            }),
            grant: (toUid, groupName) => __awaiter(this, void 0, void 0, function* () {
                yield database_1.Db.setAdd(`group:${groupName}:owners`, toUid.toString());
                plugins_1.Plugins.hooks.fire('action:group.grantOwnership', { uid: toUid, groupName: groupName });
            }),
            rescind: (toUid, groupName) => __awaiter(this, void 0, void 0, function* () {
                const numOwners = yield database_1.Db.setCount(`group:${groupName}:owners`);
                const isOwner = yield database_1.Db.isSortedSetMember(`group:${groupName}:owners`);
                if (numOwners <= 1 && isOwner) {
                    throw new Error('[[error:group-needs-owner]]');
                }
                yield database_1.Db.setRemove(`group:${groupName}:owners`, toUid.toString());
                plugins_1.Plugins.hooks.fire('action:group.rescindOwnership', { uid: toUid, groupName: groupName });
            })
        };
    }
}
module.exports = GroupClass;
