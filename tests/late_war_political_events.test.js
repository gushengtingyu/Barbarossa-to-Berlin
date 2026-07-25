"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog } = require("./i18n_helpers.js")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data, adjacency } = Engine

function game(seed = 2200) {
	return Engine.setup.createInitialState(data, "Campaign", seed, {})
}

function space(name) {
	return data.spaces.find((entry) => entry?.name === name)?.id
}

function giveSovietControl(current, spaceId) {
	current.control[spaceId] = "allied"
	current.control_nation[spaceId] = "su"
}

test("Thunderclap and Bomb Plot deterministically discard and reveal one Axis hand card", () => {
	const makeThunderclap = () => {
		const current = game(2201)
		current.events.yalta = true
		current.hands.axis = [56, 57, 63, 70]
		current.undo = [{ active: "Allied" }]
		return current
	}
	const first = makeThunderclap()
	const second = makeThunderclap()
	assert.equal(Engine.events.canPlayEvent(first, data, 44), true)
	Engine.events.playEvent(first, data, 44)
	Engine.events.playEvent(second, data, 44)
	assert.equal(first.event.random_discard, second.event.random_discard)
	assert.equal(first.seed, second.seed)
	assert.equal(first.hands.axis.length, 3)
	assert.deepEqual(first.discards.axis, [first.event.random_discard])
	assert.deepEqual(first.undo, [])
	assert.ok(renderLog(first).some((entry) => entry.includes(`c${first.event.random_discard}`)))
	assert.equal(Engine.events.canPlayEvent(first, data, 44), false)

	const bombPlot = game(2202)
	bombPlot.hands.axis = [75, 84]
	assert.equal(Engine.events.canPlayEvent(bombPlot, data, 48), true)
	Engine.events.playEvent(bombPlot, data, 48)
	assert.equal(bombPlot.events.bomb_plot, true)
	assert.equal(bombPlot.hands.axis.length, 1)
	assert.equal(bombPlot.discards.axis.includes(bombPlot.event.random_discard), true)
	assert.equal(Engine.events.canPlayEvent(bombPlot, data, 48), false)
})

test("the Rally whitelist exposes Thunderclap only after Yalta and executes the random discard atomically", () => {
	let current = rules.setup(2210, "Campaign", {})
	current.turn = 10
	current.phase = "action"
	current.state = "action_select"
	current.active = "Allied"
	current.action_history = { allied: [], axis: [] }
	current.hands.allied = [44]
	current.hands.axis = [56, 57, 63]
	assert.equal(rules.view(current, "Allied").actions.play_event?.includes(44) || false, false)
	current.events.yalta = true
	assert.equal(rules.view(current, "Allied").actions.play_event.includes(44), true)
	current = rules.action(current, "Allied", "play_event", 44)
	assert.equal(current.events.thunderclap, true)
	assert.equal(current.hands.axis.length, 2)
	assert.equal(current.discards.axis.length, 1)
	assert.equal(current.removed.allied.includes(44), true)
	assert.deepEqual(current.undo, [])
})

test("The Big Three requires Casablanca and no Axis-controlled space in Africa, Syria, Persia, or Iraq", () => {
	const current = game(2203)
	for (const entry of data.spaces) {
		if (entry?.kind === "land" && ["dz", "tn", "ly", "eg", "sy", "ir", "iq"].includes(entry.nation)) current.control[entry.id] = "allied"
	}
	assert.equal(Engine.events.canPlayEvent(current, data, 47), false)
	current.events.casablanca = true
	assert.equal(Engine.events.canPlayEvent(current, data, 47), true)
	const damascus = space("Damascus")
	current.control[damascus] = "axis"
	assert.equal(Engine.events.canPlayEvent(current, data, 47), false)
	current.control[damascus] = "allied"
	const vp = current.vp
	Engine.events.playEvent(current, data, 47)
	assert.equal(current.vp, vp - 1)
	assert.equal(current.events.big_three, true)
	assert.equal(Engine.events.eventOpsValue(current, data, 47), 2)
})

