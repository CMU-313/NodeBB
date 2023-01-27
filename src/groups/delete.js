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
Object.defineProperty(exports, "__esModule", { value: true });
const plugins = require('../plugins');
const slugify = require('../slugify');
const db = require('../database');
const batch = require('../batch');
function default_1(Groups) {
    Groups.destroy = function (groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(groupNames)) {
                groupNames = [groupNames];
            }
            let groupsData = Groups.getGroupsData(groupNames);
            groupsData = groupsData.filter(Boolean);
            if (!groupsData.length) {
                return;
            }
            const keys = [];
            groupNames.forEach((groupName) => {
                keys.push(`group:${groupName}`, `group:${groupName}:members`, `group:${groupName}:pending`, `group:${groupName}:invited`, `group:${groupName}:owners`, `group:${groupName}:member:pids`);
            });
            const sets = groupNames.map(groupName => `${groupName.toLowerCase()}:${groupName}`);
            const fields = groupNames.map(groupName => slugify(groupName));
            function removeGroupsFromPrivilegeGroups(groupNames) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield batch.processSortedSet('groups:createtime', (otherGroups) => __awaiter(this, void 0, void 0, function* () {
                        const privilegeGroups = otherGroups.filter((group) => Groups.isPrivilegeGroup(group));
                        const keys = privilegeGroups.map(group => `group:${group}:members`);
                        yield db.sortedSetRemove(keys, groupNames);
                    }), {
                        batch: 500,
                    });
                });
            }
            yield Promise.all([
                db.deleteAll(keys),
                db.sortedSetRemove([
                    'groups:createtime',
                    'groups:visible:createtime',
                    'groups:visible:memberCount',
                ], groupNames),
                db.sortedSetRemove('groups:visible:name', sets),
                db.deleteObjectFields('groupslug:groupname', fields),
                removeGroupsFromPrivilegeGroups(groupNames),
            ]);
            Groups.cache.reset();
            plugins.hooks.fire('action:groups.destroy', { groups: groupsData });
        });
    };
}
exports.default = default_1;
