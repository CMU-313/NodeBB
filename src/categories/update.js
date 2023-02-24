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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const utils_1 = __importDefault(require("../utils"));
const slugify_1 = __importDefault(require("../slugify"));
const translator_1 = __importDefault(require("../translator"));
const plugins_1 = __importDefault(require("../plugins"));
const cache_1 = __importDefault(require("../cache"));
module.exports = function (Categories) {
    function updateParent(cid, newParent) {
        return __awaiter(this, void 0, void 0, function* () {
            const parent = parseInt(newParent, 10) || 0;
            if (parseInt(cid, 10) === parent) {
                throw new Error('[[error:cant-set-self-as-parent]]');
            }
            const childrenCids = yield Categories.getChildrenCids(cid);
            if (childrenCids.includes(newParent)) {
                throw new Error('[[error:cant-set-child-as-parent]]');
            }
            const categoryData = yield Categories.getCategoryFields(cid, ['parentCid', 'order']);
            const oldParent = categoryData.parentCid;
            if (oldParent === newParent) {
                return;
            }
            yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.sortedSetRemove(`cid:${oldParent}:children`, cid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.sortedSetAdd(`cid:${newParent}:children`, categoryData.order, cid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.setObjectField(`category:${cid}`, 'parentCid', newParent),
            ]);
            cache_1.default.del([
                `cid:${oldParent}:children`,
                `cid:${newParent}:children`,
                `cid:${oldParent}:children:all`,
                `cid:${newParent}:children:all`,
            ]);
        });
    }
    function updateTagWhitelist(cid, tags) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const newTags = tags.split(',').map(tag => utils_1.default.cleanUpTag(tag, meta_1.default.config.maximumTagLength)).filter(Boolean);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.delete(`cid:${cid}:tag:whitelist`);
            const scores = newTags.map((tag, index) => index);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetAdd(`cid:${cid}:tag:whitelist`, scores, newTags);
            cache_1.default.del(`cid:${cid}:tag:whitelist`);
        });
    }
    function updateName(cid, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            const oldName = yield Categories.getCategoryField(cid, 'name');
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetRemove('categories:name', `${oldName.slice(0, 200).toLowerCase()}:${cid}`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetAdd('categories:name', 0, `${newName.slice(0, 200).toLowerCase()}:${cid}`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.setObjectField(`category:${cid}`, 'name', newName);
        });
    }
    function updateOrder(cid, order) {
        return __awaiter(this, void 0, void 0, function* () {
            const parentCid = yield Categories.getCategoryField(cid, 'parentCid');
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetsAdd('categories:cid', order, cid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const childrenCids = yield database_1.default.getSortedSetRange(`cid:${parentCid}:children`, 0, -1);
            const currentIndex = childrenCids.indexOf(cid);
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
            yield database_1.default.sortedSetAdd(`cid:${parentCid}:children`, childrenCids.map((cid, index) => index + 1), childrenCids);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.setObjectBulk(childrenCids.map((cid, index) => [`category:${cid}`, { order: index + 1 }]));
            cache_1.default.del([
                'categories:cid',
                `cid:${parentCid}:children`,
                `cid:${parentCid}:children:all`,
            ]);
        });
    }
    function updateCategoryField(cid, key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (key === 'parentCid') {
                return yield updateParent(cid, value);
            }
            else if (key === 'tagWhitelist') {
                return yield updateTagWhitelist(cid, value);
            }
            else if (key === 'name') {
                return yield updateName(cid, value);
            }
            else if (key === 'order') {
                return yield updateOrder(cid, value);
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.setObjectField(`category:${cid}`, key, value);
            if (key === 'description') {
                yield Categories.parseDescription(cid, value);
            }
        });
    }
    function updateCategory(cid, modifiedFields) {
        var _a, e_1, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield Categories.exists(cid);
            if (!exists) {
                return;
            }
            if (modifiedFields.hasOwnProperty('name')) {
                const translated = yield translator_1.default.translate(modifiedFields.name);
                modifiedFields.slug = `${cid}/${(0, slugify_1.default)(translated)}`;
            }
            const result = yield plugins_1.default.hooks.fire('filter:category.update', { cid: cid, category: modifiedFields });
            const { category } = result;
            const fields = Object.keys(category);
            // move parent to front, so its updated first
            const parentCidIndex = fields.indexOf('parentCid');
            if (parentCidIndex !== -1 && fields.length > 1) {
                fields.splice(0, 0, fields.splice(parentCidIndex, 1)[0]);
            }
            try {
                for (var _d = true, fields_1 = __asyncValues(fields), fields_1_1; fields_1_1 = yield fields_1.next(), _a = fields_1_1.done, !_a;) {
                    _c = fields_1_1.value;
                    _d = false;
                    try {
                        const key = _c;
                        // eslint-disable-next-line no-await-in-loop
                        yield updateCategoryField(cid, key, category[key]);
                    }
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = fields_1.return)) yield _b.call(fields_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            plugins_1.default.hooks.fire('action:category.update', { cid: cid, modified: category });
        });
    }
    Categories.parseDescription = function (cid, description) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsedDescription = yield plugins_1.default.hooks.fire('filter:parse.raw', description);
            yield Categories.setCategoryField(cid, 'descriptionParsed', parsedDescription);
        });
    };
    Categories.update = function (modified) {
        return __awaiter(this, void 0, void 0, function* () {
            const cids = Object.keys(modified);
            yield Promise.all(cids.map(cid => updateCategory(cid, modified[cid])));
            return cids;
        });
    };
};
