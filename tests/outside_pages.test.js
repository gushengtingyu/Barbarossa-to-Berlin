"use strict"

const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const assert = require("node:assert/strict")

const ROOT = path.resolve(__dirname, "..")
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8")

test("create page is localized and exposes only implemented options", () => {
	const html = read("create.html")
	assert.match(html, /outside\.css/)
	assert.doesNotMatch(html, /class="campaign-note"/)
	assert.match(html, /id="Campaign"/)
	for (const option of ["ui_locale", "card_language", "allied_2_24_exclusive_1941", "no_invasions_before_summer_42", "time_of_mud", "sunny_italy"]) {
		assert.match(html, new RegExp(`name="${option}"`), option)
	}
	assert.doesNotMatch(html, /name="english_cards"/)
	assert.match(html, /class="option-help-popup"/)
	assert.match(html, /select\[name='scenario'\]/)
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
