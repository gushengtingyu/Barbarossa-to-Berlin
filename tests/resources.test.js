"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine
const adjacency = Engine.map.buildAdjacency(data)

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

test("the map resource symbols identify exactly two Iron and three Oil spaces", () => {
	assert.deepEqual(
		Engine.resources.resourceSpaces(data, "iron").map((id) => data.spaces[id].name),
		["Ruhr", "Stockholm"],
	)
	assert.deepEqual(
		Engine.resources.resourceSpaces(data, "oil").map((id) => data.spaces[id].name),
		["Bucharest", "Baku", "Mosul"],
	)
})

test("initial Campaign resource control leaves both hand limits at seven", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 4, {})
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "axis"), 7)
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "allied"), 7)
})

test("Axis control of Maikop does not reduce the Allied hand limit", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 4, {})
	game.control[space("Maikop")] = "axis"
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "allied"), 7)
	game.control[space("Mosul")] = "axis"
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "allied"), 6)
})

test("Oil control changes the two sides' hand limits and respects Full Supply for Axis", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 4, {})
	const oil = Engine.resources.resourceSpaces(data, "oil")
	for (const id of oil) game.control[id] = "allied"
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "axis"), 6)
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "allied"), 8)
	for (const id of data.spaces.filter(Boolean).map((entry) => entry.id)) game.control[id] = "axis"
	assert.equal(Engine.resources.axisFullSupplyOilCount(game, data, Engine.map, adjacency), 3)
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "axis"), 8)
})

test("Casablanca treats neutral Swedish Iron as Allied and Partisans claim unoccupied resources", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 4, {})
	const ruhr = space("Ruhr")
	const stockholm = space("Stockholm")
	game.control[ruhr] = "allied"
	game.events.casablanca = true
	assert.equal(game.control[stockholm], "neutral")
	assert.equal(Engine.resources.alliedIronCount(game, data, Engine.map), 2)
	const bucharest = space("Bucharest")
	game.partisans.push(bucharest)
	for (const pieceId of Engine.map.friendlyPiecesInSpace(game, data, "axis", bucharest)) game.pieces[pieceId] = "reserve:axis"
	assert.equal(Engine.resources.effectiveControl(game, data, Engine.map, bucharest), "allied")
})

test("Draw Strategy Phase forces private discards down to the resource hand limit", () => {
	let game = rules.setup(12, "Campaign", {})
	game.phase = "draw"
	game.state = "draw_discard_allied"
	game.active = "Allied"
	game.hands.allied = data.cards
		.filter((card) => card?.side === "allied")
		.slice(0, 8)
		.map((card) => card.id)
	game.decks.allied = []
	game.discards.allied = []
	assert.equal(rules.view(game, "Allied").actions.continue, undefined)
	assert.throws(() => rules.action(game, "Allied", "continue"), /illegal action/)
	const discarded = game.hands.allied[0]
	game = rules.action(game, "Allied", "card", discarded)
	assert.equal(game.hands.allied.length, 7)
	assert.deepEqual(rules.view(game, "Allied").discard, [discarded])
	assert.equal(rules.view(game, "Axis").discard.includes(discarded), false)
	game = rules.action(game, "Allied", "continue")
	assert.equal(game.state, "draw_discard_axis")
	assert.equal(game.active, "Axis")
})

test("an exhausted deck deterministically reshuffles its own discard pile during drawing", () => {
	const first = Engine.setup.createInitialState(data, "Campaign", 77, {})
	const second = Engine.setup.createInitialState(data, "Campaign", 77, {})
	const pile = data.cards
		.filter((card) => card?.side === "allied")
		.slice(0, 4)
		.map((card) => card.id)
	for (const game of [first, second]) {
		game.hands.allied = []
		game.decks.allied = []
		game.discards.allied = pile.slice()
		Engine.cards.drawTo(game, "allied", 3, true)
	}
	assert.deepEqual(first.hands.allied, second.hands.allied)
	assert.equal(first.hands.allied.length, 3)
	assert.equal(first.discards.allied.length, 0)
	assert.equal(first.decks.allied.length, 1)
})
