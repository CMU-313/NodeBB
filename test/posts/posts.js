'use strict';

const assert = require('assert');
const db = require('../../src/database');
const meta = require('../../src/meta');
const User = require('../../src/user');

describe('Refactor Coverage: checkPostDelays', function () {
	let uid;
	let originalPostDelay;
	let originalNewbieDelay;

	before(async function () {
		uid = await User.create({ username: 'coverageUser' });
		// Save defaults once at the start
		originalPostDelay = meta.config.postDelay;
		originalNewbieDelay = meta.config.newbiePostDelay;
	});

	after(function () {
		// SAFETY NET: Force reset everything when this suite is done
		// This runs even if individual tests crash
		meta.config.postDelay = originalPostDelay || 0;
		meta.config.newbiePostDelay = originalNewbieDelay || 0;
		meta.config.newbieReputationThreshold = 0;
	});

	it('should fail if the user posts too quickly (Standard Rate Limit)', async function () {
		meta.config.postDelay = 10; // Set delay

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
        
		// Ensure standard delay is off so we hit the newbie logic
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
});