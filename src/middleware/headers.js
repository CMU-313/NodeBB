'use strict';

const os = require('os');
const winston = require('winston');
const _ = require('lodash');

const meta = require('../meta');
const languages = require('../languages');
const helpers = require('./helpers');
const plugins = require('../plugins');

function buildBaseHeaders() {
	return {
		'X-Powered-By': encodeURI(meta.config['powered-by'] || 'NodeBB'),
		'Access-Control-Allow-Methods': encodeURI(meta.config['access-control-allow-methods'] || ''),
		'Access-Control-Allow-Headers': encodeURI(meta.config['access-control-allow-headers'] || ''),
	};
}

function applyCspHeaders(headers) {
	if (meta.config['csp-frame-ancestors']) {
		headers['Content-Security-Policy'] = `frame-ancestors ${meta.config['csp-frame-ancestors']}`;
		if (meta.config['csp-frame-ancestors'] === '\'none\'') {
			headers['X-Frame-Options'] = 'DENY';
		}
	} else {
		headers['Content-Security-Policy'] = 'frame-ancestors \'self\'';
		headers['X-Frame-Options'] = 'SAMEORIGIN';
	}
}

function setAllowOrigin(headers, origin) {
	headers['Access-Control-Allow-Origin'] = encodeURI(origin);
	headers.Vary = headers.Vary ? `${headers.Vary}, Origin` : 'Origin';
}

function handleCorsAllowOriginList(headers, origin) {
	if (!meta.config['access-control-allow-origin']) {
		return;
	}
	let origins = meta.config['access-control-allow-origin'].split(',');
	origins = origins.map(originStr => originStr && originStr.trim());
	if (origins.includes(origin)) {
		setAllowOrigin(headers, origin);
	}
}

function parseOriginRegexList(raw) {
	return raw.split(',').map((originRx) => {
		try {
			return new RegExp(originRx.trim());
		} catch (err) {
			winston.error(`[middleware.addHeaders] Invalid RegExp For access-control-allow-origin ${originRx}`);
			return null;
		}
	});
}

function handleCorsAllowOriginRegex(headers, origin) {
	if (!meta.config['access-control-allow-origin-regex']) {
		return;
	}
	const originsRegex = parseOriginRegexList(meta.config['access-control-allow-origin-regex']);
	if (originsRegex.some(regex => regex && regex.test(origin))) {
		setAllowOrigin(headers, origin);
	}
}

function applyCorsAllowOrigin(headers, req) {
	const origin = req.get('origin');
	handleCorsAllowOriginList(headers, origin);
	handleCorsAllowOriginRegex(headers, origin);
}

function applyAdditionalHeaders(headers) {
	if (meta.config['permissions-policy']) {
		headers['Permissions-Policy'] = meta.config['permissions-policy'];
	}
	if (meta.config['access-control-allow-credentials']) {
		headers['Access-Control-Allow-Credentials'] = meta.config['access-control-allow-credentials'];
	}
	if (process.env.NODE_ENV === 'development') {
		headers['X-Upstream-Hostname'] = os.hostname().replace(/[^0-9A-Za-z-.]/g, '');
	}
}

function writeHeaders(res, headers) {
	for (const [key, value] of Object.entries(headers)) {
		if (value) {
			res.setHeader(key, value);
		}
	}
}

const addHeadersHandler = helpers.try((req, res, next) => {
	const headers = buildBaseHeaders();
	applyCspHeaders(headers);
	applyCorsAllowOrigin(headers, req);
	applyAdditionalHeaders(headers);
	writeHeaders(res, headers);
	next();
});

async function listCodes() {
	const defaultLang = meta.config.defaultLang || 'en-GB';
	try {
		const codes = await languages.listCodes();
		return _.uniq([defaultLang, ...codes]);
	} catch (err) {
		winston.error(`[middleware/autoLocale] Could not retrieve languages codes list! ${err.stack}`);
		return [defaultLang];
	}
}

async function handleLangQuery(req) {
	if (!req.query.lang) {
		return false;
	}
	const langs = await listCodes();
	if (!langs.includes(req.query.lang)) {
		req.query.lang = meta.config.defaultLang;
	}
	return true;
}

async function maybeDetectAnonLang(req) {
	if (!meta.config.autoDetectLang || req.uid !== 0) {
		return false;
	}
	const langs = await listCodes();
	const lang = req.acceptsLanguages(langs);
	if (!lang) {
		return false;
	}
	req.query.lang = lang;
	return true;
}

const autoLocaleHandler = helpers.try(async (req, res, next) => {
	await plugins.hooks.fire('filter:middleware.autoLocale', { req: req, res: res });
	if (await handleLangQuery(req)) {
		return next();
	}
	if (await maybeDetectAnonLang(req)) {
		return next();
	}
	next();
});

module.exports = function (middleware) {
	middleware.addHeaders = addHeadersHandler;
	middleware.autoLocale = autoLocaleHandler;
};
