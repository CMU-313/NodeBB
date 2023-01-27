import { Request, Response } from 'express';
// import validator from 'validator';
import nconf from 'nconf';
// import meta from '../meta';
import groups from '../groups';
import user from '../user';
import helpers from './helpers';
import pagination from '../pagination';
import privileges from '../privileges';

interface uidRequest extends Request {
    uid: number;
    groupName: string;
}
type group = {
    groupName: string,
    allowGroupCreation: boolean,
    uid: number,
    slug: string,
    isOwner: boolean,
    displayName: string,
    memberCount: number,
    system: boolean,
    isMember: boolean,
    isInvited: boolean
}
type returningNext = {
    value: group
    done: boolean
}


const returnNext: returningNext = groups as returningNext;
export async function list(req: uidRequest, res: Response) {
    const sort: string = (req.query.sort || 'alpha') as string;
    const [groupData, allowGroupCreation]: [group, boolean] = await Promise.all([
        groups.getGroupsBySort(sort, 0, 14),
        privileges.global.can('group:create', req.uid),
    ]) as [group, boolean];

    res.render('groups/list', {
        groups: groupData,
        allowGroupCreation: allowGroupCreation,
        nextStart: 15,
        title: '[[pages:groups]]',
        breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]' }]),
    });
}

export async function details(req: uidRequest, res: Response) {
    const lowercaseSlug: string = req.params.slug.toLowerCase();
    if (req.params.slug !== lowercaseSlug) {
        if (res.locals.isAPI) {
            req.params.slug = lowercaseSlug;
        } else {
            const x = `${String(nconf.get('relative_path'))}/groups/${lowercaseSlug}`;
            return res.redirect(x);
        }
    }
    const groupName: string = groups.getGroupNameByGroupSlug(req.params.slug) as string;
    if (!groupName) {
        return returnNext;
    }
    const [exists, isHidden, isAdmin, isGlobalMod]: [group, boolean, boolean, boolean] = await Promise.all([
        groups.exists(groupName),
        groups.isHidden(groupName),
        user.isAdministrator(req.uid),
        user.isGlobalModerator(req.uid),
    ]) as [group, boolean, boolean, boolean];

    if (!exists) {
        return returnNext;
    }
    if (isHidden && !isAdmin && !isGlobalMod) {
        const [isMember, isInvited]: [boolean, boolean] = await Promise.all([
            groups.isMember(req.uid, groupName),
            groups.isInvited(req.uid, groupName),
        ]) as [boolean, boolean]; if (!isMember && !isInvited) {
            return returnNext;
        }
    }
    const [groupData, posts]: [group, string[]] = await Promise.all([
        groups.get(groupName, {
            uid: req.uid,
            truncateUserList: true,
            userListCount: 20,
        }),
        groups.getLatestMemberPosts(groupName, 10, req.uid),
    ]) as [group, string[]];
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
        allowPrivateGroups: Boolean(groups.allowPrivateGroups),
        breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:groups]]', url: '/groups' }, { text: groupData.displayName }]),
    });
}

export async function members(req: uidRequest, res: Response) {
    const page: number = (parseInt(req.query.page.toString(), 10) || 1);
    const usersPerPage: number = 50 as number;
    const start: number = Math.max(0, (page - 1) * usersPerPage);
    const stop: number = start + usersPerPage - 1;
    const groupName: string = groups.getGroupNameByGroupSlug(req.params.slug) as string;
    if (!groupName) {
        return returnNext;
    }
    const [groupData, isAdminOrGlobalMod, isMember, isHidden]: [group, boolean, boolean, boolean] = await Promise.all([
        groups.getGroupData(groupName),
        user.isAdminOrGlobalMod(req.uid),
        groups.isMember(req.uid, groupName),
        groups.isHidden(groupName),
    ]) as [group, boolean, boolean, boolean];
    if (isHidden && !isMember && !isAdminOrGlobalMod) {
        return returnNext;
    }
    const users: string = user.getUsersFromSet(`group:${groupName}:members`, req.uid, start, stop) as string;
    const breadcrumbs: [Set<string>, Set<string>, Set<string>] = helpers.buildBreadcrumbs([
        { text: '[[pages:groups]]', url: '/groups' },
        { text: String(groups.escape(String(groupName))), url: String(`/groups/${req.params.slug}`) },
        { text: String('[[groups:details.members]]') },
    ]) as [Set<string>, Set<string>, Set<string>];
    const pageCount: number = Math.max(1, Math.ceil(groupData.memberCount / usersPerPage));
    res.render('groups/members', {
        users: users,
        pagination: pagination.create(page, pageCount, req.query),
        breadcrumbs: breadcrumbs,
    });
}

