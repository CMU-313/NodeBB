'use strict';

const helpers = require('../helpers');

async function sortedSetRemove(key, pool, value)
{
	if (!key) {
		return;
	}
	const isValueArray = Array.isArray(value);
	if (!value || (isValueArray && !value.length)) {
		return;
	}

	if (!Array.isArray(key)) {
		key = [key];
	}

	if (!isValueArray) {
		value = [value];
	}
	value = value.map(helpers.valueToString);
	await pool.query({
		name: 'sortedSetRemove',
		text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = ANY($2::TEXT[])`,
		values: [key, value],
	});
}

async function sortedSetsRemove(keys, pool, value)
{
	if (!Array.isArray(keys) || !keys.length) {
		return;
	}

	value = helpers.valueToString(value);

	await pool.query({
		name: 'sortedSetsRemove',
		text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = $2::TEXT`,
		values: [keys, value],
	});
};

async function sortedSetsRemoveRangeByScore(pool, keys, range)
{
	if (!Array.isArray(keys) || !keys.length) {
		return;
	}

	let {min} = range;
	let {max} = range;

	if (min === '-inf') {
		min = null;
	}
	if (max === '+inf') {
		max = null;
	}

	await pool.query({
		name: 'sortedSetsRemoveRangeByScore',
		text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND ("score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
   AND ("score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)`,
		values: [keys, min, max], 
	});
}

async function sortedSetRemoveBulk(data, pool)
{
	if (!Array.isArray(data) || !data.length) {
		return;
	}
	const keys = data.map(d => d[0]);
	const values = data.map(d => d[1]);

	await pool.query({
		name: 'sortedSetRemoveBulk',
		text: `
	DELETE FROM "legacy_zset"
	WHERE (_key, value) IN (
		SELECT k, v
		FROM UNNEST($1::TEXT[], $2::TEXT[]) vs(k, v)
		)`,
		values: [keys, values],
	});
}

module.exports = function (module) {
	module.sortedSetRemove = (key, value) => sortedSetRemove(module.pool, key, value);
	module.sortedSetsRemove = (keys, value) => sortedSetsRemove(module.pool, keys, value);
	module.sortedSetRemoveBulk = data => sortedSetRemoveBulk(module.pool, data);
	module.sortedSetsRemoveRangeByScore = (keys, min, max) => {
		const range = {min, max};
		return sortedSetsRemoveRangeByScore(module.pool, keys, range);
	};
};
