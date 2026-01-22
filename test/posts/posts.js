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
		// Save defaults
		originalPostDelay = meta.config.postDelay;
		originalNewbieDelay = meta.config.newbiePostDelay;
		originalInitialDelay = meta.config.initialPostDelay;
	});

	after(function () {
		// SAFETY NET: Reset all configs
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

	// --- THIS IS THE NEW TEST FOR 100% COVERAGE ---
	it('should fail if the user JUST joined (Initial Post Delay)', async function () {
		meta.config.initialPostDelay = 100; // User must wait 100s after joining
        
		// Disable other limits so we know for sure it's the Join Delay triggering
		meta.config.postDelay = 0;
		meta.config.newbiePostDelay = 0;

		try {
			// User joindate is basically "now" since we just created them
			// We don't need to set lastposttime here
			await User.isReadyToPost(uid, 1);
			throw new Error('Should have failed');
		} catch (err) {
			assert.ok(err.message.startsWith('[[error:user-too-new'));
		}
	});
});