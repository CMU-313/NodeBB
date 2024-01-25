import validator from 'validator';
import nconf from 'nconf';
import { Request, Response, NextFunction } from 'express';

import meta from '../meta';
import groups from '../groups';
import user from '../user';
import helpers from './helpers';
import pagination from '../pagination';
import privileges from '../privileges';
import { GroupFullObject, PostObject, UserObjectSlim } from '../types';

interface GroupsRequest extends Request {
    uid: string;
}

// const groupsController = module.exports as {
//     list: (req: GroupsRequest, res: Response) => Promise<void>;
//     details: (req: GroupsRequest, res: Response, next: NextFunction) => Promise<void>;
//     members: (req: GroupsRequest, res: Response & { query: { page: string } }, next: NextFunction) => Promise<void>;
// };

// social.getPostSharing = async function () {
// export async function getPostSharing(): Promise<Network[]> {
// groupsController.list = function (req, res) {

export async function list(req: GroupsRequest, res: Response) {
    const sort = req.query.sort || 'alpha';

    const [groupData, allowGroupCreation]: [GroupFullObject[], boolean] = await Promise.all([
        groups.getGroupsBySort(sort, 0, 14) as Promise<GroupFullObject[]>,
        privileges.global.can('group:create', req.uid) as Promise<boolean>,
    ]);

    res.render('groups/list', {
        groups: groupData,
        allowGroupCreation: allowGroupCreation,
        nextStart: 15,
        title: '[[pages:groups]]',
        breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]' }]),
    });
}

export async function details(req: GroupsRequest, res: Response, next: NextFunction) {
    const lowercaseSlug = req.params.slug.toLowerCase();
    if (req.params.slug !== lowercaseSlug) {
        if (res.locals.isAPI) {
            req.params.slug = lowercaseSlug;
        } else {
            const relpath = String(nconf.get('relative_path'));
            return res.redirect(`${relpath}/groups/${lowercaseSlug}`); // + lowercaseSlug);
        }
    }
    const groupName = (await groups.getGroupNameByGroupSlug(req.params.slug)) as string;
    if (!groupName) {
        return next();
    }
    const [exists, isHidden, isAdmin, isGlobalMod] = await Promise.all([
        groups.exists(groupName) as Promise<boolean>,
        groups.isHidden(groupName),
        user.isAdministrator(req.uid) as Promise<boolean>,
        user.isGlobalModerator(req.uid) as Promise<boolean>,
    ]);
    if (!exists) {
        return next();
    }
    if (isHidden && !isAdmin && !isGlobalMod) {
        const [isMember, isInvited] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groups.isMember(req.uid, groupName) as Promise<boolean>,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            groups.isInvited(req.uid, groupName) as Promise<boolean>,
        ]); // as Promise<boolean>[]);
        if (!isMember && !isInvited) {
            return next();
        }
    }
    const [groupData, posts] = await Promise.all([
        groups.get(groupName, {
            uid: req.uid,
            truncateUserList: true,
            userListCount: 20,
        }) as Promise<GroupFullObject>,
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        groups.getLatestMemberPosts(groupName, req.uid) as Promise<PostObject[]>,
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
        allowPrivateGroups: meta.config.allowPrivateGroups as boolean,
        breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]', url: '/groups' }, { text: groupData.displayName }]),
    });
}

export async function members(req: GroupsRequest, res: Response & { query: { page: string } }, next: NextFunction) {
    const page = parseInt(req.query.page as string, 10) || 1;
    const usersPerPage = 50;
    const start = Math.max(0, (page - 1) * usersPerPage);
    const stop = start + usersPerPage - 1;
    const groupName = (await groups.getGroupNameByGroupSlug(req.params.slug)) as string;
    if (!groupName) {
        return next();
    }
    const [groupData, isAdminOrGlobalMod, isMember, isHidden] = await Promise.all([
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        groups.getGroupData(groupName) as Promise<GroupFullObject>,
        user.isAdminOrGlobalMod(req.uid) as Promise<boolean>,
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        groups.isMember(req.uid, groupName) as Promise<boolean>,
        groups.isHidden(groupName),
    ]);

    if (isHidden && !isMember && !isAdminOrGlobalMod) {
        return next();
    }
    const users = (await user.getUsersFromSet(`group:${groupName}:members`, req.uid, start, stop)) as UserObjectSlim[];

    const breadcrumbs = helpers.buildBreadcrumbs([
        { text: '[[pages:groups]]', url: '/groups' },
        { text: validator.escape(String(groupName)), url: `/groups/${req.params.slug}` },
        { text: '[[groups:details.members]]' },
    ]);

    const pageCount = Math.max(1, Math.ceil(groupData.memberCount / usersPerPage));
    res.render('groups/members', {
        users: users,
        pagination: pagination.create(page, pageCount, req.query),
        breadcrumbs: breadcrumbs,
    });
}
