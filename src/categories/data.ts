'use strict';


import validator from 'validator';
import db from '../database';
import meta from '../meta';
import plugins from '../plugins';
import utils from '../utils';



const intFields: string[] = [
    'cid', 'parentCid', 'disabled', 'isSection', 'order',
    'topic_count', 'post_count', 'numRecentReplies',
    'minTags', 'maxTags', 'postQueue', 'subCategoriesPerPage',
];

type resultsData = {
    categories: Category[];

}


type Category = {
    cid: string;
    field: string;

    icon: string;
    totalPostCount: number;
    post_count: number;
    totalTopicCount: number;
    topic_count: number;
    description: string[];
    descriptionParsed: string[];
}


interface Categories{
    getCategoriesFields: (cids: string[], fields: string[]) => Promise<Category[]>;
    getCategoryData: (cid: string)=> Promise<Category>;
    getCategoriesData: (cids: string[]) => Promise<Category[]>;
    getCategoryField: (cid: string, field: string) => Promise<any>;
    getCategoryFields: (cid: string, fields: string[]) => Promise<Category>;
    getAllCategoryFields: (fields: string[]) => Promise<Category[]>;
    //getAllCidsFromSet: ('categories:cid') => cid;
    setCategoryField: (cid: string, field: string, value: number) => Promise<void>;
    incrementCategoryFieldBy: (cid: string, field: string, value: number) => Promise<void>;
}

//module.exports = (Categories: Categories) {
    //Categories.getCategoriesFields = async function (cids, fields) */
    
export default (Categories: Categories) =>{  
    Categories.getCategoriesFields =  async function (cids: string[], fields: string[]){
        if (!Array.isArray(cids) || !cids.length) {
            return [];
        }

        const keys: string[] = cids.map(cid => `category:${cid}`);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const categories: Category[] = await db.getObjects(keys, fields);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const result: resultsData = await plugins.hooks.fire('filter:category.getFields', {
            cids: cids,
            categories: categories,
            fields: fields,
            keys: keys,
        });
        result.categories.forEach(category => modifyCategory(category, fields));
        return result.categories;
    };

    Categories.getCategoryData =  async function (cid: string) {
        const categories: Category[] = await Categories.getCategoriesFields([cid], []);
        return categories && categories.length ? categories[0] : null;
    };

    Categories.getCategoriesData = async function (cids: string[]) {
        return await Categories.getCategoriesFields(cids, []);
    };

    Categories.getCategoryField= async function(cid: string, field: string) {
        const category: Category = await Categories.getCategoryFields(cid, [field]);
        return category ? category[field] : null;
    };

    Categories.getCategoryFields= async function(cid: string, fields: string[]) {
        const categories: Category[] = await Categories.getCategoriesFields([cid], fields);
        return categories ? categories[0] : null;
    };

    Categories.getAllCategoryFields= async function(fields: string[]) {
        const cids:string[] = await Categories.getAllCidsFromSet('categories:cid');
        return await Categories.getCategoriesFields(cids, fields);
    };

    Categories.setCategoryField = async function(cid: string, field: string, value: number) {
        // The next line calls a function in a module that has not been updated to TS yet
        //eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObjectField(`category:${cid}`, field, value);
    };

    Categories.incrementCategoryFieldBy= async function(cid: string, field: string, value: number) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.incrObjectFieldBy(`category:${cid}`, field, value);
    };
};

function defaultIntField(category: Category, fields: string[], fieldName: string, defaultField: string) {
    if (!fields.length || fields.includes(fieldName)) {
        const useDefault:boolean = !category.hasOwnProperty(fieldName) ||
            category[fieldName] === null ||
            category[fieldName] === '' ||

            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            !utils.isNumber(category[fieldName]);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        category[fieldName] = useDefault ? meta.config[defaultField] : category[fieldName];
    }
}

function modifyCategory(category: Category, fields: string[]) {
    if (!category) {
        return;
    }

    defaultIntField(category, fields, 'minTags', 'minimumTagsPerTopic');
    defaultIntField(category, fields, 'maxTags', 'maximumTagsPerTopic');
    defaultIntField(category, fields, 'postQueue', 'postQueue');

    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    db.parseIntFields(category, intFields, fields);

    const escapeFields: string[] = ['name', 'color', 'bgColor', 'backgroundImage', 'imageClass', 'class', 'link'];
    escapeFields.forEach((field) => {
        if (category.hasOwnProperty(field)) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            category[field] = validator.escape(String(category[field] || ''));
        }
    });

    if (category.hasOwnProperty('icon')) {
        category.icon = category.icon || 'hidden';
    }

    if (category.hasOwnProperty('post_count')) {
        category.totalPostCount = category.post_count;
    }

    if (category.hasOwnProperty('topic_count')) {
        category.totalTopicCount = category.topic_count;
    }

    if (category.description) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        category.description = validator.escape(String(category.description));
        category.descriptionParsed = category.descriptionParsed || category.description;
    }
}
