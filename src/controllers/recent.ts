import nconf from 'nconf';
import { Request, Response } from 'express';
import { CategoryObject, SettingsObject } from '../types';

import user from '../user';
import categories from '../categories';
import topics from '../topics';
import meta from '../meta';
import helpers from './helpers';
import pagination from '../pagination';
import privileges from '../privileges';

interface DataRequest extends Request {
    uid: string
    loggedIn: boolean
}

type SelectedCategoryData = {
    selectedCategory: CategoryObject,
    selectedCids: number[]
}

const relative_path: string = nconf.get('relative_path') as string;

async function canPostTopic(uid): Promise<boolean> {
    let cids: number[] = await categories.getAllCidsFromSet('categories:cid') as number[];
    cids = await privileges.categories.filterCids('topics:create', cids, uid) as number[];
    return cids.length > 0;
}

async function getData(req: DataRequest, url: string, sort) {
    const page = parseInt((req.query.page) as string, 10) || 1;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line
    let term = helpers.terms[req.query.term];
    const { cid, tags } = req.query;
    const filter = req.query.filter || '';

    if (!term && req.query.term) {
        return null;
    }

    term = term || 'alltime';

    const [settings, categoryData, rssToken, canPost, isPrivileged]:
    [SettingsObject, SelectedCategoryData, number, boolean, boolean] = await Promise.all([
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        user.getSettings(req.uid) as SettingsObject,
        helpers.getSelectedCategory(cid) as SelectedCategoryData,
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        user.auth.getFeedToken(req.uid) as number,
        canPostTopic(req.uid),
        user.isPrivileged(req.uid) as boolean,
    ]);

    const start = Math.max(0, (page - 1) * settings.topicsPerPage);
    const stop = start + settings.topicsPerPage - 1;

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line
    const data = await topics.getSortedTopics({
        cids: cid,
        tags: tags,
        uid: req.uid,
        start: start,
        stop: stop,
        filter: filter,
        term: term,
        sort: sort,
        floatPinned: req.query.pinned,
        query: req.query,
    });

    const isDisplayedAsHome = !(req.originalUrl.startsWith(`${relative_path}/api/${url}`) || req.originalUrl.startsWith(`${relative_path}/${url}`));
    const baseUrl = isDisplayedAsHome ? '' : url;

    if (isDisplayedAsHome) {
        data.title = meta.config.homePageTitle || '[[pages:home]]';
    } else {
        data.title = `[[pages:${url}]]`;
        data.breadcrumbs = helpers.buildBreadcrumbs([{ text: `[[${url}:title]]` }]);
    }

    data.canPost = canPost;
    data.showSelect = isPrivileged;
    data.showTopicTools = isPrivileged;
    data.allCategoriesUrl = baseUrl + helpers.buildQueryString(req.query, 'cid', '');
    data.selectedCategory = categoryData.selectedCategory;
    data.selectedCids = categoryData.selectedCids;
    data['feeds:disableRSS'] = meta.config['feeds:disableRSS'] || 0;
    data.rssFeedUrl = `${relative_path}/${url}.rss`;
    if (req.loggedIn) {
        data.rssFeedUrl += `?uid=${req.uid}&token=${rssToken}`;
    }

    data.filters = helpers.buildFilters(baseUrl, filter, req.query);
    data.selectedFilter = data.filters.find(filter => filter && filter.selected);
    data.terms = helpers.buildTerms(baseUrl, term, req.query);
    data.selectedTerm = data.terms.find(term => term && term.selected);

    const pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
    data.pagination = pagination.create(page, pageCount, req.query);
    helpers.addLinkTags({ url: url, res: req.res, tags: data.pagination.rel });
    return data;
}

export default async function get(req: DataRequest, res: Response, next: () => void) {
    const data = await getData(req, 'recent', 'recent');
    if (!data) {
        return next();
    }
    res.render('recent', data);
}
