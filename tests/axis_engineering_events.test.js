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
	const panzers = [piece("GE 4 Panzer Army"), piece("GE 3 Panzer Army"), piece("GE 2 Panzer Army"), piece("GE 1 Panzer Army")]
	for (const pieceId of panzers) if (!game.reduced.includes(pieceId)) game.reduced.push(pieceId)

	game = rules.action(game, "Axis", "play_event", 61)
	assert.equal(game.state, "event_panzer_refit")
	assert.equal(rules.view(game, "Axis").actions.continue, undefined)
	assert.throws(() => rules.action(game, "Axis", "piece", 1), /illegal action/)

	game = rules.action(game, "Axis", "piece", panzers[0])
	assert.deepEqual(rules.view(game, "Axis").event_selection.panzer_refit_pieces, [panzers[0]])
	assert.equal(rules.view(game, "Axis").actions.continue, 1)
	game = rules.action(game, "Axis", "piece", panzers[0])
	assert.deepEqual(rules.view(game, "Axis").event_selection.panzer_refit_pieces, [])
	assert.equal(rules.view(game, "Axis").actions.continue, undefined)
	for (const pieceId of panzers.slice(0, 3)) game = rules.action(game, "Axis", "piece", pieceId)
	assert.equal(rules.view(game, "Axis").actions.continue, 1)
	assert.equal(rules.view(game, "Axis").actions.piece.includes(panzers[3]), false)
	assert.throws(() => rules.action(game, "Axis", "piece", panzers[3]), /illegal action/)
	assert.throws(() => Engine.events.togglePanzerRefitPiece(game, data, panzers[3]), /illegal Panzer Refit piece/)

	const selected = panzers.slice(0, 3)
	const blocked = [...new Set(selected.map((pieceId) => game.pieces[pieceId]))]
	game = rules.action(game, "Axis", "continue")
	assert.equal(game.state, "ops_activate")
	assert.equal(
		selected.some((pieceId) => game.reduced.includes(pieceId)),
		false,
	)
	assert.equal(game.reduced.includes(panzers[3]), true)
	assert.deepEqual(
		game.event.blocked_activation_spaces.slice().sort((a, b) => a - b),
		blocked.slice().sort((a, b) => a - b),
	)
	for (const spaceId of blocked) {
		assert.equal(rules.view(game, "Axis").actions.space?.includes(spaceId) || false, false)
		assert.equal(rules.view(game, "Axis").actions.attack?.includes(spaceId) || false, false)
	}
	const unblocked = game.pieces[panzers[3]]
	assert.equal(rules.view(game, "Axis").actions.space?.includes(unblocked) || rules.view(game, "Axis").actions.attack?.includes(unblocked) || false, true)
})

test("Panzer Refit may voluntarily complete with one or two units when more targets are eligible", () => {
	const panzers = [piece("GE 4 Panzer Army"), piece("GE 3 Panzer Army"), piece("GE 2 Panzer Army"), piece("GE 1 Panzer Army")]
	for (const count of [1, 2]) {
		let game = prepareAction(61, 6110 + count)
		for (const pieceId of panzers) if (!game.reduced.includes(pieceId)) game.reduced.push(pieceId)
		if (count === 2) game.pieces[panzers[1]] = game.pieces[panzers[0]]
		assert.equal(Engine.events.legalPanzerRefitPieces(game, data).length >= 4, true)

		game = rules.action(game, "Axis", "play_event", 61)
		for (const pieceId of panzers.slice(0, count)) game = rules.action(game, "Axis", "piece", pieceId)
		assert.equal(rules.view(game, "Axis").actions.continue, 1)
		game = rules.action(game, "Axis", "continue")

		for (const pieceId of panzers.slice(0, count)) assert.equal(game.reduced.includes(pieceId), false)
		for (const pieceId of panzers.slice(count)) assert.equal(game.reduced.includes(pieceId), true)
		assert.deepEqual(
			game.event.blocked_activation_spaces.slice().sort((a, b) => a - b),
			[...new Set(panzers.slice(0, count).map((pieceId) => game.pieces[pieceId]))].sort((a, b) => a - b),
		)
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

test("Panzer Refit observes Spring Thaw and requires at least one supplied on-map Panzer", () => {
	const refit = prepareAction(61, 6101)
	const panzer = piece("GE 4 Panzer Army")
	refit.reduced.push(panzer)
	refit.turn = 5
	refit.action_round = 1
	assert.equal(Engine.events.canPlayEvent(refit, data, 61), false)
	refit.action_round = 2
	assert.equal(Engine.events.canPlayEvent(refit, data, 61), false)
	refit.action_round = 3
	assert.equal(Engine.events.canPlayEvent(refit, data, 61), true)
	assert.deepEqual(rules.view(refit, "Axis").actions.play_event, [61])
	const roundThree = rules.action(refit, "Axis", "play_event", 61)
	assert.equal(roundThree.state, "event_panzer_refit")
	assert.equal(roundThree.event.dual_ops, 4)

	const noTargets = prepareAction(61, 6102)
	assert.equal(Engine.events.canPlayEvent(noTargets, data, 61), false)
	noTargets.event = { card_id: 61, panzer_refit_pieces: [] }
	assert.throws(() => Engine.events.completePanzerRefit(noTargets, data), /one to three legal pieces/)

	const supply = prepareAction(61, 6103)
	const limited = piece("GE 3 Panzer Army")
	const oos = piece("GE 2 Panzer Army")
	const offMap = piece("GE Armor SCU")
	for (const entry of data.spaces) if (entry?.kind === "land") supply.control[entry.id] = "allied"
	supply.pieces[limited] = space("Brest")
	supply.control[space("Brest")] = "axis"
	supply.pieces[oos] = space("Stalingrad")
	supply.control[space("Stalingrad")] = "axis"
	supply.pieces[offMap] = "reserve:axis"
	supply.reduced.push(limited, oos, offMap)
	assert.equal(Engine.map.pieceSupplyStatus(supply, data, Engine.adjacency, limited), "limited")
	assert.equal(Engine.map.pieceSupplyStatus(supply, data, Engine.adjacency, oos), "oos")
	assert.deepEqual(Engine.events.legalPanzerRefitPieces(supply, data), [limited])
	assert.equal(Engine.events.canPlayEvent(supply, data, 61), true)
})

test("Hedgehogs requires three eligible spaces", () => {
	const hedgehogs = prepareAction(62, 6201)
	assert.equal(Engine.events.canPlayEvent(hedgehogs, data, 62), false)
})
