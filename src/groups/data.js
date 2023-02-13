"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const validator_1 = __importDefault(require("validator"));
const nconf_1 = __importDefault(require("nconf"));
const database_1 = __importDefault(require("../database"));
const plugins_1 = __importDefault(require("../plugins"));
const utils_1 = __importDefault(require("../utils"));
const translator_1 = __importDefault(require("../translator"));
const coverPhoto_1 = __importDefault(require("../coverPhoto"));
const intFields = [
    'createtime', 'memberCount', 'hidden', 'system', 'private',
    'userTitleEnabled', 'disableJoinRequests', 'disableLeave',
];
function escapeGroupData(group) {
    if (group) {
        group.nameEncoded = encodeURIComponent(group.name);
        group.displayName = validator_1.default.escape(String(group.name));
        group.description = validator_1.default.escape(String(group.description || ''));
        group.userTitle = validator_1.default.escape(String(group.userTitle || ''));
        group.userTitleEscaped = translator_1.default.escape(group.userTitle);
    }
}
function modifyGroup(group, fields) {
    if (group) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        database_1.default.parseIntFields(group, intFields, fields);
        escapeGroupData(group);
        group.userTitleEnabled = ([null, undefined].includes(group.userTitleEnabled)) ? 1 : group.userTitleEnabled;
        group.labelColor = validator_1.default.escape(String(group.labelColor || '#000000'));
        group.textColor = validator_1.default.escape(String(group.textColor || '#ffffff'));
        group.icon = validator_1.default.escape(String(group.icon || ''));
        group.createtimeISO = utils_1.default.toISOString(group.createtime);
        group.private = ([null, undefined].includes(group.private)) ? 1 : group.private;
        group.memberPostCids = group.memberPostCids || '';
        group.memberPostCidsArray = group.memberPostCids.split(',').map(cid => parseInt(cid, 10)).filter(Boolean);
        group['cover:thumb:url'] = group['cover:thumb:url'] || group['cover:url'];
        if (group['cover:url']) {
            group['cover:url'] = group['cover:url'].startsWith('http') ? group['cover:url'] : (nconf_1.default.get('relative_path') + group['cover:url']);
        }
        else {
            group['cover:url'] = coverPhoto_1.default.getDefaultGroupCover(group.name);
        }
        if (group['cover:thumb:url']) {
            group['cover:thumb:url'] = group['cover:thumb:url'].startsWith('http') ? group['cover:thumb:url'] : (nconf_1.default.get('relative_path') + group['cover:thumb:url']);
        }
        else {
            group['cover:thumb:url'] = coverPhoto_1.default.getDefaultGroupCover(group.name);
        }
        group['cover:position'] = validator_1.default.escape(String(group['cover:position'] || '50% 50%'));
    }
}
module.exports = function (Groups) {
    Groups.getGroupsFields = async function (groupNames, fields) {
        if (!Array.isArray(groupNames) || !groupNames.length) {
            return [];
        }
        const ephemeralIdx = groupNames.reduce((memo, cur, idx) => {
            if (Groups.ephemeralGroups.includes(cur)) {
                memo.push(idx);
            }
            return memo;
        }, []);
        const keys = groupNames.map(groupName => `group:${groupName}`);
        // The next line calls a function in a module that has not been updated to TS yet
        /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
        const groupData = await database_1.default.getObjects(keys, fields);
        if (ephemeralIdx.length) {
            ephemeralIdx.forEach((idx) => {
                groupData[idx] = Groups.getEphemeralGroup(groupNames[idx]);
            });
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const results = await plugins_1.default.hooks.fire('filter:groups.get', { groups: groupData });
        results.groups.forEach((groupData) => modifyGroup(groupData, fields));
        return results.groups;
    };
    Groups.getGroupsData = async function (groupNames) {
        return await Groups.getGroupsFields(groupNames, []);
    };
    Groups.getGroupData = async function (groupName) {
        const groupsData = await Groups.getGroupsData([groupName]);
        return Array.isArray(groupsData) && groupsData[0] ? groupsData[0] : null;
    };
    Groups.getGroupField = async function (groupName, field) {
        const groupData = await Groups.getGroupFields(groupName, [field]);
        return groupData ? groupData[field] : null;
    };
    Groups.getGroupFields = async function (groupName, fields) {
        const groups = await Groups.getGroupsFields([groupName], fields);
        return groups ? groups[0] : null;
    };
    Groups.setGroupField = async function (groupName, field, value) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await database_1.default.setObjectField(`group:${groupName}`, field, value);
        await plugins_1.default.hooks.fire('action:group.set', { field: field, value: value, type: 'set' });
    };
};
