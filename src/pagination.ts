import * as qs from 'querystring';
import * as _ from 'lodash';

export interface PaginationObject {
    pagination: Pagination;
}

export interface Pagination {
    prev: ActivePage;
    next: ActivePage;
    first: ActivePage;
    last: ActivePage;
    rel: Relation[];
    pages: Page[];
    currentPage: number;
    pageCount: number;
}

export interface ActivePage {
    page: number;
    active: boolean;
}

export interface Relation {
    rel: string;
    href: string;
}

export interface Page {
    page: number;
    active: boolean;
    qs: string;
}

interface Separator {
    separator: true;
}

export interface PaginationData {
    prev: ActivePage;
    next: ActivePage;
    first: ActivePage;
    last: ActivePage;
    rel: Relation[];
    pages: (Page | Separator)[];
    currentPage: number;
    pageCount: number;
}

type t = (currentPage: number, pageCount: number, queryObj: Record<string, string | number>) => PaginationData;

const pagination: {
    create: t;
} = exports as {create : t};


// const pagination: {
//     create: (currentPage: number, pageCount: number, queryObj: Record<string, string | number>) => PaginationData;
// } = exports;

pagination.create = function (currentPage, pageCount, queryObj) {
    if (pageCount <= 1) {
        return {
            prev: { page: 1, active: currentPage > 1 },
            next: { page: 1, active: currentPage < pageCount },
            first: { page: 1, active: currentPage === 1 },
            last: { page: 1, active: currentPage === pageCount },
            rel: [],
            pages: [],
            currentPage: 1,
            pageCount: 1,
        };
    }

    pageCount = parseInt(String(pageCount), 10);
    let pagesToShow: number[] = [1, 2, pageCount - 1, pageCount];

    currentPage = parseInt(String(currentPage), 10) || 1;
    const previous = Math.max(1, currentPage - 1);
    const next = Math.min(pageCount, currentPage + 1);

    let startPage = Math.max(1, currentPage - 2);
    if (startPage > pageCount - 5) {
        startPage -= 2 - (pageCount - currentPage);
    }

    let i: number;
    for (i = 0; i < 5; i += 1) {
        pagesToShow.push(startPage + i);
    }

    pagesToShow = _.uniq(pagesToShow).filter(page => page > 0 && page <= pageCount).sort((a, b) => a - b);

    queryObj = { ...(queryObj || {}) };
    delete queryObj._;

    const pages: (Page | Separator)[] = pagesToShow.map((page) => {
        queryObj.page = page;
        return { page, active: page === currentPage, qs: qs.stringify(queryObj) } as Page;
    });

    for (i = pages.length - 1; i > 0; i -= 1) {
        if ((pages[i] as Page).page - 2 === (pages[i - 1] as Page).page) {
            pages.splice(i, 0, {
                page: (pages[i] as Page).page - 1,
                active: false,
                qs: qs.stringify(queryObj),
            } as Page);
        } else if ((pages[i] as Page).page - 1 !== (pages[i - 1] as Page).page) {
            pages.splice(i, 0, { separator: true } as Separator);
        }
    }

    const data: PaginationData = {
        rel: [],
        pages,
        currentPage,
        pageCount,
        prev: {
            page: 0,
            active: false,
        },
        next: {
            page: 0,
            active: false,
        },
        first: {
            page: 0,
            active: false,
        },
        last: {
            page: 0,
            active: false,
        },
    };
    queryObj.page = previous;
    data.prev = { page: previous, active: currentPage > 1 };
    queryObj.page = next;
    data.next = { page: next, active: currentPage < pageCount };

    queryObj.page = 1;
    data.first = { page: 1, active: currentPage === 1 };
    queryObj.page = pageCount;
    data.last = { page: pageCount, active: currentPage === pageCount };

    if (currentPage < pageCount) {
        data.rel.push({
            rel: 'next',
            href: `?${qs.stringify({ ...queryObj, page: next })}`,
        });
    }

    if (currentPage > 1) {
        data.rel.push({
            rel: 'prev',
            href: `?${qs.stringify({ ...queryObj, page: previous })}`,
        });
    }

    return data;
};
