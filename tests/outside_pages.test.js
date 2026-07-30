"use strict"

const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const assert = require("node:assert/strict")
const vm = require("node:vm")
const { parseHTML } = require("linkedom")

const ROOT = path.resolve(__dirname, "..")
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8")

test("create page is localized and exposes only implemented options", () => {
	const html = read("create.html")
	assert.match(html, /outside\.css/)
	assert.doesNotMatch(html, /class="campaign-note"/)
	assert.match(html, /id="Campaign"/)
	for (const option of ["ui_locale", "card_language", "disable_optional_rules", "allied_2_24_exclusive_1941", "moscow_trench_axis_rp", "no_invasions_before_summer_42", "time_of_mud", "sunny_italy"]) {
		assert.match(html, new RegExp(`name="${option}"`), option)
	}
	const disableAll = html.match(/<input[^>]*name="disable_optional_rules"[^>]*>/)?.[0]
	assert.ok(disableAll)
	assert.doesNotMatch(disableAll, /\bchecked\b/)
	for (const option of ["allied_2_24_exclusive_1941", "no_invasions_before_summer_42", "time_of_mud", "sunny_italy"]) {
		const input = html.match(new RegExp(`<input[^>]*name="${option}"[^>]*>`))?.[0]
		assert.ok(input, option)
		assert.match(input, /\bchecked\b/, option)
		assert.match(input, /\bdisabled\b/, option)
		assert.match(input, /\bdata-optional-rule\b/, option)
		assert.match(input, /\bdata-default-enabled\b/, option)
	}
	const moscowAxisRp = html.match(/<input[^>]*name="moscow_trench_axis_rp"[^>]*>/)?.[0]
	assert.ok(moscowAxisRp)
	assert.match(moscowAxisRp, /\bdata-optional-rule\b/)
	assert.doesNotMatch(moscowAxisRp, /\bdata-default-enabled\b|\bchecked\b|\bdisabled\b/)
	assert.match(html, /control\.disabled = disableOptionalRules\.checked \|\| defaultEnabled/)
	assert.doesNotMatch(html, /name="english_cards"/)
	assert.match(html, /class="option-help-popup"/)
	assert.match(html, /select\[name='scenario'\]/)
})

test("create page requires AX +2 RP to be selected separately from the default optional rules", () => {
	const html = read("create.html")
	const { window } = parseHTML(`<html><body>${html}</body></html>`)
	Object.defineProperty(window, "localStorage", {
		value: { getItem: () => null, setItem: () => {} },
		configurable: true,
	})
	window.BTBI18N = {
		setLocale: () => {},
		translateDocument: () => {},
	}
	const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
	assert.ok(script)
	vm.runInContext(script, vm.createContext(window))

	const disableAll = window.document.querySelector('input[name="disable_optional_rules"]')
	const optionalRules = [...window.document.querySelectorAll("input[data-optional-rule]")]
	const defaultRules = optionalRules.filter((control) => control.hasAttribute("data-default-enabled"))
	const moscowAxisRp = window.document.querySelector('input[name="moscow_trench_axis_rp"]')
	assert.equal(optionalRules.length, 5)
	assert.equal(defaultRules.length, 4)
	assert.equal(
		defaultRules.every((control) => control.checked && control.disabled),
		true,
	)
	assert.equal(moscowAxisRp.checked, false)
	assert.equal(moscowAxisRp.disabled, false)
	moscowAxisRp.checked = true
	assert.equal(moscowAxisRp.checked, true)

	disableAll.checked = true
	disableAll.dispatchEvent(new window.Event("change"))
	assert.equal(
		optionalRules.every((control) => !control.checked && control.disabled),
		true,
	)

	disableAll.checked = false
	disableAll.dispatchEvent(new window.Event("change"))
	assert.equal(
		defaultRules.every((control) => control.checked && control.disabled),
		true,
	)
	assert.equal(moscowAxisRp.checked, false)
	assert.equal(moscowAxisRp.disabled, false)
})

test("about page presents finished game information, credits, and local reference links", () => {
	const html = read("about.html")
	assert.match(html, /德军越过苏联国境的黎明/)
	assert.match(html, /每一步推进都伴随着代价/)
	assert.doesNotMatch(html, /class="campaign-note"|《光荣之路》|建立在.*系统之上/)
	assert.match(html, /Ted Raicer/)
	assert.match(html, /Rodger B\. MacGowan/)
	assert.doesNotMatch(html, /当前开发|持续实现|用于本地规则与交互审视/)

	const links = [...html.matchAll(/href="\/barbarossa-to-berlin\/([^"?]+)(?:\?[^"\s]*)?"/g)]
	assert.ok(links.length >= 5)
	for (const [, target] of links) {
		assert.equal(fs.existsSync(path.join(ROOT, decodeURIComponent(target))), true, target)
	}
	assert.doesNotMatch(html, /notes\.html|游戏与模块说明/)
})

test("localized external references cover rules, charts, decks, and pieces", () => {
	for (const file of ["info/rules.html", "info/charts.html", "info/cards.html", "info/pieces.html", "info/info.css"]) {
		assert.equal(fs.existsSync(path.join(ROOT, file)), true, file)
	}

	assert.match(read("info/rules.html"), /BtB%20rules-2006\.pdf/)
	assert.match(read("info/charts.html"), /BtB_Chart-Combat\.png/)
	assert.match(read("info/charts.html"), /BtB_Chart-Other\.png/)
	assert.match(read("info/cards.html"), /data\.cards/)
	assert.match(read("info/cards.html"), /cards\.\$\{language\}/)
	assert.doesNotMatch(read("info/cards.html"), /card-caption/)
	assert.match(read("info/pieces.html"), /data\.pieces/)
	assert.equal(fs.existsSync(path.join(ROOT, "info/notes.html")), false)
	for (const file of ["info/cards.html", "info/charts.html", "info/pieces.html"]) assert.doesNotMatch(read(file), /notes\.html/)
})

test("Rally title registration points to the BTB BoardGameGeek entry", () => {
	assert.match(read("tools/integrate_rally.js"), /"WWII: Barbarossa to Berlin", 3353/)
})

test("in-game reference menu points to the same external information pages", () => {
	const html = read("play.html")
	for (const target of ["info/rules.html", "info/charts.html", "info/cards.html?side=allied", "info/cards.html?side=axis", "info/pieces.html"]) {
		assert.match(html, new RegExp(target.replace(/[?.]/g, "\\$&")), target)
	}
})
