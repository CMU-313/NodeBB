'use strict';

const winston = require('winston');
const validator = require('validator');
const slugify = require('../slugify');

const meta = require('../meta');

const helpers = module.exports;

helpers.try = function (middleware) {
	if (middleware && middleware.constructor && middleware.constructor.name === 'AsyncFunction') {
		return async function (req, res, next) {
			try {
				await middleware(req, res, next);
			} catch (err) {
				next(err);
			}
		};
	}
	return function (req, res, next) {
		try {
			middleware(req, res, next);
		} catch (err) {
			next(err);
		}
	};
};

function normalizePath(path) {
	return path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
}

function safeSlug(p) {
	try {
		p = slugify(decodeURIComponent(p));
	} catch (err) {
		winston.error(`Error decoding URI: ${p}`);
		winston.error(err.stack);
		p = '';
	}
	return validator.escape(String(p));
}

function buildSegments(clean) {
	const parts = clean.split('/').slice(0, 3);
	return parts.map((p, index, arr) => {
		const safe = safeSlug(p);
		return index ? `${safeSlug(arr[0])}-${safe}` : `page-${safe || 'home'}`;
	});
}

function addTemplateName(parts, template) {
	if (template) {
		parts.push(`template-${template.name.split('/').join('-')}`);
	}
}

function addTemplateTopic(parts, template, templateData) {
	if (template && template.topic) {
		parts.push(`page-topic-category-${templateData.category.cid}`);
		parts.push(`page-topic-category-${slugify(templateData.category.name)}`);
	}
}

function addTemplateChats(parts, template, templateData) {
	if (template && template.chats && templateData.roomId) {
		parts.push(`page-user-chats-${templateData.roomId}`);
	}
}


function addTemplateBreadcrumbs(parts, templateData) {
	if (Array.isArray(templateData.breadcrumbs)) {
		templateData.breadcrumbs.forEach((crumb) => {
			if (crumb && crumb.hasOwnProperty('cid')) {
				parts.push(`parent-category-${crumb.cid}`);
			}
		});
	}
}


function addTemplateBodyClasses(parts, templateData) {
	if (templateData && templateData.bodyClasses) {
		parts.push(...templateData.bodyClasses);
	}
}

function addStatusAuth(parts, req, res) {
	parts.push(`page-status-${res.statusCode}`);

	parts.push(`theme-${(meta.config['theme:id'] || '').split('-')[2]}`);

	if (req.loggedIn) {
		parts.push('user-loggedin');
	} else {
		parts.push('user-guest');
	}
}

helpers.buildBodyClass = function (req, res, templateData = {}) {
	const clean = normalizePath(req.path);
	const parts = buildSegments(clean);
	const { template } = templateData;

	addTemplateName(parts, template);
	addTemplateTopic(parts, template, templateData);
	addTemplateChats(parts, template, templateData);
	addTemplateBreadcrumbs(parts, templateData);
	addTemplateBodyClasses(parts, templateData);
	addStatusAuth(parts, req, res);

	return parts.join(' ');
};
