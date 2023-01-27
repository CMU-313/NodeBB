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
exports.members = exports.details = exports.list = void 0;
// import validator from 'validator';
const nconf_1 = __importDefault(require("nconf"));
// import meta from '../meta';
const groups_1 = __importDefault(require("../groups"));
const user_1 = __importDefault(require("../user"));
const helpers_1 = __importDefault(require("./helpers"));
const pagination_1 = __importDefault(require("../pagination"));
const privileges_1 = __importDefault(require("../privileges"));
const returnNext = groups_1.default;
function list(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const sort = (req.query.sort || 'alpha');
        const [groupData, allowGroupCreation] = yield Promise.all([
            groups_1.default.getGroupsBySort(sort, 0, 14),
            privileges_1.default.global.can('group:create', req.uid),
        ]);
        res.render('groups/list', {
            groups: groupData,
            allowGroupCreation: allowGroupCreation,
            nextStart: 15,
            title: '[[pages:groups]]',
            breadcrumbs: helpers_1.default.buildBreadcrumbs([{ text: '[[pages:groups]]' }]),
        });
    });
}
exports.list = list;
function details(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const lowercaseSlug = req.params.slug.toLowerCase();
        if (req.params.slug !== lowercaseSlug) {
            if (res.locals.isAPI) {
                req.params.slug = lowercaseSlug;
            }
            else {
                const x = `${String(nconf_1.default.get('relative_path'))}/groups/${lowercaseSlug}`;
                return res.redirect(x);
            }
        }
        const groupName = groups_1.default.getGroupNameByGroupSlug(req.params.slug);
        if (!groupName) {
            return returnNext;
        }
        const [exists, isHidden, isAdmin, isGlobalMod] = yield Promise.all([
            groups_1.default.exists(groupName),
            groups_1.default.isHidden(groupName),
            user_1.default.isAdministrator(req.uid),
            user_1.default.isGlobalModerator(req.uid),
        ]);
        if (!exists) {
            return returnNext;
        }
        if (isHidden && !isAdmin && !isGlobalMod) {
            const [isMember, isInvited] = yield Promise.all([
                groups_1.default.isMember(req.uid, groupName),
                groups_1.default.isInvited(req.uid, groupName),
            ]);
            if (!isMember && !isInvited) {
                return returnNext;
            }
        }
        const [groupData, posts] = yield Promise.all([
            groups_1.default.get(groupName, {
                uid: req.uid,
                truncateUserList: true,
                userListCount: 20,
            }),
            groups_1.default.getLatestMemberPosts(groupName, 10, req.uid),
        ]);
        if (!groupData) {
            return returnNext;
        }
        groupData.isOwner = groupData.isOwner || isAdmin || (isGlobalMod && !groupData.system);
        res.render('groups/details', {
            title: `[[pages:group, ${groupData.displayName}]]`,
            group: groupData,
            posts: posts,
            isAdmin: isAdmin,
            isGlobalMod: isGlobalMod,
            allowPrivateGroups: Boolean(groups_1.default.allowPrivateGroups),
            breadcrumbs: helpers_1.default.buildBreadcrumbs([{ text: '[[pages:groups]]', url: '/groups' }, { text: groupData.displayName }]),
        });
    });
}
exports.details = details;
function members(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = (parseInt(req.query.page.toString(), 10) || 1);
        const usersPerPage = 50;
        const start = Math.max(0, (page - 1) * usersPerPage);
        const stop = start + usersPerPage - 1;
        const groupName = groups_1.default.getGroupNameByGroupSlug(req.params.slug);
        if (!groupName) {
            return returnNext;
        }
        const [groupData, isAdminOrGlobalMod, isMember, isHidden] = yield Promise.all([
            groups_1.default.getGroupData(groupName),
            user_1.default.isAdminOrGlobalMod(req.uid),
            groups_1.default.isMember(req.uid, groupName),
            groups_1.default.isHidden(groupName),
        ]);
        if (isHidden && !isMember && !isAdminOrGlobalMod) {
            return returnNext;
        }
        const users = user_1.default.getUsersFromSet(`group:${groupName}:members`, req.uid, start, stop);
        const breadcrumbs = helpers_1.default.buildBreadcrumbs([
            { text: '[[pages:groups]]', url: '/groups' },
            { text: String(groups_1.default.escape(String(groupName))), url: String(`/groups/${req.params.slug}`) },
            { text: String('[[groups:details.members]]') },
        ]);
        const pageCount = Math.max(1, Math.ceil(groupData.memberCount / usersPerPage));
        res.render('groups/members', {
            users: users,
            pagination: pagination_1.default.create(page, pageCount, req.query),
            breadcrumbs: breadcrumbs,
        });
    });
}
exports.members = members;
