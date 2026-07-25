"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine

function prepareAction(cardId, seed) {
	const game = rules.setup(seed, "Campaign", {})
	game.turn = 6
	game.action_round = 3
	game.phase = "action"
	game.state = "action_select"
	game.active = "Axis"
	game.action_history = { allied: [], axis: [] }
	game.hands.axis = [cardId]
	return game
}

function piece(name) {
	return data.pieces.find((entry) => entry?.name === name).id
}

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

test("Panzer Refit uses reversible map selection and blocks affected activation spaces", () => {
	let game = prepareAction(61, 6100)
	const panzers = [piece("GE 4 Panzer Army"), piece("GE 3 Panzer Army"), piece("GE 2 Panzer Army")]
	for (const pieceId of panzers) if (!game.reduced.includes(pieceId)) game.reduced.push(pieceId)

	game = rules.action(game, "Axis", "play_event", 61)
	assert.equal(game.state, "event_panzer_refit")
	assert.equal(rules.view(game, "Axis").actions.continue, undefined)
	assert.throws(() => rules.action(game, "Axis", "piece", 1), /illegal action/)

	game = rules.action(game, "Axis", "piece", panzers[0])
	assert.deepEqual(rules.view(game, "Axis").event_selection.panzer_refit_pieces, [panzers[0]])
	game = rules.action(game, "Axis", "piece", panzers[0])
	assert.deepEqual(rules.view(game, "Axis").event_selection.panzer_refit_pieces, [])
	for (const pieceId of panzers) game = rules.action(game, "Axis", "piece", pieceId)
	assert.equal(rules.view(game, "Axis").actions.continue, 1)

	const blocked = [...new Set(panzers.map((pieceId) => game.pieces[pieceId]))]
	game = rules.action(game, "Axis", "continue")
	assert.equal(game.state, "ops_activate")
	assert.equal(
		panzers.some((pieceId) => game.reduced.includes(pieceId)),
		false,
	)
	assert.deepEqual(
		game.event.blocked_activation_spaces.slice().sort((a, b) => a - b),
		blocked.slice().sort((a, b) => a - b),
	)
	for (const spaceId of blocked) {
		assert.equal(rules.view(game, "Axis").actions.space?.includes(spaceId) || false, false)
		assert.equal(rules.view(game, "Axis").actions.attack?.includes(spaceId) || false, false)
	}
})

test("Hedgehogs selects three Full Supply German Army spaces, places trenches together, and grants No Retreat", () => {
	let game = prepareAction(62, 6200)
	const armies = [piece("GE 4 Panzer Army"), piece("GE 3 Panzer Army"), piece("GE 2 Panzer Army")]
	const spaces = [space("Kaunas"), space("Courland"), space("Kolomyja")]
	for (let index = 0; index < spaces.length; index++) {
		game.pieces[armies[index]] = spaces[index]
		game.control[spaces[index]] = "axis"
		delete game.trench[spaces[index]]
		delete game.trench_owner[spaces[index]]
	}

	game = rules.action(game, "Axis", "play_event", 62)
	assert.equal(game.state, "event_hedgehogs")
	for (const spaceId of spaces) {
		assert.equal(rules.view(game, "Axis").actions.space.includes(spaceId), true)
		game = rules.action(game, "Axis", "space", spaceId)
	}
	assert.deepEqual(rules.view(game, "Axis").event_selection.hedgehog_spaces, spaces)
	assert.equal(rules.view(game, "Axis").actions.continue, 1)
	game = rules.action(game, "Axis", "continue")

	for (const spaceId of spaces) {
		assert.equal(game.trench[spaceId], 1)
		assert.equal(game.trench_owner[spaceId], "axis")
	}
	assert.equal(game.events.hedgehogs_turn, 6)

	const combat = { defender_space: spaces[0], attackers: [], defenders: [armies[0]] }
	const oosMap = { traceSupply: () => "oos", isFortIntactForSide: () => false }
	delete game.trench[spaces[0]]
	delete game.trench_owner[spaces[0]]
	assert.equal(Engine.combat.canCancelRetreat(game, data, oosMap, [], combat), true)
	game.turn = 7
	assert.equal(Engine.combat.canCancelRetreat(game, data, oosMap, [], combat), false)
})

test("Panzer Refit rejects Spring Thaw and OOS Panzers; Hedgehogs requires three eligible spaces", () => {
	const refit = prepareAction(61, 6101)
	for (const pieceId of [piece("GE 4 Panzer Army"), piece("GE 3 Panzer Army"), piece("GE 2 Panzer Army")]) if (!refit.reduced.includes(pieceId)) refit.reduced.push(pieceId)
	refit.turn = 5
	refit.action_round = 1
	assert.equal(Engine.events.canPlayEvent(refit, data, 61), false)

	const hedgehogs = prepareAction(62, 6201)
	assert.equal(Engine.events.canPlayEvent(hedgehogs, data, 62), false)
})
