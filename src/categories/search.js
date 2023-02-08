"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const lodash_1 = __importDefault(require("lodash"));
const privileges_1 = __importDefault(require("../privileges"));
const plugins_1 = __importDefault(require("../plugins"));
const database_1 = __importDefault(require("../database"));
async function findCids(query, hardCap) {
    if (!query || String(query).length < 2) {
        return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const data = await database_1.default.getSortedSetScan({
        key: 'categories:name',
        match: `*${String(query).toLowerCase()}*`,
        limit: hardCap || 500,
    });
    return data.map(data => parseInt(data.split(':').pop(), 10));
}
module.exports = function search(Categories) {
    async function getChildrenCids(cids, uid) {
        const childrenCids = await Promise.all(cids.map(cid => Categories.getChildrenCids(cid)));
        return await privileges_1.default.categories.filterCids('find', lodash_1.default.flatten(childrenCids), uid);
    }
    Categories.search = async function (data) {
        const query = data.query || '';
        const page = data.page || 1;
        const uid = data.uid || 0;
        const paginate = data.hasOwnProperty('paginate') ? data.paginate : true;
        const startTime = process.hrtime();
        let cids = await findCids(query, data.hardCap);
        const result = (await plugins_1.default.hooks.fire('filter:categories.search', {
            data: data,
            cids: cids,
            uid: uid,
        }));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        cids = await privileges_1.default.categories.filterCids('find', result.cids, uid);
        const searchResult = {
            matchCount: cids.length,
            pageCount: 0,
            timing: '0',
            categories: [],
        };
        if (paginate) {
            const resultsPerPage = data.resultsPerPage || 50;
            const start = Math.max(0, page - 1) * resultsPerPage;
            const stop = start + resultsPerPage;
            searchResult.pageCount = Math.ceil(cids.length / resultsPerPage);
            cids = cids.slice(start, stop);
        }
        const childrenCids = await getChildrenCids(cids, uid);
        const uniqCids = lodash_1.default.uniq(cids.concat(childrenCids));
        const categoryData = Categories.getCategories(uniqCids, uid);
        Categories.getTree(categoryData, 0);
        Categories.getRecentTopicReplies(categoryData, uid, data.qs);
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
        searchResult.timing = (((startTime[0] * 1e3) + (startTime[1] / 1e6)) / 1000).toFixed(2);
        searchResult.categories = categoryData.filter(c => cids.includes((c.cid)));
        return searchResult;
    };
};
