import _ from 'lodash';

import privileges from '../privileges';
import plugins from '../plugins';
import db from '../database';
import { CategoryObject } from '../types';

type data = {
    type: string,
    query: string,
    page: number,
    uid: number,
    paginate: boolean,
    hardCap: string, // i think hardcap is supposed to be int but how do i make [] of multiple types
    resultsPerPage: number,
    qs: string
}

type child = {
    type: string,
    children: string[]
}

type result = {
    cids: number[]
}

interface category extends CategoryObject{
    getChildrenCids: (cid: number) => number[],
    search: (data: data) => object,
    getCategories: (cids: ConcatArray<number>, uid: number) => category[],
    getTree: (categories: category[], parentCid:number) => category[],
    getRecentTopicReplies: (categoryData:category[], uid:number, query:string) => [],
    filterCids: (privilege:string, cids: number, uid:number)=> [],
    children: child[],
}

async function findCids(query:string, hardCap:string): Promise<number[]> {
    if (!query || String(query).length < 2) {
        return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const data:(string)[] = await db.getSortedSetScan({
        key: 'categories:name',
        match: `*${String(query).toLowerCase()}*`,
        limit: hardCap || 500,
    }) as [];
    return data.map(data => parseInt(data.split(':').pop(), 10));
}

export = function search(Categories: category) {
    async function getChildrenCids(cids:number[], uid:number) : Promise<number[]> {
        const childrenCids: number[][] = await Promise.all(cids.map(cid => Categories.getChildrenCids(cid)));
        return await privileges.categories.filterCids('find', _.flatten(childrenCids), uid) as [];
    }

    Categories.search = async function (data: data) {
        const query: string = data.query || '';
        const page: number = data.page || 1;
        const uid: number = data.uid || 0;
        const paginate: boolean = data.hasOwnProperty('paginate') ? data.paginate : true;

        const startTime = process.hrtime();

        let cids:number[] = await findCids(query, data.hardCap);

        const result: result = (await plugins.hooks.fire('filter:categories.search', {
            data: data,
            cids: cids,
            uid: uid,
        })) as result;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        cids = await privileges.categories.filterCids('find', result.cids, uid) as [];

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

        const childrenCids: number[] = await getChildrenCids(cids, uid);
        const uniqCids: ConcatArray<number> = _.uniq(cids.concat(childrenCids));
        const categoryData = Categories.getCategories(uniqCids, uid);

        Categories.getTree(categoryData, 0);
        Categories.getRecentTopicReplies(categoryData, uid, data.qs);
        categoryData.forEach((category: category) => {
            if (category && Array.isArray(category.children)) {
                category.children = category.children.slice(0, category.subCategoriesPerPage);
                category.children.forEach((child) => {
                    child.children = undefined;
                });
            }
        });

        categoryData.sort((c1: category, c2: category) => {
            if (c1.parentCid !== c2.parentCid) {
                return c1.parentCid - c2.parentCid;
            }
            return c1.order - c2.order;
        });

        searchResult.timing = (((startTime[0] * 1e3) + (startTime[1] / 1e6)) / 1000).toFixed(2);
        searchResult.categories = categoryData.filter(c => cids.includes((c.cid)));
        return searchResult;
    };
}
