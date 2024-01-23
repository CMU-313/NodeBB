'use strict';

const assert = require('assert');
// const db = require('../mocks/databasemock');
const user = require('../../src/user'); // Adjust the path as necessary

describe('follow.js', () => {
    describe('.follow() and .unfollow()', () => {
        let uid;
        let followuid;

        beforeEach(async () => {
            // Setup mock users
            uid = await user.create({ username: 'user1', password: 'password' });
            followuid = await user.create({ username: 'user2', password: 'password' });
        });

        it('should allow a user to follow another user', async () => {
            await user.follow(uid, followuid);
            const isFollowing = await user.isFollowing(uid, followuid);
            assert.strictEqual(isFollowing, true);
        });

        it('should not allow a user to follow themselves', async () => {
            try {
                await user.follow(uid, uid);
            } catch (e) {
                assert.strictEqual(e.message, '[[error:you-cant-follow-yourself]]');
            }
        });

        it('should not allow following a non-existent user', async () => {
            try {
                await user.follow(uid, 9999); // Assuming 9999 is a non-existent user ID
            } catch (e) {
                assert.strictEqual(e.message, '[[error:no-user]]');
            }
        });

        it('should not allow a user to follow someone they are already following', async () => {
            await user.follow(uid, followuid);
            try {
                await user.follow(uid, followuid);
            } catch (e) {
                assert.strictEqual(e.message, '[[error:already-following]]');
            }
        });

        it('should allow a user to unfollow another user', async () => {
            await user.follow(uid, followuid);
            await user.unfollow(uid, followuid);
            const isFollowing = await user.isFollowing(uid, followuid);
            assert.strictEqual(isFollowing, false);
        });
    });

    describe('User Following and Followers', () => {
        let uid;
        let followuid1;
        let followuid2;
        beforeEach(async () => {
            // Setup mock users
            uid = await user.create({ username: 'user1', password: 'password' });
            followuid1 = await user.create({ username: 'user2', password: 'password' });
            followuid2 = await user.create({ username: 'user3', password: 'password' });
        });
        it('should correctly return the users that a user is following', async () => {
            await user.follow(uid, followuid1);
            await user.follow(uid, followuid2);
            const following = await user.getFollowing(uid, 0, -1);
            assert(following.includes(followuid1));
            assert(following.includes(followuid2));
        });
        it('should correctly return the followers of a user', async () => {
            await user.follow(followuid1, uid);
            await user.follow(followuid2, uid);
            const followers = await user.getFollowers(uid, 0, -1);
            assert(followers.includes(followuid1));
            assert(followers.includes(followuid2));
        });
        it('should return an empty list if the user is not following anyone', async () => {
            const following = await user.getFollowing(uid, 0, -1);
            assert.strictEqual(following.length, 0);
        });
        it('should return an empty list if the user has no followers', async () => {
            const followers = await user.getFollowers(uid, 0, -1);
            assert.strictEqual(followers.length, 0);
        });
    });
});
