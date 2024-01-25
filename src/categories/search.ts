import _ from 'lodash';

import privileges from '../privileges';
import plugins from '../plugins';
import db from '../database';
import { CategoryObject } from '../types';
import { Category } from '.';


interface SearchResult {
    matchCount: number;
    pageCount?: number;
    timing?: string;
    categories?: CategoryObject;
}

interface SearchData {
    query?: string;
    page?: number;
    uid?: number;
    paginate?: boolean;
    hardCap?: number;
    resultsPerPage?: number;
}

const Categories: {
    search: (data: SearchData) => Promise<SearchResult>;
    findCids: (query: string, hardCap: number) => Promise<number[]>;
    getChildrenCids: (cids: number[], uid: number) => Promise<number[]>;
    getCategories: (uniqCids: number[], uid: number) => Promise<Category>;
} = {
    search: async function (data: SearchData): Promise<SearchResult> {
        const query = data.query || '';
        const page = data.page || 1;
        const uid = data.uid || 0;
        const paginate = data.hasOwnProperty('paginate') ? data.paginate : true;

        const startTime = process.hrtime();

        let cids = await Categories.findCids(query, data.hardCap);

        const result : CategoryObject = await plugins.hooks.fire('filter:categories.search', {
            data: data,
            cids: cids,
            uid: uid,
        });
        cids = await privileges.categories.filterCids('find', result.cid, uid);

        const searchResult: SearchResult = {
            matchCount: cids.length,
        };

        if (paginate) {
            const resultsPerPage = data.resultsPerPage || 50;
            const start = Math.max(0, page - 1) * resultsPerPage;
            const stop = start + resultsPerPage;
            searchResult.pageCount = Math.ceil(cids.length / resultsPerPage);
            cids = cids.slice(start, stop);
        }

        const childrenCids = await Categories.getChildrenCids(cids, uid);
        const uniqCids = _.uniq(cids.concat(childrenCids));
        const categoryData : Category = await Categories.getCategories(uniqCids, uid);

        categoryData.forEach((category : Category) => {
            if (category && Array.isArray(category.children)) {
                category.children = category.children.slice(0, category.subCategoriesPerPage);
                category.children.forEach((child : Category) => {
                    child.children = undefined;
                });
            }
        });

        categoryData.sort((c1: CategoryObject, c2: CategoryObject) => {
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
    },

    findCids: async function (query: string, hardCap: number): Promise<number[]> {
        if (!query || String(query).length < 2) {
            return [];
        }

        const data: string[] = await db.getSortedSetScan({
            key: 'categories:name',
            match: `*${String(query).toLowerCase()}*`,
            limit: hardCap || 500,
        });
        return data.map(data => parseInt(data.split(':').pop(), 10));
    },

    getChildrenCids: async function (cids: number[], uid: number): Promise<number[]> {
        const childrenCids: number[] =
            _.flatten(await Promise.all(cids.map(cid => Categories.getChildrenCids(cids, uid))));
        return await privileges.categories.filterCids('find', childrenCids, uid);
    },

    getCategories: async function (uniqCids: number[], uid: number) {
        const uniqueCids:number[] = await Promise.all(uniqCids.map(uniqCid => Categories.getCategories(uniqCids, uid)));
        return await privileges.categories.filterCids('find', _.flatten(uniqueCids), uid);
    },
};

export default Categories;