test("Yalta requires every Soviet VP space and one Greater Germany VP space, and covers mixed US attacks", () => {
	const current = game(2204)
	for (const entry of data.spaces) {
		if (entry?.kind === "land" && entry.nation === "su" && Number(entry.vp) > 0) current.control[entry.id] = "allied"
		if (entry?.kind === "land" && entry.nation === "ge" && Number(entry.vp) > 0) current.control[entry.id] = "axis"
	}
	assert.equal(Engine.events.canPlayEvent(current, data, 51), false)
	current.control[space("Memel")] = "allied"
	assert.equal(Engine.events.canPlayEvent(current, data, 51), false)
	current.control[space("Berlin")] = "allied"
	assert.equal(Engine.events.canPlayEvent(current, data, 51), true)
	const vp = current.vp
	Engine.events.playEvent(current, data, 51)
	assert.equal(current.vp, vp - 1)
	assert.equal(current.events.yalta, true)
	assert.equal(Engine.events.eventOpsValue(current, data, 51), 2)

	const us = data.pieces.find((piece) => piece?.nation === "us").id
	const br = data.pieces.find((piece) => piece?.nation === "br").id
	const ge = data.pieces.find((piece) => piece?.nation === "ge").id
	const forest = data.spaces.find((entry) => entry?.kind === "land" && entry.terrain === "forest").id
	current.pieces[us] = forest
	current.pieces[br] = forest
	current.pieces[ge] = forest
	const map = { traceSupply: () => "full" }
	const mixed = { attackers: [us, br], defenders: [ge], defender_space: forest }
	const britishOnly = { attackers: [br], defenders: [ge], defender_space: forest }
	assert.equal(Engine.combat.canCancelRetreat(current, data, map, adjacency, mixed), false)
	assert.equal(Engine.combat.canCancelRetreat(current, data, map, adjacency, britishOnly), true)
})

test("Finland Withdraws requires Soviet control and Full Supply at Leningrad, Tallinn, and Riga", () => {
	const current = game(2205)
	for (const entry of data.spaces) if (entry?.nation === "su") giveSovietControl(current, entry.id)
	assert.equal(Engine.events.canPlayEvent(current, data, 54), true)
	current.control_nation[space("Tallinn")] = "br"
	assert.equal(Engine.events.canPlayEvent(current, data, 54), false)
	current.control_nation[space("Tallinn")] = "su"
	const rigaNeighbors = adjacency[space("Riga")].filter((edge) => data.spaces[edge.to]?.kind === "land").map((edge) => edge.to)
	for (const spaceId of rigaNeighbors) current.control[spaceId] = "axis"
	assert.equal(Engine.events.canPlayEvent(current, data, 54), false)
	for (const spaceId of rigaNeighbors) current.control[spaceId] = "allied"
	const vp = current.vp
	Engine.events.playEvent(current, data, 54)
	assert.equal(current.vp, vp - 1)
	assert.equal(current.events.finland_withdraws, true)
})

test("after Bomb Plot, ignoring Hitler Orders costs one VP per German unit under the marker", () => {
	const current = game(2206)
	const origin = space("Berlin")
	const destination = adjacency[origin].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").to
	const germans = data.pieces
		.filter((piece) => piece?.nation === "ge")
		.slice(0, 2)
		.map((piece) => piece.id)
	const italian = data.pieces.find((piece) => piece?.nation === "it").id
	current.pieces.fill(0)
	for (const pieceId of [...germans, italian]) current.pieces[pieceId] = origin
	current.control[destination] = "axis"
	current.stand_fast[origin] = "hitler"
	current.events.bomb_plot = true
	const vp = current.vp
	Engine.map.movePieceAlongPath(current, data, germans[0], [destination])
	assert.equal(current.vp, vp - 2)
	assert.equal(current.stand_fast[origin], undefined)

	const nonGerman = game(2207)
	nonGerman.pieces.fill(0)
	nonGerman.pieces[italian] = origin
	nonGerman.control[destination] = "axis"
	nonGerman.stand_fast[origin] = "hitler"
	nonGerman.events.bomb_plot = true
	Engine.map.movePieceAlongPath(nonGerman, data, italian, [destination])
	assert.equal(nonGerman.vp, 7)
	assert.equal(nonGerman.stand_fast[origin], undefined)
})
