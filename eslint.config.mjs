'use strict';

import serverConfig from 'eslint-config-nodebb';
import publicConfig from 'eslint-config-nodebb/public';
import commonRules from 'eslint-config-nodebb/common';

import { defineConfig } from 'eslint/config';
import stylisticJs from '@stylistic/eslint-plugin'
import js from '@eslint/js';
import globals from 'globals';

function normalizeQuotesRule(rule) {
	if (!Array.isArray(rule) || typeof rule[2] !== 'object' || rule[2] === null) {
		return rule;
	}

	const options = rule[2];
	if (typeof options.allowTemplateLiterals !== 'boolean') {
		return rule;
	}

	return [
		rule[0],
		rule[1],
		{
			...options,
			allowTemplateLiterals: options.allowTemplateLiterals ? 'always' : 'never',
		},
	];
}

function normalizeQuotesInRules(rules = {}) {
	const normalizedRules = {
		...rules,
	};

	if (Object.hasOwn(rules, '@stylistic/js/quotes')) {
		normalizedRules['@stylistic/js/quotes'] = normalizeQuotesRule(rules['@stylistic/js/quotes']);
	}

	if (Object.hasOwn(rules, 'quotes')) {
		normalizedRules.quotes = normalizeQuotesRule(rules.quotes);
	}

	return normalizedRules;
}

function normalizeConfigQuotes(config) {
	if (!config || typeof config !== 'object' || !config.rules) {
		return config;
	}

	return {
		...config,
		rules: normalizeQuotesInRules(config.rules),
	};
}

const normalizedCommonRules = normalizeQuotesInRules(commonRules);
const normalizedPublicConfig = publicConfig.map(normalizeConfigQuotes);
const normalizedServerConfig = serverConfig.map(normalizeConfigQuotes);

export default defineConfig([
	{
		ignores: [
			'node_modules/',
			'.project',
			'.vagrant',
			'.DS_Store',
			'.tx',
			'logs/',
			'public/uploads/',
			'public/vendor/',
			'.idea/',
			'.vscode/',
			'*.ipr',
			'*.iws',
			'coverage/',
			'build/',
			'test/files/',
			'*.min.js',
			'install/docker/',
		],
	},
	// tests
	{
		plugins: {
			js,
			'@stylistic/js': stylisticJs,
		},
		extends: ['js/recommended'],
		files: ['test/**/*.js'],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'commonjs',
			globals: {
				...globals.node,
				...globals.browser,
				it: 'readonly',
				describe: 'readonly',
				before: 'readonly',
				beforeEach: 'readonly',
				after: 'readonly',
				afterEach: 'readonly',
			},
		},
		rules: {
			...normalizedCommonRules,
			'no-unused-vars': 'off',
			'no-prototype-builtins': 'off',
		}
	},
	...normalizedPublicConfig,
	...normalizedServerConfig
]);

