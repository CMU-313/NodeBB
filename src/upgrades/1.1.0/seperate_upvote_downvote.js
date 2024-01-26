'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const async = __importStar(require("async"));
const winston = __importStar(require("winston"));
const db = __importStar(require("../../database"));
module.exports = {
    name: 'Store upvotes/downvotes separately',
    timestamp: Date.UTC(2016, 5, 13),
    method: function (callback) {
        const batch = require('../../batch');
        const posts = require('../../posts');
        let count = 0;
        const { progress } = this;
        batch.processSortedSet('posts:pid', (pids, next) => {
            winston.verbose(`upgraded ${count} posts`);
            count += pids.length;
            async.each(pids, (pid, next) => {
                async.parallel({
                    upvotes: function (next) {
                        db.setCount(`pid:${pid}:upvote`, next);
                    },
                    downvotes: function (next) {
                        db.setCount(`pid:${pid}:downvote`, next);
                    },
                }, (err, results) => {
                    if (err) {
                        return next(err);
                    }
                    {
                        {
                            //@ts-ignore
                            reuslts.upvotes;
                            //@ts-ignore
                            results.downvotes;
                        }
                    }
                    const data = {};
                    if (parseInt(results.upvotes, 10) > 0) {
                        data.upvotes = results.upvotes;
                    }
                    if (parseInt(results.downvotes, 10) > 0) {
                        data.downvotes = results.downvotes;
                    }
                    if (Object.keys(data).length) {
                        posts.setPostFields(pid, data, next);
                    }
                    else {
                        next();
                    }
                    progress.incr();
                }, next);
            }, next);
        }, {
            progress: progress,
        }, callback);
    },
};
