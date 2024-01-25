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
const validator_1 = __importDefault(require("validator"));
const nconf_1 = __importDefault(require("nconf"));
const meta_1 = __importDefault(require("../meta"));
const groups_1 = __importDefault(require("../groups"));
const user_1 = __importDefault(require("../user"));
const helpers_1 = __importDefault(require("./helpers"));
const pagination_1 = __importDefault(require("../pagination"));
const privileges_1 = __importDefault(require("../privileges"));
// const groupsController = module.exports as {
//     list: (req: GroupsRequest, res: Response) => Promise<void>;
//     details: (req: GroupsRequest, res: Response, next: NextFunction) => Promise<void>;
//     members: (req: GroupsRequest, res: Response & { query: { page: string } }, next: NextFunction) => Promise<void>;
// };
// social.getPostSharing = async function () {
// export async function getPostSharing(): Promise<Network[]> {
// groupsController.list = function (req, res) {
function list(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const sort = req.query.sort || 'alpha';
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
function details(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const lowercaseSlug = req.params.slug.toLowerCase();
        if (req.params.slug !== lowercaseSlug) {
            if (res.locals.isAPI) {
                req.params.slug = lowercaseSlug;
            }
            else {
                const relpath = String(nconf_1.default.get('relative_path'));
                return res.redirect(`${relpath}/groups/${lowercaseSlug}`); // + lowercaseSlug);
            }
        }
        const groupName = (yield groups_1.default.getGroupNameByGroupSlug(req.params.slug));
        if (!groupName) {
            return next();
        }
        const [exists, isHidden, isAdmin, isGlobalMod] = yield Promise.all([
            groups_1.default.exists(groupName),
            groups_1.default.isHidden(groupName),
            user_1.default.isAdministrator(req.uid),
            user_1.default.isGlobalModerator(req.uid),
        ]);
        if (!exists) {
            return next();
        }
        if (isHidden && !isAdmin && !isGlobalMod) {
            const [isMember, isInvited] = yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                groups_1.default.isMember(req.uid, groupName),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                groups_1.default.isInvited(req.uid, groupName),
            ]); // as Promise<boolean>[]);
            if (!isMember && !isInvited) {
                return next();
            }
        }
        const [groupData, posts] = yield Promise.all([
            groups_1.default.get(groupName, {
                uid: req.uid,
                truncateUserList: true,
                userListCount: 20,
            }),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groups_1.default.getLatestMemberPosts(groupName, req.uid),
        ]);
        if (!groupData) {
            return next();
        }
        groupData.isOwner = groupData.isOwner || isAdmin || (isGlobalMod && !groupData.system);
        res.render('groups/details', {
            title: `[[pages:group, ${groupData.displayName}]]`,
            group: groupData,
            posts: posts,
            isAdmin: isAdmin,
            isGlobalMod: isGlobalMod,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            allowPrivateGroups: meta_1.default.config.allowPrivateGroups,
            breadcrumbs: helpers_1.default.buildBreadcrumbs([{ text: '[[pages:groups]]', url: '/groups' }, { text: groupData.displayName }]),
        });
    });
}
exports.details = details;
function members(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt(req.query.page, 10) || 1;
        const usersPerPage = 50;
        const start = Math.max(0, (page - 1) * usersPerPage);
        const stop = start + usersPerPage - 1;
        const groupName = (yield groups_1.default.getGroupNameByGroupSlug(req.params.slug));
        if (!groupName) {
            return next();
        }
        const [groupData, isAdminOrGlobalMod, isMember, isHidden] = yield Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groups_1.default.getGroupData(groupName),
            user_1.default.isAdminOrGlobalMod(req.uid),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groups_1.default.isMember(req.uid, groupName),
            groups_1.default.isHidden(groupName),
        ]);
        if (isHidden && !isMember && !isAdminOrGlobalMod) {
            return next();
        }
        const users = (yield user_1.default.getUsersFromSet(`group:${groupName}:members`, req.uid, start, stop));
        const breadcrumbs = helpers_1.default.buildBreadcrumbs([
            { text: '[[pages:groups]]', url: '/groups' },
            { text: validator_1.default.escape(String(groupName)), url: `/groups/${req.params.slug}` },
            { text: '[[groups:details.members]]' },
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
