"use strict"

const js = require("@eslint/js")
const prettier = require("eslint-config-prettier")

const nodeGlobals = {
	Buffer: "readonly",
	MutationObserver: "readonly",
	URL: "readonly",
	__dirname: "readonly",
	clearInterval: "readonly",
	clearTimeout: "readonly",
	console: "readonly",
	exports: "readonly",
	fetch: "readonly",
	module: "readonly",
	process: "readonly",
	require: "readonly",
	setInterval: "readonly",
	setTimeout: "readonly",
}

const browserGlobals = {
	BTB_DATA: "readonly",
	BTBI18N: "readonly",
	Image: "readonly",
	TextDecoder: "readonly",
	TextEncoder: "readonly",
	URL: "readonly",
	Uint8Array: "readonly",
	alert: "readonly",
	atob: "readonly",
	btoa: "readonly",
	clearTimeout: "readonly",
	console: "readonly",
	document: "readonly",
	fetch: "readonly",
	globalThis: "readonly",
	localStorage: "readonly",
	navigator: "readonly",
	performance: "readonly",
	requestAnimationFrame: "readonly",
	setTimeout: "readonly",
	window: "readonly",
}

module.exports = [
	{
		ignores: ["node_modules/**", "assets/**", "cards.CN/**", "cards.EN/**", "data.js", "info/**"],
	},
	js.configs.recommended,
	{
		files: ["**/*.js"],
		ignores: ["play.js", "replay.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "script",
			globals: nodeGlobals,
		},
		rules: {
			"no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
		},
	},
	{
		files: ["play.js", "replay.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "script",
			globals: browserGlobals,
		},
		rules: {
			"no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
		},
	},
	prettier,
]
