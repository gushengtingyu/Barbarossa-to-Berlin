"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine

function prepareAction(cardId, seed, turn = 10) {
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

test("Atlantic Wall uses reversible map selection and displays its printed trench counter", () => {
	let game = prepareAction(93, 9300)
	const legal = Engine.events.legalAtlanticWallSpaces(game, data)
	assert.ok(legal.length >= 2)

	game = rules.action(game, "Axis", "play_event", 93)
	assert.equal(game.state, "event_atlantic_wall")
	game = rules.action(game, "Axis", "space", legal[0])
	assert.deepEqual(rules.view(game, "Axis").event_selection.atlantic_wall_spaces, [legal[0]])
	game = rules.action(game, "Axis", "space", legal[0])
	assert.deepEqual(rules.view(game, "Axis").event_selection.atlantic_wall_spaces, [])
	for (const spaceId of legal.slice(0, 2)) game = rules.action(game, "Axis", "space", spaceId)
	assert.equal(rules.view(game, "Axis").actions.continue, 1)
	game = rules.action(game, "Axis", "continue")

	for (const spaceId of legal.slice(0, 2)) {
		assert.equal(game.trench[spaceId], 1)
		assert.equal(game.trench_owner[spaceId], "axis")
		assert.equal(game.trench_kind[spaceId], "atlantic_wall")
	}
	assert.equal(game.events.atlantic_wall, true)

	const blocked = prepareAction(93, 9301)
	blocked.events.overlord = true
	assert.equal(Engine.events.canPlayEvent(blocked, data, 93), false)
})

test("East Wall places three German trenches in Full Supply Soviet spaces", () => {
	let game = prepareAction(94, 9400)
	const armies = [piece("GE 4 Panzer Army"), piece("GE 3 Panzer Army"), piece("GE 2 Panzer Army")]
	const spaces = [space("Kaunas"), space("Courland"), space("Kolomyja")]
	for (let index = 0; index < spaces.length; index++) {
		game.pieces[armies[index]] = spaces[index]
		game.control[spaces[index]] = "axis"
		delete game.trench[spaces[index]]
		delete game.trench_owner[spaces[index]]
	}

	game = rules.action(game, "Axis", "play_event", 94)
	assert.equal(game.state, "event_east_wall")
	for (const spaceId of spaces) game = rules.action(game, "Axis", "space", spaceId)
	game = rules.action(game, "Axis", "continue")
	for (const spaceId of spaces) {
		assert.equal(game.trench[spaceId], 1)
		assert.equal(game.trench_owner[spaceId], "axis")
	}
	assert.equal(game.events.east_wall, true)
})

test("Final Production Surge restores three Panzer Armies, draws seven, and blocks later Panzer rebuilds", () => {
	let game = prepareAction(107, 10700, 14)
	game.events.speer = true
	const panzers = [piece("GE 4 Panzer Army"), piece("GE 3 Panzer Army"), piece("GE 2 Panzer Army")]
	for (const pieceId of panzers) if (!game.reduced.includes(pieceId)) game.reduced.push(pieceId)

	game = rules.action(game, "Axis", "play_event", 107)
	assert.equal(game.state, "event_final_production_surge")
	for (const pieceId of panzers) game = rules.action(game, "Axis", "piece", pieceId)
	game = rules.action(game, "Axis", "continue")
	assert.equal(game.state, "ops_activate")
	assert.equal(
		panzers.some((pieceId) => game.reduced.includes(pieceId)),
		false,
	)
	assert.equal(game.events.final_production_surge_draw_pending, true)

	const eliminated = panzers[0]
	game.pieces[eliminated] = Engine.unitLocations.eliminated("axis")
	game.rp.ge = 10
	assert.equal(Engine.replacements.legalReplacementPieces(game, data, Engine.map, Engine.adjacency, "axis").includes(eliminated), true)
	game.turn = 15
	assert.equal(Engine.replacements.legalReplacementPieces(game, data, Engine.map, Engine.adjacency, "axis").includes(eliminated), false)

	game.turn = 14
	game.phase = "draw"
	game.hands.axis = []
	game.decks.axis = [56, 57, 58, 59, 60, 61, 62]
	assert.equal(Engine.turn.handLimit(game, "axis"), 7)
	Engine.turn.completeDrawPhase(game)
	assert.equal(game.hands.axis.length, 7)
	assert.equal(game.events.final_production_surge_draw_pending, undefined)
	assert.equal(game.events.final_production_surge_draw_consumed_turn, 14)

	const tooLate = prepareAction(107, 10701, 15)
	tooLate.events.speer = true
	for (const pieceId of panzers) if (!tooLate.reduced.includes(pieceId)) tooLate.reduced.push(pieceId)
	assert.equal(Engine.events.canPlayEvent(tooLate, data, 107), false)
})

test("The Bunker and National Redoubt are exclusive and apply their printed fixed-space effects", () => {
	let bunker = prepareAction(109, 10900)
	bunker = rules.action(bunker, "Axis", "play_event", 109)
	const berlin = space("Berlin")
	assert.equal(bunker.trench[berlin], 1)
	assert.equal(bunker.trench_owner[berlin], "axis")
	assert.equal(Engine.events.canPlayEvent(bunker, data, 110), false)

	let redoubt = prepareAction(110, 11000)
	const munich = space("Munich")
	assert.equal(Engine.map.supplySources(redoubt, data, "axis", "ge").includes(munich), false)
	redoubt = rules.action(redoubt, "Axis", "play_event", 110)
	assert.equal(redoubt.events.national_redoubt_space, munich)
	assert.equal(Engine.map.supplySources(redoubt, data, "axis", "ge").includes(munich), true)
	assert.equal(Engine.events.canPlayEvent(redoubt, data, 109), false)
})
