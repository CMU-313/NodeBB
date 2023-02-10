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
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const plugins_1 = __importDefault(require("../plugins"));
const cache_1 = __importDefault(require("../cache"));
module.exports = (Groups) => {
    function clearGroupTitleIfSet(groupNames, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            groupNames = groupNames.filter(groupName => groupName !== 'registered-users' && !Groups.isPrivilegeGroup(groupName));
            if (!groupNames.length) {
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const userData = yield user_1.default.getUserData(uid);
            if (!userData) {
                return;
            }
            const newTitleArray = userData.groupTitleArray.filter((groupTitle) => !groupNames.includes(groupTitle));
            if (newTitleArray.length) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.setObjectField(`user:${uid}`, 'groupTitle', JSON.stringify(newTitleArray));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.deleteObjectField(`user:${uid}`, 'groupTitle');
            }
        });
    }
    Groups.leave = (groupNames, uid) => __awaiter(void 0, void 0, void 0, function* () {
        if (Array.isArray(groupNames) && !groupNames.length) {
            return;
        }
        if (!Array.isArray(groupNames)) {
            groupNames = [groupNames];
        }
        const isMembers = yield Groups.isMemberOfGroups(uid, groupNames);
        const groupsToLeave = groupNames.filter((groupName, index) => isMembers[index]);
        if (!groupsToLeave.length) {
            return;
        }
        yield Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            database_1.default.sortedSetRemove(groupsToLeave.map(groupName => `group:${groupName}:members`), uid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            database_1.default.setRemove(groupsToLeave.map(groupName => `group:${groupName}:owners`), uid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            database_1.default.decrObjectField(groupsToLeave.map(groupName => `group:${groupName}`), 'memberCount'),
        ]);
        yield Groups.clearCache(uid, groupsToLeave);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        cache_1.default.del(groupsToLeave.map(name => `group:${name}:members`));
        const groupData = yield Groups.getGroupsFields(groupsToLeave, ['name', 'hidden', 'memberCount']);
        if (!groupData) {
            return;
        }
        const emptyPrivilegeGroups = groupData.filter((g) => g &&
            Groups.isPrivilegeGroup(g.name) && g.memberCount === 0);
        const visibleGroups = groupData.filter((g) => g && !g.hidden);
        const promises = [];
        if (emptyPrivilegeGroups.length) {
            promises.push(Groups.destroy, emptyPrivilegeGroups);
        }
        if (visibleGroups.length) {
            promises.push(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
            database_1.default.sortedSetAdd, 'groups:visible:memberCount', visibleGroups.map(groupData => groupData.memberCount), visibleGroups.map(groupData => groupData.name));
        }
        yield Promise.all(promises);
        yield clearGroupTitleIfSet(groupsToLeave, uid);
        yield plugins_1.default.hooks.fire('action:group.leave', {
            groupNames: groupsToLeave,
            uid: uid,
        });
    });
    Groups.leaveAllGroups = function (uid) {
        return __awaiter(this, void 0, void 0, function* () {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const groups = yield database_1.default.getSortedSetRange('groups:createtime', 0, -1);
            yield Promise.all([
                Groups.leave(groups, uid),
                Groups.rejectMembership(groups, uid),
            ]);
        });
    };
    Groups.kick = function (uid, groupName, isOwner) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isOwner) {
                // If the owners set only contains one member, error out!
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                const numOwners = yield database_1.default.setCount(`group:${groupName}:owners`);
                if (numOwners <= 1) {
                    throw new Error('[[error:group-needs-owner]]');
                }
            }
            yield Groups.leave(groupName, uid);
        });
    };
};
