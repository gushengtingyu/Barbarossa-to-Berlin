"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const { parseHTML } = require("linkedom")
const I18n = require("../modules/core/i18n.js")
const State = require("../modules/core/state.js")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")
const { runFuzz } = require("./runtime_fuzz_loop.js")

const HAN = /[\u3400-\u9fff]/
const BILINGUAL_MESSAGE_KEYS = new Set(["create.interface_language"])

function untranslatedDocumentText(document) {
	const values = []
	for (const element of document.querySelectorAll("body *:not(script):not(style)")) {
		const bilingualText = BILINGUAL_MESSAGE_KEYS.has(element.getAttribute("data-i18n"))
		for (const node of element.childNodes) if (!bilingualText && node.nodeType === 3 && HAN.test(node.nodeValue || "")) values.push(node.nodeValue.trim())
		for (const name of ["title", "aria-label", "alt", "placeholder"]) {
			const value = element.getAttribute(name)
			if (value && HAN.test(value)) values.push(`${name}:${value}`)
		}
	}
	return [...new Set(values.filter(Boolean))]
}

function translatedDocument(file) {
	const { document } = parseHTML(`<html><body>${fs.readFileSync(file, "utf8")}</body></html>`)
	I18n.setLocale("en")
	I18n.translateDocument(document)
	return document
}

function loadEnglishFrontend() {
	const { window } = parseHTML(fs.readFileSync("play.html", "utf8"))
	Object.defineProperty(window, "localStorage", {
		value: { getItem: () => null, setItem: () => {} },
		configurable: true,
	})
	window.BTB_DATA = Engine.data
	window.view = {}
	window.send_action = () => {}
	window.action_button = () => {}
	window.innerWidth = 1200
	window.HTMLElement.prototype.scrollIntoView = () => {}
	const context = vm.createContext(window)
	vm.runInContext(fs.readFileSync("modules/core/i18n_catalog.js", "utf8"), context)
	vm.runInContext(fs.readFileSync("modules/core/i18n.js", "utf8"), context)
	vm.runInContext(fs.readFileSync("play.js", "utf8"), context)
	vm.runInContext(`on_init("Campaign", { ui_locale: "en", card_language: "EN" }); BTBI18N.translateDocument(document)`, context)
	return window.document
}

test("language and card-art options are independent and use one authoritative card-language field", () => {
	assert.deepEqual(State.normalizeOptions({ card_language: "EN" }), {
		ui_locale: "zh-CN",
		card_language: "EN",
		allied_2_24_exclusive_1941: false,
		moscow_trench_axis_rp: false,
		no_invasions_before_summer_42: false,
		sunny_italy: false,
		time_of_mud: false,
	})
	const enabledAx2 = State.normalizeOptions({ moscow_trench_axis_rp: "true" })
	assert.equal(enabledAx2.moscow_trench_axis_rp, true)
	for (const name of ["allied_2_24_exclusive_1941", "no_invasions_before_summer_42", "sunny_italy", "time_of_mud"]) assert.equal(enabledAx2[name], false, name)
	assert.equal(Object.hasOwn(enabledAx2, "disable_optional_rules"), false)
	const options = State.normalizeOptions({ ui_locale: "en-US", card_language: "CN" })
	assert.equal(options.ui_locale, "en")
	assert.equal(options.card_language, "CN")
	assert.equal(Object.hasOwn(options, "english_cards"), false)
})

test("interface-language selector remains bilingual in every locale", () => {
	const label = "界面语言（UI language）："
	assert.equal(I18n.render("zh-CN", "create.interface_language"), label)
	assert.equal(I18n.render("en", "create.interface_language"), label)
})

test("English state prompts and logs are localized at their central boundaries", () => {
	const english = rules.setup(1, "Campaign", { ui_locale: "en" })
	const chinese = rules.setup(1, "Campaign", { ui_locale: "zh-CN" })
	assert.equal(rules.view(english, "Axis").prompt, "Deploy the German 1st and 7th Armies in separate Occupied France spaces.")
	assert.match(rules.view(chinese, "Axis").prompt, HAN)
	State.log(english, "event.log.vp_plus_one", { vp: 8 })
	assert.equal(I18n.render("en", english.log.at(-1)), "Axis VP +1, now 8.")
})

test("message descriptors reject missing, extra, and non-persistable undefined parameters", () => {
	assert.throws(() => I18n.message("event.log.vp_plus_one"), /missing param vp/)
	assert.throws(() => I18n.message("event.log.vp_plus_one", { vp: undefined }), /must not be undefined/)
	assert.throws(() => I18n.message("event.log.vp_plus_one", { vp: 8, extra: true }), /unexpected param extra/)
	assert.throws(() => I18n.message("core.blank", {}, "*"), /unknown format/)
	assert.throws(() => I18n.list(["P1", undefined]), /must not contain undefined/)
})

test("localized lists remain semantic and JSON-persistable until view rendering", () => {
	const descriptor = I18n.message("combat.log.defenders", {
		pieces: I18n.list(["P1", "P2", I18n.message("core.role.axis")]),
	})
	const persisted = JSON.parse(JSON.stringify(descriptor))
	assert.equal(I18n.render("zh-CN", persisted), "P1、P2、轴心国")
	assert.equal(I18n.render("en", persisted), "P1, P2, Axis")
})

test("nested semantic messages compose without leaking source-language fragments", () => {
	const cardAction = I18n.message("action.log.card", {
		card: "C42",
		usage: I18n.message("action.usage.ops", { ops: 4 }),
	})
	assert.equal(I18n.render("en", cardAction), "C42 -- Operations (4)")
	assert.equal(I18n.render("zh-CN", cardAction), "C42 -- 行动点（4）")

	const fireSummary = I18n.message("combat.fire_summary.shifted", {
		strength: 8,
		table: "LCU",
		column: 6,
	})
	assert.equal(I18n.render("en", fireSummary), "8 CF (LCU→column 6)")
	assert.equal(I18n.render("zh-CN", fireSummary), "8 CF（LCU→6列）")
})

test("locale changes presentation without changing initial rules state", () => {
	const chinese = rules.setup(919, "Campaign", { ui_locale: "zh-CN", card_language: "CN" })
	const english = rules.setup(919, "Campaign", { ui_locale: "en", card_language: "EN" })
	delete chinese.options
	delete english.options
	assert.deepEqual(english, chinese)
})

test("English title-owned static pages contain no untranslated visible Chinese", () => {
	for (const file of ["play.html", "create.html", "about.html", "info/charts.html", "info/cards.html", "info/pieces.html"]) {
		const gaps = untranslatedDocumentText(translatedDocument(file))
		assert.deepEqual(gaps, [], `${file}: ${gaps.join(" | ")}`)
	}
})

test("English reinforcement UI uses English event and unit data", () => {
	const document = loadEnglishFrontend()
	const gaps = untranslatedDocumentText(document.getElementById("reinforcements").ownerDocument)
	assert.deepEqual(gaps, [], gaps.join(" | "))
	assert.match(document.getElementById("reinforcement_board").getAttribute("aria-label"), /reinforcement chart/i)
	assert.match(document.querySelector(".reinforcement_caption").textContent, /Printed reinforcement chart/)
	assert.match(document.querySelector('.reinforcement_card_hotspot[data-card-id="2"]').getAttribute("aria-label"), /Reinforcements/)
})

test("deterministic English runtime walk has fully translated prompts and logs", () => {
	const result = runFuzz({ maxSteps: 500, gameOptions: { ui_locale: "en", card_language: "EN" } })
	assert.ok(result.actions > 0)
})
