'use strict';

const zxcvbn = require('zxcvbn');
const winston = require('winston');

const db = require('../database');
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');
const groups = require('../groups');
const meta = require('../meta');
const analytics = require('../analytics');

//THE FOLLOWING HELPER FUNCTIONS FROM LINE 15 to 127 WERE WRITTEN WITH THE HELP OF CHATGPT
/* ---------- HELPERS (top-level) ---------- */

async function lock(value, error) {
	const count = await db.incrObjectField('locks', value);
	if (count > 1) {
		throw new Error(error);
	}
}

function buildUserData(data, timestamp) {
	const baseData = {
		username: data.username,
		userslug: data.userslug,
		joindate: timestamp,
		lastonline: timestamp,
		status: 'online',
	};

	const optionalFields = ['picture', 'fullname', 'birthday'];

	optionalFields.forEach((field) => {
		if (data[field]) baseData[field] = data[field];
	});

	if (data.gdpr_consent === true) baseData.gdpr_consent = 1;
	if (data.acceptTos === true) baseData.acceptTos = 1;

	return baseData;
}

async function ensureUniqueUsername(userData, User) {
	const renamed = await User.uniqueUsername(userData);
	if (renamed) {
		userData.username = renamed;
		userData.userslug = slugify(renamed);
		userData._usernameChanged = true;
	}
	return userData;
}

async function applyPluginFilters(userData, data) {
	const results = await plugins.hooks.fire('filter:user.create', { user: userData, data });
	return results.user;
}

async function assignUid() {
	const uid = await db.incrObjectField('global', 'nextUid');
	const isFirstUser = uid === 1;
	return { uid, isFirstUser };
}

async function saveUserToDb(userData, timestamp) {
	await db.setObject(`user:${userData.uid}`, userData);

	const bulkAdd = [
		['username:uid', userData.uid, userData.username],
		[`user:${userData.uid}:usernames`, timestamp, `${userData.username}:${timestamp}`],
		['username:sorted', 0, `${userData.username.toLowerCase()}:${userData.uid}`],
		['userslug:uid', userData.uid, userData.userslug],
		['users:joindate', timestamp, userData.uid],
		['users:online', timestamp, userData.uid],
		['users:postcount', 0, userData.uid],
		['users:reputation', 0, userData.uid],
	];

	if (userData.fullname) {
		bulkAdd.push(['fullname:sorted', 0, `${userData.fullname.toLowerCase()}:${userData.uid}`]);
	}

	await db.sortedSetAddBulk(bulkAdd);
}

async function runPostCreationTasks({ userData, data, isFirstUser, User }) {
	await Promise.all([
		db.incrObjectField('global', 'userCount'),
		analytics.increment('registrations'),
		groups.join(['registered-users', 'unverified-users'], userData.uid),
		User.notifications.sendWelcomeNotification(userData.uid),
		storePassword(userData.uid, data.password, User),
		User.updateDigestSetting(userData.uid, meta.config.dailyDigestFreq),
	]);

	if (data.email && isFirstUser) {
		await User.setUserField(userData.uid, 'email', data.email);
		await User.email.confirmByUid(userData.uid);
	}

	if (data.email && userData.uid > 1) {
		await User.email.sendValidationEmail(userData.uid, {
			email: data.email,
			template: 'welcome',
			subject: `[[email:welcome-to, ${meta.config.title || meta.config.browserTitle || 'NodeBB'}]]`,
		}).catch(err =>
			winston.error(`[user.create] Validation email failed to send\n[emailer.send] ${err.stack}`));
	}

	if (userData._usernameChanged) {
		await User.notifications.sendNameChangeNotification(userData.uid, userData.username);
	}
}

async function storePassword(uid, password, User) {
	if (!password) return;
	const hash = await User.hashPassword(password);
	await Promise.all([
		User.setUserFields(uid, {
			password: hash,
			'password:shaWrapped': 1,
		}),
		User.reset.updateExpiry(uid),
	]);
}

/* ---------- EXPORTS ---------- */

module.exports = function (User) {

	User.create = async function (data) {
		data.username = data.username.trim();
		data.userslug = slugify(data.username);
		if (data.email !== undefined) {
			data.email = String(data.email).trim();
		}

		await User.isDataValid(data);

		await lock(data.username, '[[error:username-taken]]');
		if (data.email && data.email !== data.username) {
			await lock(data.email, '[[error:email-taken]]');
		}

		let uid;
		try {
			uid = await create(data, User);
		} finally {
			await db.deleteObjectFields('locks', [data.username, data.email]);
		}

		return uid;
	};

	//THE FOLLOWING CREATE function was WRITTEN WITH THE HELP OF CHATGPT TO REDUCE THE cyclomatic complexity count 11
	async function create(data, User) {
		const timestamp = data.timestamp || Date.now();
		let userData = buildUserData(data, timestamp);
		userData = await ensureUniqueUsername(userData, User);
		userData = await applyPluginFilters(userData, data);
		const { uid, isFirstUser } = await assignUid();
		userData.uid = uid;
		await saveUserToDb(userData, timestamp);
		await runPostCreationTasks({ userData, data, isFirstUser, User });
		plugins.hooks.fire('action:user.create', { user: userData, data });
		return userData.uid;

	}

	User.isDataValid = async function (userData) {
		if (userData.email && !utils.isEmailValid(userData.email)) {
			throw new Error('[[error:invalid-email]]');
		}

		if (!utils.isUserNameValid(userData.username) || !userData.userslug) {
			throw new Error(`[[error:invalid-username, ${userData.username}]]`);
		}

		if (userData.password) {
			User.isPasswordValid(userData.password);
		}

		if (userData.email) {
			const available = await User.email.available(userData.email);
			if (!available) throw new Error('[[error:email-taken]]');
		}
	};

	User.isPasswordValid = function (password, minStrength) {
		minStrength = (minStrength || minStrength === 0) ? minStrength : meta.config.minimumPasswordStrength;

		if (!password || !utils.isPasswordValid(password)) {
			throw new Error('[[error:invalid-password]]');
		}

		if (password.length < meta.config.minimumPasswordLength) {
			throw new Error('[[reset_password:password-too-short]]');
		}

		if (password.length > 512) {
			throw new Error('[[error:password-too-long]]');
		}

		const strength = zxcvbn(password);
		if (strength.score < minStrength) {
			throw new Error('[[user:weak-password]]');
		}
	};

	User.uniqueUsername = async function (userData) {
		let numTries = 0;
		let { username } = userData;
		while (true) {
			/* eslint-disable no-await-in-loop */
			const exists = await meta.slugTaken(username);
			if (!exists) {
				return numTries ? username : null;
			}
			username = `${userData.username} ${numTries.toString(32)}`;
			numTries += 1;
		}
	};

};