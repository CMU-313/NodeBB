'use strict';

const assert = require('assert');
const db = require('../../src/database');
const meta = require('../../src/meta');
const User = require('../../src/user');
const plugins = require('../../src/plugins'); // Added for Line 84 coverage

describe('Refactor Coverage: checkPostDelays', function () {
	let uid;
	let originalPostDelay;
	let originalNewbieDelay;
	let originalInitialDelay;

	before(async function () {
		uid = await User.create({ username: 'coverageUser' + Date.now() });
		originalPostDelay = meta.config.postDelay;
		originalNewbieDelay = meta.config.newbiePostDelay;
		originalInitialDelay = meta.config.initialPostDelay;
	});

	after(function () {
		meta.config.postDelay = originalPostDelay || 0;
		meta.config.newbiePostDelay = originalNewbieDelay || 0;
		meta.config.initialPostDelay = originalInitialDelay || 0;
		meta.config.newbieReputationThreshold = 0;
	});

	it('should fail if the user posts too quickly (Standard Rate Limit)', async function () {
		meta.config.postDelay = 10;
		try {
			await db.setObjectField('user:' + uid, 'lastposttime', Date.now());
			await User.isReadyToPost(uid, 1);
			throw new Error('Should have failed');
		} catch (err) {
			assert.strictEqual(err.message, '[[error:too-many-posts, 10]]');
		}
	});

	it('should fail if a newbie posts too quickly (Newbie Rate Limit)', async function () {
		meta.config.newbiePostDelay = 10;
		meta.config.newbieReputationThreshold = 100;
		meta.config.postDelay = 0;

		try {
			await User.setUserField(uid, 'reputation', 0);
			await db.setObjectField('user:' + uid, 'lastposttime', Date.now());
			await User.isReadyToPost(uid, 1);
			throw new Error('Should have failed');
		} catch (err) {
			assert.ok(err.message.startsWith('[[error:too-many-posts-newbie'));
		}
	});

	it('should fail if the user JUST joined (Initial Post Delay)', async function () {
		meta.config.initialPostDelay = 100;
		meta.config.postDelay = 0;
		meta.config.newbiePostDelay = 0;

		try {
			await User.isReadyToPost(uid, 1);
			throw new Error('Should have failed');
		} catch (err) {
			assert.ok(err.message.startsWith('[[error:user-too-new'));
		}
	});

	it('should fail with minute-format message if newbie delay is multiple of 60', async function () {
		meta.config.newbiePostDelay = 120;
		meta.config.newbieReputationThreshold = 100;
		meta.config.postDelay = 0;
		meta.config.initialPostDelay = 0;

		try {
			await User.setUserField(uid, 'reputation', 0);
			await db.setObjectField('user:' + uid, 'lastposttime', Date.now());
			await User.isReadyToPost(uid, 1);
			throw new Error('Should have failed');
		} catch (err) {
			assert.ok(err.message.startsWith('[[error:too-many-posts-newbie-minutes'));
		}
	});

	// --- FINAL TEST FOR 100% (Line 84: Plugin Bypass) ---
	it('should bypass all checks if a plugin sets shouldIgnoreDelays to true', async function () {
		// Set a delay that would normally cause a failure
		meta.config.postDelay = 1000;
		await db.setObjectField('user:' + uid, 'lastposttime', Date.now());

		// Mock a plugin hook
		plugins.hooks.register('test-plugin', {
			hook: 'filter:user.posts.isReady',
			method: (data) => {
				data.shouldIgnoreDelays = true;
				return data;
			},
		});

		// This should now succeed (no error thrown) because of Line 84 return
		await User.isReadyToPost(uid, 1);
		
		// Reset for safety
		meta.config.postDelay = 0;
	});

	// --- HELPER COVERAGE (Lines 124 & 150) ---
	it('should cover helper functions', async function () {
		await User.incrementUserPostCountBy(uid, 1);
		const pids = await User.getPostIds(uid, 0, -1);
		assert.ok(Array.isArray(pids));
	});
});