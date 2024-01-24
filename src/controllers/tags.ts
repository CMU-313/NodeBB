import validator = require('validator');
import nconf = require('nconf');

import meta = require('../meta');
import user = require('../user');
import categories = require('../categories');
import topics = require('../topics');
import privileges = require('../privileges');
import pagination = require('../pagination');
import utils = require('../utils');
import helpers = require('./helpers');

interface TagsController {
    getTag: (req: Request, res: Response) => Promise<void>;
    getTags: (req: Request, res: Response) => Promise<void>;
}

type Request = {
    params: {
        tag: string;
    }
    query: {
        page?: string;
        cid?: string | string[];
    };
    uid: number;
    res: Response;
}

type Response = {
    render: (view: string, data: object) => void;
    locals: {
        metaTags: Array<{ name?: string; content: string; property?: string;}>;
    };
}

type TemplateData = {
    topics: string[];
    tag: string;
    breadcrumbs: { text: string; url?: string }[];
    title: string;
    showSelect?: boolean;
    showTopicTools?: boolean;
    allCategoriesUrl?: string;
    selectedCategory?: string;
    selectedCids?: number[];
    pagination?: PaginationData;
    'feeds:disableRSS'?: boolean;
    rssFeedUrl?: string;
}

interface PaginationData {
    currentPage: number;
    pageCount: number;
    rel?: string[];
}

type PromiseResult = [
    {topicsPerPage: number},
    string[],
    {selectedCategory: string; selectedCids: number[]},
    boolean
]

type PromiseResultTopic = [
    number,
    number[]
]

type PromiseResultMultTags = [
    boolean,
    string[]
]

const tagsController: TagsController = {
    getTag: async function (req: Request, res: Response) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tag = validator.escape(utils.cleanUpTag(req.params.tag, meta.config.maximumTagLength) as string);
        const page = parseInt(req.query.page, 10) || 1;
        const cid = Array.isArray(req.query.cid) || !req.query.cid ? req.query.cid : [req.query.cid];

        const templateData: TemplateData = {
            topics: [],
            tag: tag,
            breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]', url: '/tags' }, { text: tag }]),
            title: `[[pages:tag, ${tag}]]`,
        };
        const [settings, cids, categoryData, isPrivileged] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            user.getSettings(req.uid),
            cid || categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read'),
            helpers.getSelectedCategory(cid),
            user.isPrivileged(req.uid),
        ]) as PromiseResult;
        const start = Math.max(0, (page - 1) * settings.topicsPerPage);
        const stop = start + settings.topicsPerPage - 1;

        const [topicCount, tids] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            topics.getTagTopicCount(tag, cids),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            topics.getTagTidsByCids(tag, cids, start, stop),
        ]) as PromiseResultTopic;

        templateData.topics = await topics.getTopics(tids, req.uid) as string[];
        templateData.showSelect = isPrivileged;
        templateData.showTopicTools = isPrivileged;
        templateData.allCategoriesUrl = `tags/${tag}${helpers.buildQueryString(req.query, 'cid', '')}`;
        templateData.selectedCategory = categoryData.selectedCategory;
        templateData.selectedCids = categoryData.selectedCids;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        topics.calculateTopicIndices(templateData.topics, start);
        res.locals.metaTags = [
            {
                name: 'title',
                content: tag,
            },
            {
                property: 'og:title',
                content: tag,
            },
        ];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const pageCount = Math.max(1, Math.ceil(topicCount / settings.topicsPerPage));
        templateData.pagination = pagination.create(page, pageCount, req.query);
        helpers.addLinkTags({ url: `tags/${tag}`, res: req.res, tags: templateData.pagination.rel });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        templateData['feeds:disableRSS'] = meta.config['feeds:disableRSS'] as boolean;
        templateData.rssFeedUrl = `${nconf.get('relative_path') as string}/tags/${tag}.rss`;
        res.render('tag', templateData);
    },

    getTags: async function (req: Request, res: Response) {
        const cids: string[] = await categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read') as string[];
        const [canSearch, tags] = await Promise.all([
            privileges.global.can('search:tags', req.uid),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            topics.getCategoryTagsData(cids, 0, 99),
        ]) as PromiseResultMultTags;

        res.render('tags', {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            tags: tags.filter(Boolean),
            displayTagSearch: canSearch,
            nextStart: 100,
            breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]' }]),
            title: '[[pages:tags]]',
        });
    },
};

module.exports = tagsController;
