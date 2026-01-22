'use strict';

const assert = require('assert');
const db = require('../../src/database');
const meta = require('../../src/meta');
const User = require('../../src/user');

describe('Refactor Coverage: checkPostDelays', function () {
	let uid;
	let originalPostDelay;
	let originalNewbieDelay;
	let originalInitialDelay;

	before(async function () {
		uid = await User.create({ username: 'coverageUser' });
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

	// --- NEW TEST FOR 100% (Minutes Formatting) ---
	it('should fail with minute-format message if newbie delay is multiple of 60', async function () {
		meta.config.newbiePostDelay = 120; // 2 Minutes (Triggers the % 60 === 0 logic)
		meta.config.newbieReputationThreshold = 100;
		meta.config.postDelay = 0;
		meta.config.initialPostDelay = 0;

		try {
			await User.setUserField(uid, 'reputation', 0);
			await db.setObjectField('user:' + uid, 'lastposttime', Date.now());
			await User.isReadyToPost(uid, 1);
			throw new Error('Should have failed');
		} catch (err) {
			// Check for the "-minutes" error key
			assert.ok(err.message.startsWith('[[error:too-many-posts-newbie-minutes'));
		}
	});
});