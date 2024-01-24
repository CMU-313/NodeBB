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
exports.unreadTotal = exports.get = void 0;
const nconf_1 = __importDefault(require("nconf"));
const querystring_1 = __importDefault(require("querystring"));
const meta_1 = __importDefault(require("../meta"));
const pagination_1 = __importDefault(require("../pagination"));
const user_1 = __importDefault(require("../user"));
const topics_1 = __importDefault(require("../topics"));
const helpers_1 = __importDefault(require("./helpers"));
// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
const relative_path = nconf_1.default.get('relative_path');
function get(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { cid } = req.query;
        const filter = req.query.filter || '';
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
        const [categoryData, userSettings, isPrivileged] = yield Promise.all([
            helpers_1.default.getSelectedCategory(cid),
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-call
            user_1.default.getSettings(req.uid),
            user_1.default.isPrivileged(req.uid),
        ]);
        const page = parseInt(req.query.page, 10) || 1;
        const start = Math.max(0, (page - 1) * userSettings.topicsPerPage);
        const stop = start + userSettings.topicsPerPage - 1;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const data = yield topics_1.default.getUnreadTopics({
            cid: cid,
            uid: req.uid,
            start: start,
            stop: stop,
            filter: filter,
            query: req.query,
        });
        const isDisplayedAsHome = !(req.originalUrl.startsWith(`${relative_path}/api/unread`) || req.originalUrl.startsWith(`${relative_path}/unread`));
        const baseUrl = isDisplayedAsHome ? '' : 'unread';
        if (isDisplayedAsHome) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            data.title = meta_1.default.config.homePageTitle || '[[pages:home]]';
        }
        else {
            data.title = '[[pages:unread]]';
            data.breadcrumbs = helpers_1.default.buildBreadcrumbs([{ text: '[[unread:title]]' }]);
        }
        data.pageCount = Math.max(1, Math.ceil(data.topicCount / userSettings.topicsPerPage));
        data.pagination = pagination_1.default.create(page, data.pageCount, req.query);
        helpers_1.default.addLinkTags({ url: 'unread', res: req.res, tags: data.pagination.rel });
        if (userSettings.usePagination && (page < 1 || page > data.pageCount)) {
            req.query.page = (Math.max(1, Math.min(data.pageCount, page)).toString());
            return helpers_1.default.redirect(res, `/unread?${querystring_1.default.stringify(req.query)}`);
        }
        data.showSelect = true;
        data.showTopicTools = isPrivileged;
        data.allCategoriesUrl = `${baseUrl}${helpers_1.default.buildQueryString(req.query, 'cid', '')}`;
        data.selectedCategory = categoryData.selectedCategory;
        data.selectedCids = categoryData.selectedCids;
        data.selectCategoryLabel = '[[unread:mark_as_read]]';
        data.selectCategoryIcon = 'fa-inbox';
        data.showCategorySelectLabel = true;
        data.filters = helpers_1.default.buildFilters(baseUrl, filter, req.query);
        data.selectedFilter = data.filters.find(filter => filter && filter.selected);
        res.render('unread', data);
    });
}
exports.get = get;
function unreadTotal(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const filter = req.query.filter || '';
        try {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            const unreadCount = yield topics_1.default.getTotalUnread(req.uid, filter);
            res.json(unreadCount);
        }
        catch (err) {
            next(err);
        }
    });
}
exports.unreadTotal = unreadTotal;
