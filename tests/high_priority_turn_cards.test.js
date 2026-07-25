"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { ALLIED, AXIS } = Engine.constants
const { data } = Engine

function campaign(seed) {
	return Engine.setup.createInitialState(data, "Campaign", seed, {})
}

test("National Redoubt makes Munich a required German supply space for Allied automatic victory", () => {
	const game = campaign(301)
	const germanSupply = data.spaces.filter((space) => space?.kind === "land" && space.nation === "ge" && space.supply === "axis")
	const munich = data.spaces.find((space) => space?.name === "Munich")

	for (const space of germanSupply) game.control[space.id] = ALLIED
	game.control[munich.id] = AXIS
	assert.equal(Engine.turn.alliedControlsAllGermanSupplySpaces(game), true)

	game.events.national_redoubt = true
	game.events.national_redoubt_space = munich.id
	assert.equal(Engine.turn.alliedControlsAllGermanSupplySpaces(game), false)

	game.control[munich.id] = ALLIED
	assert.equal(Engine.turn.alliedControlsAllGermanSupplySpaces(game), true)
})

test("normal turn resolves Axis attrition between the sixth Axis and Allied actions", () => {
	let game = campaign(302)
	game.turn = 2
	game.action_round = 5
	game.orders = {
		axis: { result: "none", fulfilled: true },
		allied: { result: "none", fulfilled: true },
		placements: [],
	}

	Engine.turn.startAction(game, AXIS, 6)
	game.action = { mode: "ops", track: "ops" }
	Engine.turn.finishAction(game, AXIS)
	assert.equal(game.phase, "attrition")
	assert.equal(game.state, "axis_attrition")
	assert.equal(game.active, "Axis")

	game = rules.action(game, "Axis", "continue")
	assert.equal(game.phase, "action")
	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Allied")
	assert.equal(game.action_round, 6)
	assert.equal(game.resume_allied_action_after_axis_attrition, undefined)

	const suppliedSoviet = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "lcu" && Number.isInteger(game.pieces[piece.id]) && Engine.map.pieceSupplyStatus(game, data, Engine.adjacency, piece.id) !== "oos")
	assert.ok(suppliedSoviet)
	game.reduced.push(suppliedSoviet.id)
	game.rp.su = 1

	game.action = { mode: "ops", track: "ops" }
	Engine.turn.finishAction(game, ALLIED)
	assert.equal(game.phase, "attrition")
	assert.equal(game.state, "allied_attrition")
	assert.equal(game.active, "Allied")

	game = rules.action(game, "Allied", "continue")
	assert.equal(game.phase, "replacement")
	assert.equal(game.state, "allied_replacements")

	game = rules.action(game, "Allied", "done")
	assert.equal(game.phase, "draw")
	assert.equal(game.state, "draw_discard_allied")
})

test("provisional Yellow events grant OPS only in their printed circumstances outside Spring Thaw", () => {
	const game = campaign(303)
	game.turn = 6
	game.action_round = 3

	game.events.wolfpacks_turn = 2
	assert.equal(Engine.events.eventOpsValue(game, data, 6), 4)
	delete game.events.wolfpacks_turn
	assert.equal(Engine.events.eventOpsValue(game, data, 6), 0)

	assert.equal(Engine.events.eventOpsValue(game, data, 46), 3)
	game.events.overlord = true
	assert.equal(Engine.events.eventOpsValue(game, data, 46), 0)

	game.event = { card_id: 52, invasion: true }
	assert.equal(Engine.events.eventOpsValue(game, data, 52), 4)
	game.event = { card_id: 52, reinforcement: true }
	assert.equal(Engine.events.eventOpsValue(game, data, 52), 0)
	delete game.events.overlord
	game.event = { card_id: 52, invasion: true }
	assert.equal(Engine.events.eventOpsValue(game, data, 52), 0)

	game.turn = 5
	game.action_round = 1
	game.events.wolfpacks_turn = 2
	assert.equal(Engine.events.eventOpsValue(game, data, 6), 0)
	assert.equal(Engine.events.eventOpsValue(game, data, 46), 0)
	game.events.overlord = true
	assert.equal(Engine.events.eventOpsValue(game, data, 52), 0)
})
