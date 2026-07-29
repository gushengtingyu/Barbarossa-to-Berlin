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
	game.action_track = { allied: [], axis: [] }
	game.hands.axis = [cardId]
	return game
}

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

function cwCorps() {
	return data.pieces.filter((piece) => piece?.nation === "cw" && piece.size === "scu" && piece.unit_type === "corps").map((piece) => piece.id)
}

test("Banzai hands selection to the Allied player and enforces map, Reserve, Eliminated priority", () => {
	let game = prepareAction(72, 7200, 4)
	const [onMap, reserve, eliminated, ...others] = cwCorps()
	for (const pieceId of others) game.pieces[pieceId] = Engine.unitLocations.REMOVED
	game.pieces[onMap] = data.spaces.find((entry) => entry?.kind === "land" && entry.side === "allied").id
	game.pieces[reserve] = Engine.unitLocations.reserve("allied")
	game.pieces[eliminated] = Engine.unitLocations.eliminated("allied")

	game = rules.action(game, "Axis", "play_event", 72)
	assert.equal(game.active, "Allied")
	assert.equal(game.state, "event_banzai")
	assert.deepEqual(rules.view(game, "Allied").actions.piece, [onMap])

	game = rules.action(game, "Allied", "piece", onMap)
	assert.deepEqual(
		rules.view(game, "Allied").actions.piece.sort((a, b) => a - b),
		[onMap, reserve].sort((a, b) => a - b),
	)
	game = rules.action(game, "Allied", "piece", reserve)
	assert.ok(rules.view(game, "Allied").actions.continue)

	game = rules.action(game, "Allied", "piece", onMap)
	assert.deepEqual(game.event.banzai_pieces, [])
	assert.deepEqual(rules.view(game, "Allied").actions.piece, [onMap])

	game = rules.action(game, "Allied", "piece", onMap)
	game = rules.action(game, "Allied", "piece", reserve)
	game = rules.action(game, "Allied", "continue")
	assert.equal(game.pieces[onMap], Engine.unitLocations.REMOVED)
	assert.equal(game.pieces[reserve], Engine.unitLocations.REMOVED)
	assert.equal(game.pieces[eliminated], Engine.unitLocations.eliminated("allied"))
	assert.equal(game.active, "Allied")
	assert.equal(game.state, "action_select")
})

test("Luftwaffe Supply affects only defense and Axis attrition in its marked space and turn", () => {
	let game = prepareAction(74, 7400)
	const target = space("Smolensk")
	const defender = data.pieces.find((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.size === "scu").id
	for (let pieceId = 1; pieceId < game.pieces.length; pieceId++) if (data.pieces[pieceId]?.side === "axis") game.pieces[pieceId] = Engine.unitLocations.REMOVED
	for (const mapSpace of data.spaces) if (mapSpace?.kind === "land") game.control[mapSpace.id] = "allied"
	game.control[target] = "axis"
	game.pieces[defender] = target

	assert.equal(Engine.map.traceSupply(game, data, Engine.adjacency, "axis", target, "ge"), "oos")
	game = rules.action(game, "Axis", "play_event", 74)
	assert.deepEqual(rules.view(game, "Axis").actions.space, [target])
	game = rules.action(game, "Axis", "space", target)
	assert.equal(game.events.luftwaffe_supply_space, target)
	assert.equal(Engine.map.traceSupply(game, data, Engine.adjacency, "axis", target, "ge"), "oos")
	assert.equal(Engine.logistics.supplyStatus(game, data, Engine.map, Engine.adjacency, defender), "oos")
	assert.equal(Engine.logistics.supplyStatus(game, data, Engine.map, Engine.adjacency, defender, "attrition"), "limited")
	const origin = Engine.adjacency[target].find((edge) => edge.type !== "sr").to
	const attacker = data.pieces.find((piece) => piece?.side === "allied" && piece.size === "scu").id
	game.pieces[attacker] = origin
	game.control[origin] = "allied"
	const combat = { attackers: [attacker], defenders: [defender], attacker_side: "allied", defender_side: "axis", defender_space: target }
	assert.equal(Engine.combat.preview(game, data, Engine.map, Engine.adjacency, combat).defender_shift, 0)
	game.hands.axis = [102]
	assert.equal(Engine.combatCards.available(game, data, Engine.map, Engine.adjacency, combat, "axis").includes(102), true)
	const withoutMarker = JSON.parse(JSON.stringify(game))
	delete withoutMarker.events.luftwaffe_supply_space
	assert.equal(Engine.combat.preview(withoutMarker, data, Engine.map, Engine.adjacency, combat).defender_shift, -1)
	assert.deepEqual(Engine.combatCards.available(withoutMarker, data, Engine.map, Engine.adjacency, combat, "axis"), [])

	const resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, Engine.adjacency, "axis")
	assert.ok(!resolved.eliminated.includes(defender))
	assert.equal(game.pieces[defender], target)
	assert.equal(game.control[target], "axis")
	assert.equal(resolved.changedControl.includes(target), false)
	game.turn++
	assert.equal(Engine.logistics.supplyStatus(game, data, Engine.map, Engine.adjacency, defender, "attrition"), "oos")
})

