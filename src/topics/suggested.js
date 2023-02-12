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
const lodash_1 = __importDefault(require("lodash"));
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const privileges_1 = __importDefault(require("../privileges"));
const search_1 = __importDefault(require("../search"));
module.exports = function (Topics) {
    function getTidsWithSameTags(tid, cutoff) {
        return __awaiter(this, void 0, void 0, function* () {
            const tags = yield Topics.getTopicTags(tid);
            let tids;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            tids = cutoff === 0 ?
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.getSortedSetRevRange(tags.map((tag) => `tag:${tag}:topics`), 0, -1) :
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.getSortedSetRevRangeByScore(tags.map((tag) => `tag:${tag}:topics`), 0, -1, '+inf', Date.now() - cutoff);
            tids = tids.filter((_tid) => _tid !== tid); // remove self
            return lodash_1.default.shuffle(lodash_1.default.uniq(tids)).slice(0, 10).map(Number);
        });
    }
    function getSearchTids(tid, uid, cutoff) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicFields(tid, ['title', 'cid']);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const data = yield search_1.default.search({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                query: topicData.title,
                searchIn: 'titles',
                matchWords: 'any',
                categories: [topicData.cid],
                uid: uid,
                returnIds: true,
                timeRange: cutoff !== 0 ? cutoff / 1000 : 0,
                timeFilter: 'newer',
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            data.tids = data.filter((_tid) => _tid !== tid); // remove self
            return lodash_1.default.shuffle(data.tids).slice(0, 10).map(Number);
        });
    }
    function getCategoryTids(tid, cutoff) {
        return __awaiter(this, void 0, void 0, function* () {
            const cid = yield Topics.getTopicField(tid, 'cid');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const tids = cutoff === 0 ?
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.getSortedSetRevRange(`cid:${cid}:tids:lastposttime`, 0, 9) :
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield database_1.default.getSortedSetRevRangeByScore(`cid:${cid}:tids:lastposttime`, 0, 9, '+inf', Date.now() - cutoff);
            return lodash_1.default.shuffle(tids.map(Number).filter((_tid) => _tid !== tid));
        });
    }
    Topics.getSuggestedTopics = function (tid, uid, start, stop, cutoff = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            let tids;
            cutoff = cutoff === 0 ? cutoff : (cutoff * 2592000000);
            const [tagTids, searchTids] = yield Promise.all([
                getTidsWithSameTags(tid, cutoff),
                getSearchTids(tid, uid, cutoff),
            ]);
            tids = lodash_1.default.uniq(tagTids.concat(searchTids));
            let categoryTids = [];
            if (stop !== -1 && tids.length < stop - start + 1) {
                categoryTids = yield getCategoryTids(tid, cutoff);
            }
            tids = lodash_1.default.shuffle(lodash_1.default.uniq(tids.concat(categoryTids)));
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            tids = yield privileges_1.default.topics.filterTids('topics:read', tids, uid);
            let topicData = yield Topics.getTopicsByTids(tids, uid);
            topicData = topicData.filter((topic) => topic && topic.tid !== tid);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            topicData = (yield user_1.default.blocks.filter(uid, topicData));
            topicData = topicData.slice(start, stop !== -1 ? stop + 1 : undefined)
                .sort((t1, t2) => new Date(t2.timestamp).valueOf() - new Date(t1.timestamp).valueOf());
            return topicData;
        });
    };
};
