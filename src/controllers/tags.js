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
Object.defineProperty(exports, "__esModule", { value: true });
const validator = require("validator");
const nconf = require("nconf");
const meta = require("../meta");
const user = require("../user");
const categories = require("../categories");
const topics = require("../topics");
const privileges = require("../privileges");
const pagination = require("../pagination");
const utils = require("../utils");
const helpers = require("./helpers");
const tagsController = {
    getTag: function (req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const tag = validator.escape(utils.cleanUpTag(req.params.tag, meta.config.maximumTagLength));
            const page = parseInt(req.query.page, 10) || 1;
            const cid = Array.isArray(req.query.cid) || !req.query.cid ? req.query.cid : [req.query.cid];
            const templateData = {
                topics: [],
                tag: tag,
                breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]', url: '/tags' }, { text: tag }]),
                title: `[[pages:tag, ${tag}]]`,
            };
            const [settings, cids, categoryData, isPrivileged] = yield Promise.all([
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                user.getSettings(req.uid),
                cid || categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read'),
                helpers.getSelectedCategory(cid),
                user.isPrivileged(req.uid),
            ]);
            const start = Math.max(0, (page - 1) * settings.topicsPerPage);
            const stop = start + settings.topicsPerPage - 1;
            const [topicCount, tids] = yield Promise.all([
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                topics.getTagTopicCount(tag, cids),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                topics.getTagTidsByCids(tag, cids, start, stop),
            ]);
            templateData.topics = (yield topics.getTopics(tids, req.uid));
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
            templateData['feeds:disableRSS'] = meta.config['feeds:disableRSS'];
            templateData.rssFeedUrl = `${nconf.get('relative_path')}/tags/${tag}.rss`;
            res.render('tag', templateData);
        });
    },
    getTags: function (req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const cids = yield categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read');
            const [canSearch, tags] = yield Promise.all([
                privileges.global.can('search:tags', req.uid),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                topics.getCategoryTagsData(cids, 0, 99),
            ]);
            res.render('tags', {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                tags: tags.filter(Boolean),
                displayTagSearch: canSearch,
                nextStart: 100,
                breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]' }]),
                title: '[[pages:tags]]',
            });
        });
    },
};
module.exports = tagsController;
