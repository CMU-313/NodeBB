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
const validator_1 = __importDefault(require("validator"));
const diff_1 = __importDefault(require("diff"));
const database_1 = __importDefault(require("../database"));
const meta_1 = __importDefault(require("../meta"));
const plugins_1 = __importDefault(require("../plugins"));
const translator_1 = __importDefault(require("../translator"));
const topics_1 = __importDefault(require("../topics"));
function default_1(Posts) {
    const Diffs = {};
    Posts.diffs = Diffs;
    Diffs.exists = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (meta_1.default.config.enablePostHistory !== 1) {
                return false;
            }
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const numDiffs = yield database_1.default.listLength(`post:${pid}:diffs`);
            return !!numDiffs;
        });
    };
    Diffs.get = function (pid, since) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamps = yield Diffs.list(pid);
            if (!since) {
                since = 0;
            }
            // Pass those made after `since`, and create keys
            const keys = timestamps.filter(t => (parseInt(t, 10) || 0) > since)
                .map(t => `diff:${pid}.${t}`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield database_1.default.getObjects(keys);
        });
    };
    Diffs.list = function (pid) {
        return __awaiter(this, void 0, void 0, function* () {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return yield database_1.default.getListRange(`post:${pid}:diffs`, 0, -1);
        });
    };
    Diffs.save = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { pid, uid, oldContent, newContent, edited, topic } = data;
            const editTimestamp = edited || Date.now();
            const diffData = {
                uid: uid,
                pid: pid,
            };
            if (oldContent !== newContent) {
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                diffData.patch = diff_1.default.createPatch('', newContent, oldContent);
            }
            if (topic.renamed) {
                diffData.title = topic.oldTitle;
            }
            if (topic.tagsupdated && Array.isArray(topic.oldTags)) {
                /* eslint-disable max-len */
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-return */
                diffData.tags = topic.oldTags.map(tag => tag && tag.value).filter(Boolean).join(',');
                /* eslint-enable max-len */
            }
            yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.listPrepend(`post:${pid}:diffs`, editTimestamp),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.setObject(`diff:${pid}.${editTimestamp}`, diffData),
            ]);
        });
    };
    function getValidatedTimestamp(timestamp) {
        const timestamp2 = parseInt(timestamp, 10);
        if (isNaN(timestamp2)) {
            throw new Error('[[error:invalid-data]]');
        }
        return timestamp;
    }
    function applyPatch(content, aDiff) {
        if (aDiff && aDiff.patch) {
            // The next line calls a function in a module that has not been updated to TS yet
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
               @typescript-eslint/no-unsafe-call */
            const result = diff_1.default.applyPatch(content, aDiff.patch, {
                fuzzFactor: 1,
            });
            return typeof result === 'string' ? result : content;
        }
        return content;
    }
    function postDiffLoad(pid, since, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            // Retrieves all diffs made since `since` and replays them to reconstruct what the post looked like at `since`
            const [post, diffs] = yield Promise.all([
                Posts.getPostSummaryByPids([pid], uid, { parse: false }),
                Posts.diffs.get(pid, since),
            ]);
            // Replace content with re-constructed content from that point in time
            // The next line calls a function in a module that has not been updated to TS yet
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
               @typescript-eslint/no-unsafe-call */
            post[0].content = diffs.reduce(applyPatch, validator_1.default.unescape(post[0].content));
            // The next line calls a function in a module that has not been updated to TS yet
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
               @typescript-eslint/no-unsafe-call */
            const titleDiffs = diffs.filter(d => d.hasOwnProperty('title') && d.title);
            // The next line calls a function in a module that has not been updated to TS yet
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
               @typescript-eslint/no-unsafe-call */
            if (titleDiffs.length && post[0].topic) {
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                post[0].topic.title = validator_1.default.unescape(String(titleDiffs[titleDiffs.length - 1].title));
            }
            // The next line calls a function in a module that has not been updated to TS yet
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
               @typescript-eslint/no-unsafe-call */
            const tagDiffs = diffs.filter(d => d.hasOwnProperty('tags') && d.tags);
            if (tagDiffs.length && post[0].topic) {
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                const tags = tagDiffs[tagDiffs.length - 1].tags.split(',').map((tag) => ({ value: tag }));
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                post[0].topic.tags = (yield topics_1.default.getTagData(tags));
            }
            return post[0];
        });
    }
    Diffs.load = function (pid, since, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            since = getValidatedTimestamp(since);
            const post = yield postDiffLoad(pid, since, uid);
            post.content = String(post.content || '');
            const result = yield plugins_1.default.hooks.fire('filter:parse.post', { postData: post });
            // The next line calls a function in a module that has not been updated to TS yet
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
               @typescript-eslint/no-unsafe-call */
            result.postData.content = translator_1.default.escape(result.postData.content);
            return result.postData;
        });
    };
    Diffs.restore = function (pid, since, uid, req) {
        return __awaiter(this, void 0, void 0, function* () {
            const since2 = getValidatedTimestamp(since);
            const post = yield postDiffLoad(pid, since, uid);
            return yield Posts.edit({
                uid: uid,
                pid: pid,
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                content: post.content,
                req: req,
                timestamp: since2,
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                title: post.topic.title,
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                tags: post.topic.tags.map((tag) => tag.value),
            });
        });
    };
    Diffs.delete = function (pid, timestamp, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            getValidatedTimestamp(timestamp);
            const [post, diffs, timestamps] = yield Promise.all([
                Posts.getPostSummaryByPids([pid], uid, { parse: false }),
                Diffs.get(pid),
                Diffs.list(pid),
            ]);
            const timestampIndex = timestamps.indexOf(timestamp);
            const lastTimestampIndex = timestamps.length - 1;
            if (timestamp === String(post[0].timestamp)) {
                // Deleting oldest diff, so history rewrite is not needed
                return Promise.all([
                    // The next line calls a function in a module that has not been updated to TS yet
                    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                       @typescript-eslint/no-unsafe-call */
                    database_1.default.delete(`diff:${pid}.${timestamps[lastTimestampIndex]}`),
                    // The next line calls a function in a module that has not been updated to TS yet
                    /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                       @typescript-eslint/no-unsafe-call */
                    database_1.default.listRemoveAll(`post:${pid}:diffs`, timestamps[lastTimestampIndex]),
                ]);
            }
            if (timestampIndex === 0 || timestampIndex === -1) {
                throw new Error('[[error:invalid-data]]');
            }
            // The next line calls a function in a module that has not been updated to TS yet
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
               @typescript-eslint/no-unsafe-call */
            const postContent = validator_1.default.unescape(post[0].content);
            const versionContents = {};
            for (let i = 0, content = postContent; i < timestamps.length; ++i) {
                versionContents[timestamps[i]] = applyPatch(content, diffs[i]);
                content = versionContents[timestamps[i]];
            }
            /* eslint-disable no-await-in-loop */
            for (let i = lastTimestampIndex; i >= timestampIndex; --i) {
                // Recreate older diffs with skipping the deleted diff
                const newContentIndex = i === timestampIndex ? i - 2 : i - 1;
                const timestampToUpdate = newContentIndex + 1;
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                /* eslint-disable max-len */
                const newContent = newContentIndex < 0 ? postContent : versionContents[timestamps[newContentIndex]];
                /* eslint-enable max-len */
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                const patch = diff_1.default.createPatch('', newContent, versionContents[timestamps[i]]);
                // The next line calls a function in a module that has not been updated to TS yet
                /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,
                   @typescript-eslint/no-unsafe-call */
                yield database_1.default.setObject(`diff:${pid}.${timestamps[timestampToUpdate]}`, { patch });
            }
            return Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.delete(`diff:${pid}.${timestamp}`),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.listRemoveAll(`post:${pid}:diffs`, timestamp),
            ]);
        });
    };
}
exports.default = default_1;
