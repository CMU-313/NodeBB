'use strict';

const assert = require('assert');
const db = require('../mocks/databasemock');
const user = require('../../src/user');
const categories = require('../../src/categories');
const meta = require('../../src/meta');

describe('User Posts', () => {
	let testUid;
	let testCid;

	before(async () => {
		testUid = await user.getUidByUsername('posttestuser');
		if (!testUid) {
			testUid = await user.create({ 
				username: 'posttestuser', 
				password: 'barbar', 
				gdpr_consent: 1, 
			});
		}
		
		({ cid: testCid } = await categories.create({ 
			name: 'Test Category Posts',
			description: 'Test',
		}));

		meta.config.initialPostDelay = 0;
		await user.setUserField(testUid, 'joindate', Date.now() - 200000);
		await user.setUserField(testUid, 'mutedUntil', 0);
	});

	it('should throw newbie error in minutes format', async () => {
		meta.config.newbiePostDelay = 120;
		meta.config.newbieReputationThreshold = 3;
		meta.config.postDelay = 0;
		await user.setUserField(testUid, 'lastposttime', Date.now() - 60000);
		await user.setUserField(testUid, 'reputation', 1);

		await assert.rejects(user.isReadyToPost(testUid, testCid), /\[\[error:too-many-posts-newbie-minutes, 2, 3\]\]/);
	});

	it('should throw newbie error in seconds format', async () => {
		meta.config.newbiePostDelay = 90;
		meta.config.newbieReputationThreshold = 3;
		meta.config.postDelay = 0;
		await user.setUserField(testUid, 'lastposttime', Date.now() - 60000);
		await user.setUserField(testUid, 'reputation', 1);

		await assert.rejects(user.isReadyToPost(testUid, testCid), /\[\[error:too-many-posts-newbie, 90, 3\]\]/);
	});

	it('should throw general post delay error', async () => {
		meta.config.postDelay = 10;
		meta.config.newbiePostDelay = 0;
		await user.setUserField(testUid, 'lastposttime', Date.now() - 5000);
		await user.setUserField(testUid, 'reputation', 10);

		await assert.rejects(user.isReadyToPost(testUid, testCid), /\[\[error:too-many-posts, 10\]\]/);
	});
});