test("Luftwaffe Supply continues into the card's OPS after its supply marker is placed", () => {
	let game = prepareAction(74, 7401)
	const target = space("Smolensk")
	const defender = data.pieces.find((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.size === "scu").id
	for (let pieceId = 1; pieceId < game.pieces.length; pieceId++) if (data.pieces[pieceId]?.side === "axis") game.pieces[pieceId] = Engine.unitLocations.REMOVED
	for (const mapSpace of data.spaces) if (mapSpace?.kind === "land") game.control[mapSpace.id] = "allied"
	game.control[target] = "axis"
	game.pieces[defender] = target

	game = rules.action(game, "Axis", "play_event", 74)
	assert.equal(game.state, "event_luftwaffe_supply")
	assert.equal(game.event.dual_ops, 3)
	game = rules.action(game, "Axis", "space", target)

	assert.equal(game.state, "ops_activate")
	assert.equal(game.active, "Axis")
	assert.equal(game.action.mode, "ops")
	assert.equal(game.action.points, 3)
	assert.ok(rules.view(game, "Axis").actions.done)
})

test("Manstein cancels Axis Orders, their penalty, and Hitler Stand Fast markers", () => {
	let game = prepareAction(101, 10100)
	const target = space("Smolensk")
	game.orders = { axis: { result: "okw_mo", fulfilled: false }, allied: null, placements: [] }
	game.stand_fast[target] = "hitler"
	game.stand_fast_round_units[target] = []
	game = rules.action(game, "Axis", "play_event", 101)
	assert.equal(game.orders.axis.cancelled, true)
	assert.equal(game.orders.axis.fulfilled, true)
	assert.equal(game.stand_fast[target], undefined)
	const vp = game.vp
	assert.deepEqual(Engine.orders.applyPenalties(game), [])
	assert.equal(game.vp, vp)
})

test("Foreign Armies East reveals only specified Allied cards and repeats unplayed cards at turn end", () => {
	let game = prepareAction(105, 10500)
	game.hands.allied = [2, 8, 17, 39]
	game = rules.action(game, "Axis", "play_event", 105)
	assert.equal(rules.view(game, "Axis").revealed_opponent_hand, undefined)
	assert.equal(rules.view(game, "Allied").revealed_opponent_hand, undefined)
	assert.equal(rules.view(game, "Observer").revealed_opponent_hand, undefined)
	assert.ok(rules.view(game, "Observer").log.some((entry) => /c2.*c17.*c39/.test(entry)))

	game.hands.allied.splice(game.hands.allied.indexOf(2), 1)
	Engine.turn.startEndPhases(game)
	assert.deepEqual(game.events.foreign_armies_east.final, [17, 39])
	assert.ok(rules.view(game, "Observer").log.some((entry) => /c17.*c39/.test(entry)))
	game.turn++
	assert.equal(rules.view(game, "Axis").revealed_opponent_hand, undefined)

	const thaw = prepareAction(105, 10501, 5)
	thaw.action_round = 1
	assert.equal(Engine.events.canPlayEvent(thaw, data, 105), false)
})
