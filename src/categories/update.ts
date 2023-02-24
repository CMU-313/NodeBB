import db from '../database';
import meta from '../meta';
import utils from '../utils';
import slugify from '../slugify';
import translator from '../translator';
import plugins from '../plugins';
import cache from '../cache';

type ModifiedField = {
    hadOwnProperty: boolean,
    name: string,
    slug: string
}

type GetCidsType = (cid: string) => Promise<string[]>;
type GetFieldsType = (cid: string, fields: string[]) => Promise<{[key:string]: string}>;
type GetFieldType = (cid: string, field: string) => Promise<string>;
type ExistType = (cid: string) => Promise<boolean>;
type updateType = (modified: {[cid: string]:ModifiedField}) => Promise<string[]>;
type ParseType = (cid: string, description: string) => Promise<void>;
type SetFieldType = (cid: string, value: string, parsed: string) => Promise<void>;

type CategoryType = {
    getChildrenCids: GetCidsType,
    getCategoryFields: GetFieldsType,
    getCategoryField: GetFieldType,
    exists: ExistType,
    update: updateType,
    parseDescription: ParseType,
    setCategoryField: SetFieldType
}

export = function (Categories: CategoryType) {
    async function updateParent(cid: string, newParent: string) {
        const parent: number = parseInt(newParent, 10) || 0;
        if (parseInt(cid, 10) === parent) {
            throw new Error('[[error:cant-set-self-as-parent]]');
        }
        const childrenCids: string[] = await Categories.getChildrenCids(cid);
        if (childrenCids.includes(newParent)) {
            throw new Error('[[error:cant-set-child-as-parent]]');
        }
        const categoryData: {[key: string]: string} = await Categories.getCategoryFields(cid, ['parentCid', 'order']) as {[key: string]: string};
        const oldParent: string = categoryData.parentCid;
        if (oldParent === newParent) {
            return;
        }
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetRemove(`cid:${oldParent}:children`, cid) as void,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.sortedSetAdd(`cid:${newParent}:children`, categoryData.order, cid) as void,
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            db.setObjectField(`category:${cid}`, 'parentCid', newParent) as void,
        ]);

        cache.del([
            `cid:${oldParent}:children`,
            `cid:${newParent}:children`,
            `cid:${oldParent}:children:all`,
            `cid:${newParent}:children:all`,
        ]);
    }

    async function updateTagWhitelist(cid: string, tags: string): Promise<void> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const newTags: string[] = tags.split(',').map(tag => (utils.cleanUpTag(tag, meta.config.maximumTagLength) as string)).filter(Boolean);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.delete(`cid:${cid}:tag:whitelist`) as void;
        const scores: number[] = newTags.map((tag, index) => index);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(`cid:${cid}:tag:whitelist`, scores, newTags);
        cache.del(`cid:${cid}:tag:whitelist`);
    }

    async function updateName(cid: string, newName: string): Promise<void> {
        const oldName: string = await Categories.getCategoryField(cid, 'name');
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetRemove('categories:name', `${oldName.slice(0, 200).toLowerCase()}:${cid}`) as void;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd('categories:name', 0, `${newName.slice(0, 200).toLowerCase()}:${cid}`) as void;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObjectField(`category:${cid}`, 'name', newName) as void;
    }

    async function updateOrder(cid: string, order: string): Promise<void> {
        const parentCid: string = await Categories.getCategoryField(cid, 'parentCid');
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetsAdd('categories:cid', order, cid) as void;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const childrenCids: string[] = await db.getSortedSetRange(
            `cid:${parentCid}:children`, 0, -1
        ) as string[];

        const currentIndex: number = childrenCids.indexOf(cid);
        if (currentIndex === -1) {
            throw new Error('[[error:no-category]]');
        }
        // moves cid to index order - 1 in the array
        if (childrenCids.length > 1) {
            childrenCids.splice(Math.max(0, Number(order) - 1), 0, childrenCids.splice(currentIndex, 1)[0]);
        }

        // recalculate orders from array indices
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.sortedSetAdd(
            `cid:${parentCid}:children`,
            childrenCids.map((cid, index) => index + 1),
            childrenCids
        ) as void;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObjectBulk(
            childrenCids.map((cid, index) => [`category:${cid}`, { order: index + 1 }])
        ) as void;

        cache.del([
            'categories:cid',
            `cid:${parentCid}:children`,
            `cid:${parentCid}:children:all`,
        ]);
    }

    async function updateCategoryField(cid: string, key: string, value: string) {
        if (key === 'parentCid') {
            return await updateParent(cid, value);
        } else if (key === 'tagWhitelist') {
            return await updateTagWhitelist(cid, value);
        } else if (key === 'name') {
            return await updateName(cid, value);
        } else if (key === 'order') {
            return await updateOrder(cid, value);
        }

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await db.setObjectField(`category:${cid}`, key, value);
        if (key === 'description') {
            await Categories.parseDescription(cid, value);
        }
    }

    async function updateCategory(cid: string, modifiedFields: ModifiedField) {
        const exists: boolean = await Categories.exists(cid);
        if (!exists) {
            return;
        }

        if (modifiedFields.hasOwnProperty('name')) {
            const translated: string|void|number = await translator.translate(modifiedFields.name);
            modifiedFields.slug = `${cid}/${slugify(translated) as string}`;
        }
        const result: {cid: string, category: {[key: string]: string}} = await plugins.hooks.fire('filter:category.update', { cid: cid, category: modifiedFields }) as {cid: string, category: {[key: string]: string}};

        const { category } = result;
        const fields: string[] = Object.keys(category);
        // move parent to front, so its updated first
        const parentCidIndex: number = fields.indexOf('parentCid');
        if (parentCidIndex !== -1 && fields.length > 1) {
            fields.splice(0, 0, fields.splice(parentCidIndex, 1)[0]);
        }

        for await (const key of fields) {
            // eslint-disable-next-line no-await-in-loop
            await updateCategoryField(cid, key, category[key]);
        }
        plugins.hooks.fire('action:category.update', { cid: cid, modified: category }) as void;
    }

    Categories.parseDescription = async function (cid: string, description: string) {
        const parsedDescription: string = await plugins.hooks.fire('filter:parse.raw', description) as string;
        await Categories.setCategoryField(cid, 'descriptionParsed', parsedDescription);
    };
    Categories.update = async function (modified: {[cid: string]:ModifiedField}) {
        const cids: string[] = Object.keys(modified);
        await Promise.all(cids.map(cid => updateCategory(cid, modified[cid])));
        return cids;
    };
}
