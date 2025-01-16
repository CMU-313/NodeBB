
'use strict';

const util = require('util');

const db = require('./database');
const utils = require('./utils');

const DEFAULT_BATCH_SIZE = 100;

const sleep = util.promisify(setTimeout);

function createGetFn(db, reverse, isByScore, isWithScores) {
	const method = reverse ? 'getSortedSetRevRange' : 'getSortedSetRange';
	const byScore = isByScore ? 'ByScore' : '';
	const withScores = isWithScores ? 'WithScores' : '';
	return db[`${method}${byScore}${withScores}`];
}

async function getIds(getFn, start, stop, min, max, reverse, isByScore, setKey) {
	// Set max and min
	if (reverse) {
		let temp = min;
		min = max;
		max = temp;
	}

	// set score
	if (isByScore) {
		stop = stop - start + 1;
	}

	return await getFn(setKey, start, stop, min, max);
}

async function runProcess(options, db, process, setKey) {
	const isByScore = (options.min && options.min !== '-inf') || (options.max && options.max !== '+inf');
	const getFn = createGetFn(db, options.reverse, isByScore, options.withScores);

	let start = 0;
	let stop = options.batch - 1;
	let iteration = 1;
	while (true) {
		/* eslint-disable no-await-in-loop */
		const ids = await getIds(getFn, start, stop, options.min, options.max, options.reverse, isByScore, setKey);

		if (!ids.length || options.doneIf(start, stop, ids)) {
			return;
		}

		if (iteration > 1 && options.interval) {
			await sleep(options.interval);
		}

		await process(ids);
		iteration += 1;
		start += utils.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch;
		stop = start + options.batch - 1;
	}
}

exports.processSortedSet = async function (setKey, process, options) {
	options = options || {};

	if (typeof process !== 'function') {
		throw new Error('[[error:process-not-a-function]]');
	}

	// Progress bar handling (upgrade scripts)
	if (options.progress) {
		options.progress.total = await db.sortedSetCard(setKey);
	}

	options.batch = options.batch || DEFAULT_BATCH_SIZE;
	options.reverse = options.reverse || false;

	// use the fast path if possible
	if (db.processSortedSet && typeof options.doneIf !== 'function' && !utils.isNumber(options.alwaysStartAt)) {
		return await db.processSortedSet(setKey, process, options);
	}

	// custom done condition
	options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () { };

	if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
		process = util.promisify(process);
	}

	await runProcess(options, db, process, setKey);
};

exports.processArray = async function (array, process, options) {
	options = options || {};

	if (!Array.isArray(array) || !array.length) {
		return;
	}
	if (typeof process !== 'function') {
		throw new Error('[[error:process-not-a-function]]');
	}

	const batch = options.batch || DEFAULT_BATCH_SIZE;
	let start = 0;
	if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
		process = util.promisify(process);
	}
	let iteration = 1;
	while (true) {
		const currentBatch = array.slice(start, start + batch);

		if (!currentBatch.length) {
			return;
		}
		if (iteration > 1 && options.interval) {
			await sleep(options.interval);
		}
		await process(currentBatch);

		start += batch;
		iteration += 1;
	}
};

require('./promisify')(exports);
