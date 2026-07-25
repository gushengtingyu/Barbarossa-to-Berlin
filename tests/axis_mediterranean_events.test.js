"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine

function prepareAction(cardId, seed, turn = 6) {
	const game = rules.setup(seed, "Campaign", {})
	game.turn = turn
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

test("Italian Naval Sortie grants only its turn's North Africa sea supply and offers one optional map marker", () => {
	let game = prepareAction(66, 6600)
	const tripoli = space("Tripoli")
	assert.equal(Engine.map.traceSupply(game, data, Engine.adjacency, "axis", tripoli, "ge"), "limited")

	game = rules.action(game, "Axis", "play_event", 66)
	assert.equal(game.state, "event_axis_marker_space")
	assert.equal(Engine.map.traceSupply(game, data, Engine.adjacency, "axis", tripoli, "ge"), "full")
	const target = rules.view(game, "Axis").actions.space[0]
	game = rules.action(game, "Axis", "space", target)
	assert.equal(game.state, "event_axis_marker_type")
	assert.equal(rules.view(game, "Axis").action.event_space, target)
	game = rules.action(game, "Axis", "pass")
	assert.equal(game.state, "event_axis_marker_space")
	game = rules.action(game, "Axis", "space", target)
	game = rules.action(game, "Axis", "move_marker")
	assert.equal(game.state, "ops_move")
	assert.deepEqual(game.action.move_spaces, [target])

	game.turn++
	assert.equal(Engine.map.traceSupply(game, data, Engine.adjacency, "axis", tripoli, "ge"), "limited")
})

test("Herkules captures Malta, eliminates its Allied units, and loses its supply effect if Malta is retaken", () => {
	let game = prepareAction(76, 7600)
	const malta = space("Malta")
	const tripoli = space("Tripoli")
	const alliedScu = data.pieces.find((entry) => entry?.side === "allied" && entry.size === "scu").id
	game.pieces[alliedScu] = malta

	game = rules.action(game, "Axis", "play_event", 76)
	assert.equal(game.control[malta], "axis")
	assert.equal(game.pieces[alliedScu], Engine.unitLocations.eliminated("allied"))
	assert.equal(Engine.map.traceSupply(game, data, Engine.adjacency, "axis", tripoli, "ge"), "full")

	game.control[malta] = "allied"
	assert.equal(Engine.map.traceSupply(game, data, Engine.adjacency, "axis", tripoli, "ge"), "limited")

	const blocked = prepareAction(76, 7601)
	blocked.control[space("Benghazi")] = "allied"
	assert.equal(Engine.events.canPlayEvent(blocked, data, 76), false)

	const controlOnly = prepareAction(76, 7602)
	controlOnly.control[malta] = "axis"
	delete controlOnly.events.herkules
	assert.equal(Engine.map.traceSupply(controlOnly, data, Engine.adjacency, "axis", tripoli, "ge"), "full")
})

test("Axis Satellites deploys the printed Italian and Hungarian Armies even with target Partisans", () => {
	let game = prepareAction(78, 7800)
	const kiev = space("Kiev")
	const odessa = space("Odessa")
	for (const mapSpace of data.spaces) if (mapSpace?.kind === "land") game.control[mapSpace.id] = "axis"
	for (let pieceId = 1; pieceId < game.pieces.length; pieceId++) {
		if ([kiev, odessa].includes(game.pieces[pieceId])) game.pieces[pieceId] = Engine.unitLocations.eliminated(data.pieces[pieceId].side)
	}
	game.partisans = [odessa]

	assert.equal(Engine.events.canPlayEvent(game, data, 78), true)
	game = rules.action(game, "Axis", "play_event", 78)
	assert.equal(game.pieces[piece("IT 8 Army")], odessa)
	assert.equal(game.pieces[piece("HU 2 Army")], kiev)
	assert.equal(game.partisans.includes(odessa), true)
	assert.equal(game.events.axis_satellites, true)
})

test("Achse unlocks German Army movement south of Bologna-La Spezia from Messina control or an M/O/R/T invasion", () => {
	let game = prepareAction(86, 8600)
	const germanArmy = piece("GE 4 Panzer Army")
	const naples = space("Naples")
	assert.equal(Engine.restrictions.mayEnter(game, data, Engine.adjacency, germanArmy, naples), false)
	game.control[space("Messina")] = "allied"
	game = rules.action(game, "Axis", "play_event", 86)
	assert.equal(game.state, "ops_activate")
	assert.equal(Engine.restrictions.mayEnter(game, data, Engine.adjacency, germanArmy, naples), true)

	const invasionTrigger = prepareAction(86, 8601)
	const beachM = data.spaces.find((entry) => entry?.beach_letter === "M").id
	invasionTrigger.beachheads[beachM] = { type: "allied", card_id: 34 }
	assert.equal(Engine.events.canPlayEvent(invasionTrigger, data, 86), true)
})
