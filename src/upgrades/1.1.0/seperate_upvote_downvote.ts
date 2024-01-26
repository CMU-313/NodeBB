'use strict';


import * as async from 'async';
import * as winston from 'winston';
import * as db from '../../database';

export type PostObject ={
    upvotes: number;
    downvotes: number;
}

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
                }, (err, results:number) => {
                    if (err) {
                        return next(err);
                    }
                    const data: {
                        upvotes?: number;
                        downvotes?: number;
                    } = {};

                    interface Provider{
                        upvotes: number,
                        downvotes: number
                    }
                    

                    if (parseInt(results.upvotes, 10) > 0) {
                        data.upvotes = results.upvotes;
                    }
                    if (parseInt(results.downvotes, 10) > 0) {
                        data.downvotes = results.downvotes;
                    }

                    if (Object.keys(data).length) {
                        posts.setPostFields(pid, data, next);
                    } else {
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