import nconf from 'nconf';
import _ from 'lodash';
import categories from '../categories';
import meta from '../meta';
import pagination from '../pagination';
import helpers from './helpers';
import privileges from '../privileges';


export default async function categoriesController(req, res) {
    res.locals.metaTags = [{
        name: 'title',
        content: String(meta.config.title || 'NodeBB'),
    }, {
        property: 'og:type',
        content: 'website',
    }];

    const allRootCids = await categories.getAllCidsFromSet('cid:0:children');
    const rootCids = await privileges.categories.filterCids('find', allRootCids, req.uid);
    const pageCount:number = Math.max(1, Math.ceil(rootCids.length as number / meta.config.categoriesPerPage as number));
    const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount) ;
    const start= Math.max(0, (page - 1) * meta.config.categoriesPerPage);
    const stop: number = start + meta.config.categoriesPerPage - 1 as number;
    const pageCids = rootCids.slice(start, stop + 1);

    const allChildCids = _.flatten(await Promise.all(pageCids.map(categories.getChildrenCids)));
    const childCids = await privileges.categories.filterCids('find', allChildCids, req.uid);
    const categoryData = await categories.getCategories(pageCids.concat(childCids), req.uid);
    const tree = categories.getTree(categoryData, 0);
    await categories.getRecentTopicReplies(categoryData, req.uid, req.query);

    const data = {
        title: meta.config.homePageTitle || '[[pages:home]]',
        selectCategoryLabel: '[[pages:categories]]',
        categories: tree,
        pagination: pagination.create(page, pageCount, req.query),
        breadcrumbs:'[{ text: data.title }]'
    };

    data.categories.forEach((category:any) => {
        if (category) {
            helpers.trimChildren(category);
            helpers.setCategoryTeaser(category);
        }
    });

    if (req.originalUrl.startsWith(`${nconf.get('relative_path')}/api/categories`) || req.originalUrl.startsWith(`${nconf.get('relative_path')}/categories`)) {
        data.title = '[[pages:categories]]';
        data.breadcrumbs = helpers.buildBreadcrumbs([{ text: data.title }]);
        res.locals.metaTags.push({
            property: 'og:title',
            content: '[[pages:categories]]',
        });
    }

    res.render('categories', data);
};
