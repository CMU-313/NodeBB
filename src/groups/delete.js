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
const plugins_1 = __importDefault(require("../plugins"));
const slugify_1 = __importDefault(require("../slugify"));
const database_1 = __importDefault(require("../database"));
const batch_1 = __importDefault(require("../batch"));
function default_1(Groups) {
    function removeGroupsFromPrivilegeGroups(groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            yield batch_1.default.processSortedSet('groups:createtime', (otherGroups) => __awaiter(this, void 0, void 0, function* () {
                const privilegeGroups = otherGroups.filter(group => Groups.isPrivilegeGroup(group));
                const keys = privilegeGroups.map(group => `group:${group}:members`);
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.sortedSetRemove(keys, groupNames);
            }), {
                batch: 500,
            });
        });
    }
    Groups.destroy = function (groupNames) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(groupNames)) {
                groupNames = [groupNames];
            }
            let groupsData = yield Groups.getGroupsData(groupNames);
            groupsData = groupsData.filter(Boolean);
            if (!groupsData.length) {
                return;
            }
            const keys = [];
            groupNames.forEach((groupName) => {
                keys.push(`group:${groupName}`, `group:${groupName}:members`, `group:${groupName}:pending`, `group:${groupName}:invited`, `group:${groupName}:owners`, `group:${groupName}:member:pids`);
            });
            const sets = groupNames.map(groupName => `${groupName.toLowerCase()}:${groupName}`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
            const fields = groupNames.map(groupName => (0, slugify_1.default)(groupName));
            yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.deleteAll(keys),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.sortedSetRemove([
                    'groups:createtime',
                    'groups:visible:createtime',
                    'groups:visible:memberCount',
                ], groupNames),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.sortedSetRemove('groups:visible:name', sets),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.deleteObjectFields('groupslug:groupname', fields),
                removeGroupsFromPrivilegeGroups(groupNames),
            ]);
            Groups.cache.reset();
            plugins_1.default.hooks.fire('action:groups.destroy', { groups: groupsData }).catch((e) => console.error(e));
        });
    };
}
exports.default = default_1;
