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
const database_1 = __importDefault(require("../database"));
const user_1 = __importDefault(require("../user"));
const posts_1 = __importDefault(require("../posts"));
const categories_1 = __importDefault(require("../categories"));
const plugins_1 = __importDefault(require("../plugins"));
const batch_1 = __importDefault(require("../batch"));
module.exports = function (Topics) {
    function removeTopicPidsFromCid(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [cid, pids] = yield Promise.all([
                Topics.getTopicField(tid, 'cid'),
                Topics.getPids(tid),
            ]);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetRemove(`cid:${cid}:pids`, pids);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield categories_1.default.updateRecentTidForCid(cid);
        });
    }
    function addTopicPidsToCid(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [cid, pids] = yield Promise.all([
                Topics.getTopicField(tid, 'cid'),
                Topics.getPids(tid),
            ]);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            let postData = yield posts_1.default.getPostsFields(pids, ['pid', 'timestamp', 'deleted']);
            postData = postData.filter(post => post && !post.deleted);
            const pidsToAdd = postData.map(post => post.pid);
            const scores = postData.map(post => post.timestamp);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetAdd(`cid:${cid}:pids`, scores, pidsToAdd);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield categories_1.default.updateRecentTidForCid(cid);
        });
    }
    Topics.delete = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield removeTopicPidsFromCid(tid);
            yield Topics.setTopicFields(tid, {
                deleted: 1,
                deleterUid: uid,
                deletedTimestamp: Date.now(),
            });
        });
    };
    Topics.restore = function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                Topics.deleteTopicFields(tid, [
                    'deleterUid', 'deletedTimestamp',
                ]),
                addTopicPidsToCid(tid),
            ]);
            yield Topics.setTopicField(tid, 'deleted', 0);
        });
    };
    Topics.purgePostsAndTopic = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const mainPid = yield Topics.getTopicField(tid, 'mainPid');
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield batch_1.default.processSortedSet(`tid:${tid}:posts`, (pids) => __awaiter(this, void 0, void 0, function* () {
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                yield posts_1.default.purge(pids, uid);
            }), { alwaysStartAt: 0, batch: 500 });
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield posts_1.default.purge(mainPid, uid);
            yield Topics.purge(tid, uid);
        });
    };
    function deleteFromFollowersIgnorers(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [followers, ignorers] = yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.getSetMembers(`tid:${tid}:followers`),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.getSetMembers(`tid:${tid}:ignorers`),
            ]);
            const followerKeys = followers.map(uid => `uid:${uid}:followed_tids`);
            const ignorerKeys = ignorers.map(uid => `uid:${uid}ignored_tids`);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.sortedSetsRemove(followerKeys.concat(ignorerKeys), tid);
        });
    }
    function reduceCounters(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const incr = -1;
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.incrObjectFieldBy('global', 'topicCount', incr);
            const topicData = yield Topics.getTopicFields(tid, ['cid', 'postcount']);
            const postCountChange = incr * topicData.postcount;
            yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.incrObjectFieldBy('global', 'postCount', postCountChange),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.incrObjectFieldBy(`category:${topicData.cid}`, 'post_count', postCountChange),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.incrObjectFieldBy(`category:${topicData.cid}`, 'topic_count', incr),
            ]);
        });
    }
    function deleteTopicFromCategoryAndUser(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const topicData = yield Topics.getTopicFields(tid, ['cid', 'uid']);
            yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.sortedSetsRemove([
                    `cid:${topicData.cid}:tids`,
                    `cid:${topicData.cid}:tids:pinned`,
                    `cid:${topicData.cid}:tids:posts`,
                    `cid:${topicData.cid}:tids:lastposttime`,
                    `cid:${topicData.cid}:tids:votes`,
                    `cid:${topicData.cid}:tids:views`,
                    `cid:${topicData.cid}:recent_tids`,
                    `cid:${topicData.cid}:uid:${topicData.uid}:tids`,
                    `uid:${topicData.uid}:topics`,
                ], tid),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                user_1.default.decrementUserFieldBy(topicData.uid, 'topiccount', 1),
            ]);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield categories_1.default.updateRecentTidForCid(topicData.cid);
        });
    }
    Topics.purge = function (tid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const [deletedTopic, tags] = yield Promise.all([
                Topics.getTopicData(tid),
                Topics.getTopicTags(tid),
            ]);
            if (!deletedTopic) {
                return;
            }
            deletedTopic.tags = tags;
            yield deleteFromFollowersIgnorers(tid);
            yield Promise.all([
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.deleteAll([
                    `tid:${tid}:followers`,
                    `tid:${tid}:ignorers`,
                    `tid:${tid}:posts`,
                    `tid:${tid}:posts:votes`,
                    `tid:${tid}:bookmarks`,
                    `tid:${tid}:posters`,
                ]),
                // The next line calls a function in a module that has not been updated to TS yet
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                database_1.default.sortedSetsRemove([
                    'topics:tid',
                    'topics:recent',
                    'topics:posts',
                    'topics:views',
                    'topics:votes',
                    'topics:scheduled',
                ], tid),
                deleteTopicFromCategoryAndUser(tid),
                Topics.deleteTopicTags(tid),
                Topics.events.purge(tid),
                Topics.thumbs.deleteAll(tid),
                reduceCounters(tid),
            ]);
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield plugins_1.default.hooks.fire('action:topic.purge', { topic: deletedTopic, uid: uid });
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            yield database_1.default.delete(`topic:${tid}`);
        });
    };
};
