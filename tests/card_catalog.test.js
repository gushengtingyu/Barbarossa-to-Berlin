"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { catalog } = require("../tools/import_rulebook_cards.js")

test("rulebook card catalog covers both 55-card decks", () => {
	const cards = catalog()
	assert.equal(cards.length, 110)
	assert.equal(new Set(cards.map((card) => `${card.side}:${card.num}`)).size, 110)
	for (const card of cards) {
		if (card.side === "allied") assert.ok(card.rp_br >= 1 && card.rp_usa >= 1 && card.rp_su >= 2)
		else assert.ok(card.rp_ge >= 2 && card.rp_axis >= 0)
	}
	const barbarossa = cards.find((card) => card.side === "axis" && card.num === 1)
	assert.equal(barbarossa.name, "Barbarossa")
	assert.equal(barbarossa.ops, 5)
	assert.equal(barbarossa.remove, true)
	const partisans = cards.find((card) => card.side === "allied" && card.num === 19)
	assert.equal(partisans.name, "Partisans")
	assert.equal(partisans.ops, 3)
})
