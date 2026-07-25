"use strict"

;(function initI18n(root, factory) {
	const catalog = typeof module === "object" && module.exports ? require("./i18n_catalog.js") : root.BTB_I18N_CATALOG
	const api = factory(catalog)
	if (typeof module === "object" && module.exports) module.exports = api
	else root.BTBI18N = api
})(typeof globalThis === "object" ? globalThis : this, function createI18n(catalog) {
	if (!catalog || typeof catalog !== "object") throw new Error("BTB i18n catalog is not loaded")

	const DEFAULT_LOCALE = "zh-CN"
	const SUPPORTED_LOCALES = Object.freeze(["zh-CN", "en"])
	const TOKEN_PATTERN = /\{([a-z][a-z0-9_]*)\}/gi
	const FORMATS = new Set(["", "bold", "detail", "detail2", "strong", "heading_allied", "heading_axis", "h1", "h2", "h3_allied", "h3_axis"])
	const compiled = new Map()
	let currentLocale = DEFAULT_LOCALE

	function normalizeLocale(value) {
		const locale = String(value || "").trim().toLowerCase()
		return locale === "en" || locale.startsWith("en-") ? "en" : DEFAULT_LOCALE
	}

	function compile(template) {
		if (compiled.has(template)) return compiled.get(template)
		const parts = []
		let offset = 0
		for (const match of template.matchAll(TOKEN_PATTERN)) {
			if (match.index > offset) parts.push(template.slice(offset, match.index))
			parts.push(Object.freeze({ param: match[1] }))
			offset = match.index + match[0].length
		}
		if (offset < template.length) parts.push(template.slice(offset))
		const result = Object.freeze(parts)
		compiled.set(template, result)
		return result
	}

	function definition(key) {
		const value = catalog[key]
		if (!value) throw new Error(`unknown i18n message key: ${key}`)
		return value
	}

	function validateParams(key, spec, params) {
		if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error(`i18n message ${key} params must be an object`)
		const expected = spec.params
		const actual = Object.keys(params)
		for (const name of expected) {
			if (!(name in params)) throw new Error(`i18n message ${key} is missing param ${name}`)
			if (params[name] === undefined) throw new Error(`i18n message ${key} param ${name} must not be undefined`)
		}
		for (const name of actual) if (!expected.includes(name)) throw new Error(`i18n message ${key} has unexpected param ${name}`)
	}

	function message(key, params = {}, format = "") {
		const spec = definition(key)
		validateParams(key, spec, params)
		if (!FORMATS.has(format)) throw new Error(`i18n message ${key} has unknown format ${String(format)}`)
		return { key, params: { ...params }, ...(format ? { format } : {}) }
	}

	function localized(zh, en) {
		return { "zh-CN": String(zh ?? ""), en: String(en ?? zh ?? "") }
	}

	function list(items) {
		if (!Array.isArray(items)) throw new Error("i18n list items must be an array")
		if (items.some((item) => item === undefined)) throw new Error("i18n list items must not contain undefined")
		return { i18n_list: items.slice() }
	}

	function renderParam(locale, value) {
		if (value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.i18n_list)) {
			const separator = normalizeLocale(locale) === "en" ? ", " : "、"
			return value.i18n_list.map((item) => renderParam(locale, item)).join(separator)
		}
		if (value && typeof value === "object" && !Array.isArray(value) && Object.hasOwn(value, "zh-CN") && Object.hasOwn(value, "en")) return String(value[normalizeLocale(locale)] ?? "")
		if (value && typeof value === "object" && !Array.isArray(value) && typeof value.key === "string") return render(locale, value)
		return String(value ?? "")
	}

	function render(locale, value, params = undefined) {
		const entry = typeof value === "string" ? message(value, params || {}) : value
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("i18n message must be a key or descriptor")
		const spec = definition(entry.key)
		validateParams(entry.key, spec, entry.params || {})
		const template = spec[normalizeLocale(locale)]
		let output = ""
		for (const part of compile(template)) output += typeof part === "string" ? part : renderParam(locale, entry.params[part.param])
		switch (entry.format) {
			case "bold":
				return `*${output}`
			case "detail":
				return `> ${output}`
			case "detail2":
				return `>> ${output}`
			case "strong":
				return `**${output}**`
			case "heading_allied":
				return `#ap ${output}`
			case "heading_axis":
				return `#cp ${output}`
			case "h1":
				return `.h1${output}`
			case "h2":
				return `.h2${output}`
			case "h3_allied":
				return `.h3ap${output}`
			case "h3_axis":
				return `.h3cp${output}`
			default:
				return `${entry.format || ""}${output}`
		}
	}

	function setLocale(value) {
		currentLocale = normalizeLocale(value)
		return currentLocale
	}

	function getLocale() {
		return currentLocale
	}

	function translateElement(element) {
		const key = element.getAttribute("data-i18n")
		if (key) element.textContent = render(currentLocale, key)
		for (const name of ["title", "aria-label", "alt", "placeholder"]) {
			const attributeKey = element.getAttribute(`data-i18n-${name}`)
			if (attributeKey) element.setAttribute(name, render(currentLocale, attributeKey))
		}
	}

	function translateDocument(document) {
		const root = document?.documentElement || document
		if (!root) return
		if (root.nodeType === 1) translateElement(root)
		for (const element of root.querySelectorAll?.("[data-i18n], [data-i18n-title], [data-i18n-aria-label], [data-i18n-alt], [data-i18n-placeholder]") || []) translateElement(element)
		if (document?.documentElement) document.documentElement.lang = currentLocale
	}

	function setText(element, key, params = {}) {
		if (element) element.textContent = render(currentLocale, key, params)
		return element
	}

	function setAttribute(element, name, key, params = {}) {
		if (element) element.setAttribute(name, render(currentLocale, key, params))
		return element
	}

	return Object.freeze({
		DEFAULT_LOCALE,
		SUPPORTED_LOCALES,
		getLocale,
		list,
		localized,
		message,
		normalizeLocale,
		render,
		setAttribute,
		setLocale,
		setText,
		translateDocument,
	})
})
