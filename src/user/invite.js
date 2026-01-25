'use strict';

const async = require('async');
const nconf = require('nconf');
const validator = require('validator');
const winston = require('winston');

const db = require('../database');
const meta = require('../meta');
const emailer = require('../emailer');
const groups = require('../groups');
const translator = require('../translator');
const utils = require('../utils');
const plugins = require('../plugins');

async function getInvites(uid) {
	const emails = await db.getSetMembers(`invitation:uid:${uid}`);
	return emails.map(email => validator.escape(String(email)));
}

async function getInvitesNumber(uid) {
	return db.setCount(`invitation:uid:${uid}`);
}

async function getInvitingUsers() {
	return db.getSetMembers('invitation:uids');
}

async function getAllInvites() {
	const uids = await getInvitingUsers();
	const invitations = await async.map(uids, getInvites);
	return invitations.map((invites, index) => ({
		uid: uids[index],
		invitations: invites,
	}));
}

async function deleteFromReferenceList(uid, email) {
	await Promise.all([
		db.setRemove(`invitation:uid:${uid}`, email),
		db.delete(`invitation:uid:${uid}:invited:${email}`),
	]);

	const count = await db.setCount(`invitation:uid:${uid}`);
	if (count === 0) {
		await db.setRemove('invitation:uids', uid);
	}
}

async function prepareInvitation(User, uid, email, groupsToJoin) {
	const inviterExists = await User.exists(uid);
	if (!inviterExists) {
		throw new Error('[[error:invalid-uid]]');
	}

	const token = utils.generateUUID();
	const registerLink = `${nconf.get('url')}/register?token=${token}`;

	const expireDays = meta.config.inviteExpiration;
	const expireIn = expireDays * 86400000;

	await db.setAdd(`invitation:uid:${uid}`, email);
	await db.setAdd('invitation:uids', uid);
	await db.set(`invitation:uid:${uid}:invited:${email}`, token);
	await db.setAdd(`invitation:invited:${email}`, token);
	await db.setObject(`invitation:token:${token}`, {
		email,
		token,
		groupsToJoin: JSON.stringify(groupsToJoin),
		inviter: uid,
	});
	await db.pexpireAt(`invitation:token:${token}`, Date.now() + expireIn);

	const username = await User.getUserField(uid, 'username');
	const title = meta.config.title || meta.config.browserTitle || 'NodeBB';
	const subject = await translator.translate(`[[email:invite, ${title}]]`, meta.config.defaultLang);

	return {
		...emailer._defaultPayload,
		site_title: title,
		registerLink,
		subject,
		username,
		template: 'invitation',
		expireDays,
	};
}

module.exports = function (User) {
	User.getInvites = getInvites;
	User.getInvitesNumber = getInvitesNumber;
	User.getInvitingUsers = getInvitingUsers;
	User.getAllInvites = getAllInvites;

	User.sendInvitationEmail = async function (uid, email, groupsToJoin) {
		if (!uid) {
			throw new Error('[[error:invalid-uid]]');
		}

		const emailExists = await User.getUidByEmail(email);
		if (emailExists) {
			return true;
		}

		const invitationExists = await db.exists(`invitation:uid:${uid}:invited:${email}`);
		if (invitationExists) {
			throw new Error('[[error:email-invited]]');
		}

		const data = await prepareInvitation(User, uid, email, groupsToJoin);
		await emailer.sendToEmail('invitation', email, meta.config.defaultLang, data);
		plugins.hooks.fire('action:user.invite', { uid, email, groupsToJoin });
	};

	User.verifyInvitation = async function (query) {
		if (!query.token) {
			if (meta.config.registrationType.startsWith('admin-')) {
				throw new Error('[[register:invite.error-admin-only]]');
			}
			throw new Error('[[register:invite.error-invite-only]]');
		}

		const token = await db.getObjectField(`invitation:token:${query.token}`, 'token');
		if (!token || token !== query.token) {
			throw new Error('[[register:invite.error-invalid-data]]');
		}
	};

	User.isInviteTokenValid = async function (token, enteredEmail) {
		if (!token) {
			return false;
		}
		const email = await db.getObjectField(`invitation:token:${token}`, 'email');
		return email && email === enteredEmail;
	};

	User.confirmIfInviteEmailIsUsed = async function (token, enteredEmail, uid) {
		if (!enteredEmail) {
			return;
		}

		const email = await db.getObjectField(`invitation:token:${token}`, 'email');
		if (email && email === enteredEmail) {
			await User.setUserField(uid, 'email', email);
			await User.email.confirmByUid(uid);
		}
	};

	User.joinGroupsFromInvitation = async function (uid, token) {
		let groupsToJoin = await db.getObjectField(`invitation:token:${token}`, 'groupsToJoin');

		try {
			groupsToJoin = JSON.parse(groupsToJoin);
		} catch (err) {
			winston.error(`[User.joinGroupsFromInvitation] ${err.stack}`);
			return;
		}

		if (!groupsToJoin || groupsToJoin.length < 1) {
			return;
		}

		await groups.join(groupsToJoin, uid);
	};

	User.deleteInvitation = async function (invitedBy, email) {
		const invitedByUid = await User.getUidByUsername(invitedBy);
		if (!invitedByUid) {
			throw new Error('[[error:invalid-username]]');
		}

		const token = await db.get(`invitation:uid:${invitedByUid}:invited:${email}`);
		await Promise.all([
			deleteFromReferenceList(invitedByUid, email),
			db.setRemove(`invitation:invited:${email}`, token),
			db.delete(`invitation:token:${token}`),
		]);
	};

	User.deleteInvitationKey = async function (registrationEmail, token) {
		if (registrationEmail) {
			const uids = await getInvitingUsers();
			await Promise.all(uids.map(uid => deleteFromReferenceList(uid, registrationEmail)));

			const tokens = await db.getSetMembers(`invitation:invited:${registrationEmail}`);
			const keysToDelete = [`invitation:invited:${registrationEmail}`]
				.concat(tokens.map(t => `invitation:token:${t}`));

			await db.deleteAll(keysToDelete);
		}

		if (token) {
			const invite = await db.getObject(`invitation:token:${token}`);
			if (!invite) {
				return;
			}

			await deleteFromReferenceList(invite.inviter, invite.email);
			await db.deleteAll([
				`invitation:invited:${invite.email}`,
				`invitation:token:${token}`,
			]);
		}
	};
};
