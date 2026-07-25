"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const Orders = require("../modules/systems/orders.js")
const rules = require("../rules.js")

const { data } = Engine

function freshGame(seed = 5800) {
	const game = rules.setup(seed, "Campaign", {})
	game.turn = 4
	game.action_round = 1
	game.vp = 10
	return game
}

test("OKH Conference is dual-use, prevents Taifun's VP loss, and becomes unavailable after Taifun", () => {
	const game = freshGame()
	assert.equal(Engine.events.canPlayEvent(game, data, 58), true)
	Engine.events.playEvent(game, data, 58)
	assert.equal(game.events.okh_conference, true)
	assert.equal(game.events.okh_conference_turn, 4)
	assert.equal(Engine.events.eventOpsValue(game, data, 58), 2)

	Engine.events.playEvent(game, data, 59)
	assert.equal(game.vp, 10)
	assert.equal(Engine.events.canPlayEvent(game, data, 58), false)
})

test("Taifun unlocks Moscow, applies the printed round modifier, places four markers, and costs 1 VP without OKH", () => {
	const game = freshGame(5900)
	const moscow = data.spaces.find((space) => space?.name === "Moscow").id
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", moscow), false)

	Engine.events.playEvent(game, data, 59)
	assert.equal(game.vp, 9)
	assert.equal(game.events.taifun, true)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", moscow), true)
	assert.equal(game.event.combat_markers, 4)
	assert.deepEqual(game.event.attack_modifier, {
		attacker_side: "axis",
		defender_nations: ["su"],
		drm: 1,
		no_retreat: false,
	})
})

test("Hitler Takes Command persists its unlock and adds +2 DRM to Axis Orders rolls", () => {
	const baseline = freshGame(6400)
	const commanded = freshGame(6400)
	Engine.events.playEvent(commanded, data, 64)
	baseline.orders = { axis: null, allied: null }
	commanded.orders = { axis: null, allied: null }

	const raw = Orders.rollAxis(baseline)
	const modified = Orders.rollAxis(commanded)
	assert.equal(commanded.events.hitler_takes_command, true)
	assert.equal(modified.die, raw.die)
	assert.equal(modified.modifier, 2)
	assert.equal(modified.modified_die, Math.min(6, raw.die + 2))
	assert.notEqual(modified.result, "none")
})
