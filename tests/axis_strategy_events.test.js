"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine

function freshGame(seed = 6700) {
	const game = rules.setup(seed, "Campaign", {})
	game.turn = 5
	game.action_round = 2
	game.vp = 10
	return game
}

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

test("Nordlicht is barred during Spring Thaw and restricts only its play round to Leningrad", () => {
	const game = freshGame()
	const leningrad = space("Leningrad")
	const moscow = space("Moscow")
	game.turn = 5
	game.action_round = 1
	assert.equal(Engine.events.canPlayEvent(game, data, 67), false)

	game.action_round = 3
	assert.equal(Engine.events.canPlayEvent(game, data, 67), true)
	Engine.events.playEvent(game, data, 67)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", leningrad), true)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", moscow), false)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", space("Smolensk")), false)

	game.action_round = 4
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", leningrad), true)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", space("Smolensk")), true)
})

test("Fall Blau requires Hitler Takes Command and unlocks all Blau objectives with five marked attacks", () => {
	const game = freshGame(6900)
	for (const name of ["Stalingrad", "Maikop", "Armavir"]) assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", space(name)), false)
	assert.equal(Engine.events.canPlayEvent(game, data, 69), false)

	Engine.events.playEvent(game, data, 64)
	assert.equal(Engine.events.canPlayEvent(game, data, 69), true)
	Engine.events.playEvent(game, data, 69)
	for (const name of ["Stalingrad", "Maikop", "Armavir"]) assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", space(name)), true)
	assert.equal(game.event.combat_markers, 5)
	assert.deepEqual(game.event.attack_modifier, {
		attacker_side: "axis",
		defender_nations: ["su"],
		drm: 1,
		no_retreat: false,
	})
})

test("Totaler Krieg requires Hitler, awards the conditional 20 VP, disables Automatic Victory, and delays the Panzer cap", () => {
	const game = freshGame(8100)
	game.vp = 11
	assert.equal(Engine.events.canPlayEvent(game, data, 81), false)
	Engine.events.playEvent(game, data, 64)
	Engine.events.playEvent(game, data, 81)

	assert.equal(game.vp, 31)
	assert.equal(game.events.totaler_krieg_turn, 5)
	assert.equal(Engine.turn.checkAutomaticVictory(game), false)
	assert.equal(Engine.logistics.panzerReplacementLimit(game), 2)
	game.turn = 6
	assert.equal(Engine.logistics.panzerReplacementLimit(game), 3)

	const lowVp = freshGame(8101)
	Engine.events.playEvent(lowVp, data, 64)
	Engine.events.playEvent(lowVp, data, 81)
	assert.equal(lowVp.vp, 10)
})

test("Stuka is a dual event only in the printed 1941-43 Summer and Fall turns", () => {
	const game = freshGame(8000)
	for (const turn of [2, 3, 6, 7, 10, 11]) {
		game.turn = turn
		assert.equal(Engine.events.canPlayEvent(game, data, 80), true)
	}
	for (const turn of [1, 4, 5, 8, 9, 12, 14]) {
		game.turn = turn
		assert.equal(Engine.events.canPlayEvent(game, data, 80), false)
	}
	game.turn = 7
	Engine.events.playEvent(game, data, 80)
	assert.equal(Engine.events.eventOpsValue(game, data, 80), 4)
	assert.deepEqual(game.event.attack_modifier, {
		attacker_side: "axis",
		nations: ["ge"],
		defender_nations: ["su"],
		drm: 1,
		no_retreat: false,
	})
})

test("Skorzeny requires Achse or Allied Rome control, while Vergeltungs-Waffe always adds one VP", () => {
	const game = freshGame(8300)
	const rome = space("Rome")
	assert.equal(Engine.events.canPlayEvent(game, data, 83), false)
	game.control[rome] = "allied"
	assert.equal(Engine.events.canPlayEvent(game, data, 83), true)
	Engine.events.playEvent(game, data, 83)
	assert.equal(game.vp, 11)

	Engine.events.playEvent(game, data, 100)
	assert.equal(game.vp, 12)
	assert.equal(game.events.vergeltungs_waffe, true)

	const achse = freshGame(8301)
	achse.events.achse = true
	assert.equal(Engine.events.canPlayEvent(achse, data, 83), true)
})
