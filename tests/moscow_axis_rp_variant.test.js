"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const rules = require("../rules.js")
const { data } = require("../data.js")
const Engine = require("../modules/engine.js")

const MOSCOW = Engine.constants.MOSCOW_SPACE_ID

test("Moscow and German armaments variant gives Moscow its initial Soviet trench", () => {
	const enabled = rules.setup(1601, "Campaign", {})
	assert.equal(data.spaces[MOSCOW].name, "Moscow")
	assert.equal(enabled.trench[MOSCOW], 1)
	assert.equal(enabled.trench_owner[MOSCOW], "allied")
	assert.equal(enabled.trench_kind[MOSCOW], "soviet")

	const disabled = rules.setup(1602, "Campaign", { disable_optional_rules: true })
	assert.equal(disabled.trench[MOSCOW], undefined)
})

test("Speer and Totaler Krieg each grant one German RP per replacement phase and stack", () => {
	const game = rules.setup(1603, "Campaign", {})
	game.events.speer = true
	game.events.totaler_krieg = true

	assert.equal(Engine.replacements.awardAxisVariantRp(game), 2)
	assert.equal(game.rp.ge, 2)
	assert.equal(Engine.replacements.awardAxisVariantRp(game), 0)
	assert.equal(game.rp.ge, 2)

	game.turn++
	assert.equal(Engine.replacements.awardAxisVariantRp(game), 2)
	assert.equal(game.rp.ge, 4)
})

test("German armaments RP is conditional on its events and the variant", () => {
	const speer = rules.setup(1604, "Campaign", {})
	speer.events.speer = true
	assert.equal(Engine.replacements.awardAxisVariantRp(speer), 1)
	assert.equal(speer.rp.ge, 1)

	const totalWar = rules.setup(1605, "Campaign", {})
	totalWar.events.totaler_krieg = true
	assert.equal(Engine.replacements.awardAxisVariantRp(totalWar), 1)
	assert.equal(totalWar.rp.ge, 1)

	const disabled = rules.setup(1606, "Campaign", { disable_optional_rules: true })
	disabled.events.speer = true
	disabled.events.totaler_krieg = true
	assert.equal(Engine.replacements.awardAxisVariantRp(disabled), 0)
	assert.equal(disabled.rp.ge, 0)
})

test("German armaments RP is awarded automatically when the replacement phase begins", () => {
	let game = rules.setup(1607, "Campaign", {})
	const germanArmy = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && Number.isInteger(game.pieces[piece.id]) && game.pieces[piece.id] > 0 && !game.reduced.includes(piece.id))
	assert.ok(germanArmy)
	game.reduced.push(germanArmy.id)
	game.events.speer = true
	game.events.totaler_krieg = true
	game.state = "allied_attrition"
	game.active = "Allied"
	game.phase = "end"

	game = rules.action(game, "Allied", "apply_attrition")

	assert.equal(game.state, "axis_replacements")
	assert.equal(game.rp.ge, 2)
	assert.equal(game.replacement_usage.axis_variant_rp_awarded, true)
})
