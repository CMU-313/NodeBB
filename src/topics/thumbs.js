"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const nconf_1 = __importDefault(require("nconf"));
const path_1 = __importDefault(require("path"));
const validator_1 = __importDefault(require("validator"));
const database_1 = __importDefault(require("../database"));
const file_1 = __importDefault(require("../file"));
const plugins_1 = __importDefault(require("../plugins"));
const posts_1 = __importDefault(require("../posts"));
const meta_1 = __importDefault(require("../meta"));
const cache_1 = __importDefault(require("../cache"));
const _1 = __importDefault(require("."));
const Thumbs = {};
// Defining object methods
Thumbs.exists = async function (id, path) {
    const isDraft = validator_1.default.isUUID(String(id));
    const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return database_1.default.isSortedSetMember(set, path);
};
Thumbs.load = async function (topicData) {
    const topicsWithThumbs = topicData.filter(t => t && parseInt(t.numThumbs, 10) > 0);
    const tidsWithThumbs = topicsWithThumbs.map(t => t.tid);
    // Cannot determine actual return type of Thumbs.get(...), since this function uses
    // cache package to generate 'thumb' elements that are part of this returned value.
    const thumbs = await Thumbs.get(tidsWithThumbs);
    const tidToThumbs = lodash_1.default.zipObject(tidsWithThumbs, thumbs);
    return topicData.map(t => (t && t.tid ? (tidToThumbs[t.tid] || []) : []));
};
async function getThumbs(set) {
    const cached = cache_1.default.get(set);
    if (cached !== undefined) {
        return cached.slice();
    }
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const thumbs = await database_1.default.getSortedSetRange(set, 0, -1);
    cache_1.default.set(set, thumbs);
    return thumbs.slice();
}
Thumbs.get = async function (tids) {
    // Allow singular or plural usage
    let singular = false;
    if (!Array.isArray(tids)) {
        tids = [tids];
        singular = true;
    }
    // Note sure how to fix "unsafe member access" since 'meta' is from another
    // file in the NodeBB directory and not a variable explicitly defined in
    // src/topics/thumbs.js.
    if (!meta_1.default.config.allowTopicsThumbnail || !tids.length) {
        return singular ? [] : tids.map(() => []);
    }
    const hasTimestampPrefix = /^\d+-/;
    const upload_url = nconf_1.default.get('relative_path') + nconf_1.default.get('upload_url');
    const sets = tids.map(tid => `${validator_1.default.isUUID(String(tid)) ? 'draft' : 'topic'}:${tid}:thumbs`);
    const thumbs = await Promise.all(sets.map(getThumbs));
    let response = thumbs.map((thumbSet, idx) => thumbSet.map(thumb => ({
        id: tids[idx],
        name: (() => {
            const name = path_1.default.basename(thumb);
            return hasTimestampPrefix.test(name) ? name.slice(14) : name;
        })(),
        url: thumb.startsWith('http') ? thumb : path_1.default.posix.join(upload_url, thumb),
    })));
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    ({ thumbs: response } = await plugins_1.default.hooks.fire('filter:topics.getThumbs', { tids, thumbs: response }));
    return singular ? response.pop() : response;
};
Thumbs.associate = async function ({ id, path, score }) {
    // Associates a newly uploaded file as a thumb to the passed-in draft or topic
    const isDraft = validator_1.default.isUUID(String(id));
    const isLocal = !path.startsWith('http');
    const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
    // Don't know how to fix unsafe assignment on next line 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const numThumbs = await database_1.default.sortedSetCard(set);
    // Normalize the path to allow for changes in upload_path (and so upload_url can be appended if needed)
    if (isLocal) {
        path = path.replace(nconf_1.default.get('upload_path'), '');
    }
    await database_1.default.sortedSetAdd(set, isFinite(score) ? score : numThumbs, path);
    if (!isDraft) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const numThumbs = await database_1.default.sortedSetCard(set);
        await _1.default.setTopicField(id, 'numThumbs', numThumbs);
    }
    cache_1.default.del(set);
    // Associate thumbnails with the main pid (only on local upload)
    if (!isDraft && isLocal) {
        const mainPid = (await _1.default.getMainPids([id]))[0];
        await posts_1.default.uploads.associate(mainPid, path.slice(1));
    }
};
Thumbs.migrate = async function (uuid, id) {
    // Converts the draft thumb zset to the topic zset (combines thumbs if applicable)
    const set = `draft:${uuid}:thumbs`;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const thumbs = await database_1.default.getSortedSetRangeWithScores(set, 0, -1);
    await Promise.all(thumbs.map(async (thumb) => await Thumbs.associate({
        id,
        path: thumb.value,
        score: thumb.score,
    })));
    await database_1.default.delete(set);
    cache_1.default.del(set);
};
Thumbs.delete = async function (id, relativePaths) {
    const isDraft = validator_1.default.isUUID(String(id));
    const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
    if (typeof relativePaths === 'string') {
        relativePaths = [relativePaths];
    }
    else if (!Array.isArray(relativePaths)) {
        throw new Error('[[error:invalid-data]]');
    }
    const absolutePaths = relativePaths.map(relativePath => path_1.default.join(nconf_1.default.get('upload_path'), relativePath));
    const [associated, existsOnDisk] = await Promise.all([
        database_1.default.isSortedSetMembers(set, relativePaths),
        Promise.all(absolutePaths.map(async (absolutePath) => file_1.default.exists(absolutePath))),
    ]);
    const toRemove = [];
    const toDelete = [];
    relativePaths.forEach((relativePath, idx) => {
        if (associated[idx]) {
            toRemove.push(relativePath);
        }
        if (existsOnDisk[idx]) {
            toDelete.push(absolutePaths[idx]);
        }
    });
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await database_1.default.sortedSetRemove(set, toRemove);
    if (isDraft && toDelete.length) { // drafts only; post upload dissociation handles disk deletion for topics
        await Promise.all(toDelete.map(async (absolutePath) => file_1.default.delete(absolutePath)));
    }
    if (toRemove.length && !isDraft) {
        const mainPid = (await _1.default.getMainPids([id]))[0];
        await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            database_1.default.incrObjectFieldBy(`topic:${id}`, 'numThumbs', -toRemove.length),
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            Promise.all(toRemove.map(async (relativePath) => posts_1.default.uploads.dissociate(mainPid, relativePath.slice(1)))),
        ]);
    }
};
Thumbs.deleteAll = async function (id) {
    const isDraft = validator_1.default.isUUID(String(id));
    const set = `${isDraft ? 'draft' : 'topic'}:${id}:thumbs`;
    // The next line calls a function in a module that has not been updated to TS yet
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const thumbs = await database_1.default.getSortedSetRange(set, 0, -1);
    await Thumbs.delete(id, thumbs);
};
exports.default = Thumbs;
