"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine

test("Partisan automatic operations are limited to the rule 16.1 countries", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 5, {})
	game.events.partisans = true
	game.turn = 2
	game.phase = "action"
	game.state = "action_select"
	game.active = "Allied"
	let next = rules.action(game, "Allied", "place_partisan")
	const actions = rules.view(next, "Allied").actions
	assert.ok(actions.space.length > 0)
	for (const spaceId of actions.space) assert.ok(["su", "yu", "gr", "tu"].includes(data.spaces[spaceId].nation))
	const chosen = actions.space[0]
	next = rules.action(next, "Allied", "space", chosen)
	assert.equal(next.partisans.includes(chosen), true)
	assert.equal(next.active, "Axis")
})

test("an Axis supply line crossing a Partisan space becomes Limited", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 5, {})
	const adjacency = Engine.map.buildAdjacency(data)
	const berlin = data.spaces.find((space) => space?.name === "Berlin").id
	const neighbor = adjacency[berlin].find((edge) => edge.type !== "sr").to
	game.control[neighbor] = "axis"
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "axis", neighbor, "ge"), "full")
	game.partisans.push(neighbor)
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "axis", neighbor, "ge"), "limited")
})
