import nconf from 'nconf';
import querystring from 'querystring';
import { Request, Response, NextFunction } from 'express';

import meta from '../meta';
import pagination from '../pagination';
import user from '../user';
import topics from '../topics';
import helpers from './helpers';

import { SettingsObject, Breadcrumbs, Pagination } from '../types';

const relative_path: string = (nconf.get('relative_path') as string);

type SelectedCategoryData = {
    icon: string,
    name: string,
    bgColor: string
}

type Filter = {
    name: string,
    url: string,
    selected: boolean,
    filter: string,
    icon: string,
}

type UnreadData = {
    title: string,
    breadcrumbs: Breadcrumbs,
    pageCount: number,
    topicCount: number,
    pagination: Pagination,
    showSelect: boolean,
    showTopicTools: boolean,
    allCategoriesUrl: string,
    selectedCategory: SelectedCategoryData,
    selectedCids: number[],
    selectCategoryLabel: string,
    selectCategoryIcon: string,
    showCategorySelectLabel: boolean,
    filters: Filter[],
    selectedFilter: Filter,
}

type CategoryData = {
    selectedCids: number[],
    selectedCategory: SelectedCategoryData
}

type QueryRes = {
    uid: number,
    cid: number,
    filter: string,
    page: string | number
}

export async function get(req: Request<object, object, object, QueryRes> & { uid: number },
    res: Response): Promise<void> {
    const { cid } = req.query;
    const filter = req.query.filter || '';

    const [categoryData, userSettings, isPrivileged]: [CategoryData, SettingsObject, boolean] =
        await Promise.all([
            helpers.getSelectedCategory(cid),

            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user.getSettings(req.uid) as SettingsObject,
            user.isPrivileged(req.uid) as boolean,
        ]);

    const page: number = parseInt(req.query.page as string, 10) || 1;
    const start: number = Math.max(0, (page - 1) * userSettings.topicsPerPage);
    const stop: number = start + userSettings.topicsPerPage - 1;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const data: UnreadData = await topics.getUnreadTopics({
        cid: cid,
        uid: req.uid,
        start: start,
        stop: stop,
        filter: filter,
        query: req.query,
    }) as UnreadData;

    const isDisplayedAsHome = !(
        req.originalUrl.startsWith(`${relative_path}/api/unread`) ||
        req.originalUrl.startsWith(`${relative_path}/unread`)
    );
    const baseUrl = isDisplayedAsHome ? '' : 'unread';

    if (isDisplayedAsHome) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        data.title = meta.config.homePageTitle as string || '[[pages:home]]';
    } else {
        data.title = '[[pages:unread]]';
        data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[unread:title]]' }]);
    }

    data.pageCount = Math.max(
        1,
        Math.ceil(data.topicCount / userSettings.topicsPerPage)
    );
    data.pagination = pagination.create(page, data.pageCount, req.query);
    helpers.addLinkTags({
        url: 'unread',
        res: req.res,
        tags: data.pagination.rel,
    });

    if (userSettings.usePagination && (page < 1 || page > data.pageCount)) {
        req.query.page = Math.max(1, Math.min(data.pageCount, page));
        return helpers.redirect(res, `/unread?${querystring.stringify(req.query)}`);
    }
    data.showSelect = true;
    data.showTopicTools = isPrivileged;
    data.allCategoriesUrl = `${baseUrl}${helpers.buildQueryString(
        req.query,
        'cid',
        ''
    )}`;
    data.selectedCategory = categoryData.selectedCategory;
    data.selectedCids = categoryData.selectedCids;
    data.selectCategoryLabel = '[[unread:mark_as_read]]';
    data.selectCategoryIcon = 'fa-inbox';
    data.showCategorySelectLabel = true;
    data.filters = helpers.buildFilters(baseUrl, filter, req.query);
    data.selectedFilter = data.filters.find(
        filter => filter && filter.selected
    );

    res.render('unread', data);
}

export async function unreadTotal(req: Request & { uid: number }, res: Response, next: NextFunction) {
    const filter = req.query.filter || '';
    try {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const unreadCount = await topics.getTotalUnread(req.uid, filter) as number;
        res.json(unreadCount);
    } catch (err) {
        next(err);
    }
}
