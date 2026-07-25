"use strict"

const fs = require("node:fs")
const path = require("node:path")

const ROOT = path.resolve(__dirname, "..")
const SOURCE_DIR = path.join(ROOT, "locales")
const OUTPUT = path.join(ROOT, "modules", "core", "i18n_catalog.js")
const CHECK = process.argv.includes("--check")
const HAN = /[\u3400-\u9fff]/
const KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/
const PARAM_PATTERN = /\{([a-z][a-z0-9_]*)\}/gi

function fail(message) {
	throw new Error(`i18n: ${message}`)
}

function templateParams(template) {
	return [...template.matchAll(PARAM_PATTERN)].map((match) => match[1])
}

function sameMembers(a, b) {
	return a.length === b.length && a.every((value, index) => value === b[index])
}

function loadCatalog() {
	const catalog = {}
	const files = fs
		.readdirSync(SOURCE_DIR)
		.filter((file) => file.endsWith(".json"))
		.sort()
	if (!files.length) fail("no locale source files")
	for (const file of files) {
		const text = fs.readFileSync(path.join(SOURCE_DIR, file), "utf8")
		const authoredKeys = [...text.matchAll(/^\s*"([a-z][a-z0-9]*(?:[._][a-z0-9]+)+)"\s*:/gm)].map((match) => match[1])
		const duplicates = [...new Set(authoredKeys.filter((key, index) => authoredKeys.indexOf(key) !== index))]
		if (duplicates.length) fail(`${file}: duplicate authored keys ${duplicates.join(", ")}`)
		let source
		try {
			source = JSON.parse(text)
		} catch (error) {
			fail(`${file}: invalid JSON (${error.message})`)
		}
		for (const [key, message] of Object.entries(source)) {
			if (!KEY_PATTERN.test(key)) fail(`${file}: invalid key ${key}`)
			if (catalog[key]) fail(`${file}: duplicate key ${key}`)
			if (!message || typeof message !== "object" || Array.isArray(message)) fail(`${file}: ${key} must be an object`)
			const params = message.params || []
			if (!Array.isArray(params) || params.some((param) => typeof param !== "string" || !/^[a-z][a-z0-9_]*$/.test(param))) fail(`${file}: ${key} has invalid params`)
			if (new Set(params).size !== params.length) fail(`${file}: ${key} has duplicate params`)
			if (typeof message["zh-CN"] !== "string" || typeof message.en !== "string") fail(`${file}: ${key} requires zh-CN and en strings`)
			if (message.allow_han_in_en !== undefined && message.allow_han_in_en !== true) fail(`${file}: ${key} allow_han_in_en must be true when present`)
			if (HAN.test(message.en) && message.allow_han_in_en !== true) fail(`${file}: ${key} English text contains Han characters`)
			const declared = [...params].sort()
			for (const locale of ["zh-CN", "en"]) {
				const used = [...new Set(templateParams(message[locale]))].sort()
				if (!sameMembers(declared, used)) fail(`${file}: ${key} ${locale} params ${JSON.stringify(used)} do not match ${JSON.stringify(declared)}`)
			}
			catalog[key] = Object.freeze({
				params: Object.freeze(params.slice()),
				"zh-CN": message["zh-CN"],
				en: message.en,
			})
		}
	}
	return Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)))
}

function sourceFiles(directory) {
	const result = []
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if ([".git", "node_modules", "locales"].includes(entry.name)) continue
		const file = path.join(directory, entry.name)
		if (entry.isDirectory()) result.push(...sourceFiles(file))
		else if (/\.(?:html|js)$/.test(entry.name) && file !== OUTPUT) result.push(file)
	}
	return result
}

function validateReferences(catalog) {
	const namespaces = [...new Set(Object.keys(catalog).map((key) => key.split(/[._]/, 1)[0]))].sort()
	const namespacePattern = namespaces.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
	const messageReference = new RegExp("([\"'`])((?:" + namespacePattern + ")\\.[a-z0-9_.]+)\\1", "g")
	for (const file of sourceFiles(ROOT)) {
		const source = fs.readFileSync(file, "utf8")
		if (file === path.join(ROOT, "play.js") && HAN.test(source)) fail("play.js contains hard-coded Han text; add a locale message key")
		if (file.includes(`${path.sep}modules${path.sep}`) && /\.join\((["'])、\1\)/.test(source)) fail(`${path.relative(ROOT, file)} joins a user-visible list with a fixed Chinese separator; use I18n.list`)
		for (const match of source.matchAll(messageReference)) {
			if (/\.(?:csv|css|html|jpg|js|json|md|pdf|png|webp)$/.test(match[2])) continue
			if (catalog[match[2]]) continue
			const line = source.slice(0, match.index).split("\n").length
			fail(`${path.relative(ROOT, file)}:${line}: unknown message key ${match[2]}`)
		}
	}
}

function generate(catalog) {
	const json = JSON.stringify(catalog, null, "\t")
	return `"use strict"\n\n;(function initCatalog(root, factory) {\n\tconst catalog = factory()\n\tif (typeof module === "object" && module.exports) module.exports = catalog\n\telse root.BTB_I18N_CATALOG = catalog\n})(typeof globalThis === "object" ? globalThis : this, function createCatalog() {\n\tconst source = ${json}\n\tfor (const message of Object.values(source)) {\n\t\tObject.freeze(message.params)\n\t\tObject.freeze(message)\n\t}\n\treturn Object.freeze(source)\n})\n`
}

const catalog = loadCatalog()
validateReferences(catalog)
const output = generate(catalog)
if (CHECK) {
	if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== output) fail(`${path.relative(ROOT, OUTPUT)} is stale; run npm run build:i18n`)
	console.log(`Validated ${path.relative(ROOT, OUTPUT)}`)
} else if (fs.existsSync(OUTPUT) && fs.readFileSync(OUTPUT, "utf8") === output) {
	console.log(`Unchanged ${OUTPUT}`)
} else {
	fs.writeFileSync(OUTPUT, output)
	console.log(`Generated ${OUTPUT}`)
}
