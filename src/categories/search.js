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
const lodash_1 = __importDefault(require("lodash"));
const privileges_1 = __importDefault(require("../privileges"));
const plugins_1 = __importDefault(require("../plugins"));
const database_1 = __importDefault(require("../database"));
const Categories = {
    search: function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = data.query || '';
            const page = data.page || 1;
            const uid = data.uid || 0;
            const paginate = data.hasOwnProperty('paginate') ? data.paginate : true;
            const startTime = process.hrtime();
            let cids = yield Categories.findCids(query, data.hardCap);
            const result = yield plugins_1.default.hooks.fire('filter:categories.search', {
                data: data,
                cids: cids,
                uid: uid,
            });
            cids = yield privileges_1.default.categories.filterCids('find', result.cid, uid);
            const searchResult = {
                matchCount: cids.length,
            };
            if (paginate) {
                const resultsPerPage = data.resultsPerPage || 50;
                const start = Math.max(0, page - 1) * resultsPerPage;
                const stop = start + resultsPerPage;
                searchResult.pageCount = Math.ceil(cids.length / resultsPerPage);
                cids = cids.slice(start, stop);
            }
            const childrenCids = yield Categories.getChildrenCids(cids, uid);
            const uniqCids = lodash_1.default.uniq(cids.concat(childrenCids));
            const categoryData = yield Categories.getCategories(uniqCids, uid);
            categoryData.forEach((category) => {
                if (category && Array.isArray(category.children)) {
                    category.children = category.children.slice(0, category.subCategoriesPerPage);
                    category.children.forEach((child) => {
                        child.children = undefined;
                    });
                }
            });
            categoryData.sort((c1, c2) => {
                if (c1.parentCid !== c2.parentCid) {
                    return c1.parentCid - c2.parentCid;
                }
                return c1.order - c2.order;
            });
            const elapsedHrTime = process.hrtime(startTime);
            const elapsedTimeInMilliseconds = ((elapsedHrTime[0] * 1000) + elapsedHrTime[1]) / 1e6;
            searchResult.timing = (elapsedTimeInMilliseconds / 1000).toFixed(2);
            searchResult.categories = categoryData.filter(c => cids.includes(c.cid));
            return searchResult;
        });
    },
    findCids: function (query, hardCap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!query || String(query).length < 2) {
                return [];
            }
            const data = yield database_1.default.getSortedSetScan({
                key: 'categories:name',
                match: `*${String(query).toLowerCase()}*`,
                limit: hardCap || 500,
            });
            return data.map(data => parseInt(data.split(':').pop(), 10));
        });
    },
    getChildrenCids: function (cids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const childrenCids = lodash_1.default.flatten(yield Promise.all(cids.map(cid => Categories.getChildrenCids(cids, uid))));
            return yield privileges_1.default.categories.filterCids('find', childrenCids, uid);
        });
    },
    getCategories: function (uniqCids, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const uniqueCids = yield Promise.all(uniqCids.map(uniqCid => Categories.getCategories(uniqCids, uid)));
            return yield privileges_1.default.categories.filterCids('find', lodash_1.default.flatten(uniqueCids), uid);
        });
    },
};
exports.default = Categories;
