'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	const utils = require('../../../utils');

	function normalizeScores(keys, scores) {
		const isArray = Array.isArray(scores);
		if (!isArray) {
			if (!utils.isNumber(scores)) {
				throw new Error(`[[error:invalid-score, ${scores}]]`);
			}
			return { isArrayOfScores: false, scores };
		}

		if (scores.length !== keys.length) {
			throw new Error('[[error:invalid-data]]');
		}

		if (!scores.every(utils.isNumber)) {
			throw new Error(`[[error:invalid-score, ${scores}]]`);
		}

		return { isArrayOfScores: true, scores };
	}

	module.sortedSetsAdd = async function (keys, scores, value) {
		console.log('HELEN sortedSetsAdd hit');
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		const { isArrayOfScores, scores: normalizedScores } = normalizeScores(keys, scores);
		value = helpers.valueToString(value);

		const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
		for (let i = 0; i < keys.length; i += 1) {
			const score = isArrayOfScores ? normalizedScores[i] : normalizedScores;
			bulk
				.find({ _key: keys[i], value: value })
				.upsert()
				.updateOne({ $set: { score: parseFloat(score) } });
		}
		await bulk.execute();
	};

	module.sortedSetAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
		for (const item of data) {
			if (!utils.isNumber(item[1])) {
				throw new Error(`[[error:invalid-score, ${item[1]}]]`);
			}
			bulk
				.find({ _key: item[0], value: String(item[2]) })
				.upsert()
				.updateOne({ $set: { score: parseFloat(item[1]) } });
		}
		await bulk.execute();
	};
};