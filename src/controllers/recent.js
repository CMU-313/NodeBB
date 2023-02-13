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
exports.get = exports.getData = exports.canPostTopic = void 0;
const nconf_1 = __importDefault(require("nconf"));
const user_1 = __importDefault(require("../user"));
const categories_1 = __importDefault(require("../categories"));
const topics_1 = __importDefault(require("../topics"));
const meta_1 = __importDefault(require("../meta"));
const helpers_1 = __importDefault(require("./helpers"));
const pagination_1 = __importDefault(require("../pagination"));
const privileges_1 = __importDefault(require("../privileges"));
const relative_path = nconf_1.default.get('relative_path');
function canPostTopic(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        let cids = yield categories_1.default.getAllCidsFromSet('categories:cid');
        cids = (yield privileges_1.default.categories.filterCids('topics:create', cids, uid));
        return cids.length > 0;
    });
}
exports.canPostTopic = canPostTopic;
// Promise<Data | null> causes test coverage to go down
function getData(req, url, sort) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt((req.query.page), 10) || 1;
        let term = helpers_1.default.terms[req.query.term];
        const { cid, tags } = req.query;
        const filter = req.query.filter || '';
        if (!term && req.query.term) {
            return null;
        }
        term = term || 'alltime';
        const [settings, categoryData, rssToken, canPost, isPrivileged] = yield Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            user_1.default.getSettings(req.uid),
            helpers_1.default.getSelectedCategory(cid),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            user_1.default.auth.getFeedToken(req.uid),
            canPostTopic(req.uid),
            user_1.default.isPrivileged(req.uid),
        ]);
        const start = Math.max(0, (page - 1) * settings.topicsPerPage);
        const stop = start + settings.topicsPerPage - 1;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const data = yield topics_1.default.getSortedTopics({
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
            data.title = meta_1.default.config.homePageTitle || '[[pages:home]]';
        }
        else {
            data.title = `[[pages:${url}]]`;
            data.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: `[[${url}:title]]` }]);
        }
        data.canPost = canPost;
        data.showSelect = isPrivileged;
        data.showTopicTools = isPrivileged;
        data.allCategoriesUrl = baseUrl + helpers_1.default.buildQueryString(req.query, 'cid', '');
        data.selectedCategory = categoryData.selectedCategory;
        data.selectedCids = categoryData.selectedCids;
        data['feeds:disableRSS'] = meta_1.default.config['feeds:disableRSS'] || 0;
        data.rssFeedUrl = `${relative_path}/${url}.rss`;
        if (req.loggedIn) {
            data.rssFeedUrl += `?uid=${req.uid}&token=${rssToken}`;
        }
        data.filters = helpers_1.default.buildFilters(baseUrl, filter, req.query);
        data.selectedFilter = data.filters.find(filter => filter && filter.selected);
        data.terms = helpers_1.default.buildTerms(baseUrl, term, req.query);
        data.selectedTerm = data.terms.find(term => term && term.selected);
        const pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
        data.pagination = pagination_1.default.create(page, pageCount, req.query);
        helpers_1.default.addLinkTags({ url: url, res: req.res, tags: data.pagination.rel });
        return data;
    });
}
exports.getData = getData;
function get(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield getData(req, 'recent', 'recent');
        if (!data) {
            return next();
        }
        res.render('recent', data);
    });
}
exports.get = get;
