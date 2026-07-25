"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")

const { data, adjacency } = Engine

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

test("axis_no_entry spaces reject Axis movement and advance while remaining open to Soviet units", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Origin", kind: "land", nation: "su" }, { id: 2, name: "Restricted", kind: "land", nation: "su", attack_requires_event: "axis_no_entry" }],
		pieces: [null, { id: 1, name: "German Infantry", side: "axis", nation: "ge", size: "lcu", mf: 3, rmf: 3 }, { id: 2, name: "Soviet Infantry", side: "allied", nation: "su", size: "lcu", mf: 3, rmf: 3 }],
	}
	const localAdjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]
	const game = {
		turn: 2,
		action_round: 1,
		pieces: [null, 1, 0],
		reduced: [],
		control: [null, "axis", "axis"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
		action: { attack_spaces: [], activation_supply: { 1: "full" } },
	}

	assert.equal(Engine.restrictions.mayEnter(game, localData, localAdjacency, 1, 2), false)
	assert.equal(Engine.restrictions.mayEnter(game, localData, localAdjacency, 2, 2), true)
	assert.equal(Engine.map.legalMovePaths(game, localData, localAdjacency, 1).has(2), false)

	const combat = {
		attackers: [1],
		defenders: [],
		advanced: [],
		defender_space: 2,
		retreat_path: [],
	}
	assert.equal(Engine.combat.legalAdvancePaths(game, localData, Engine.map, localAdjacency, combat, 1).has(2), false)
})

test("the map contains exactly one regular Oslo-Jutland edge", () => {
	const oslo = space("Oslo")
	const jutland = space("Jutland")
	const matchingEdges = data.edges.filter((edge) => edge.type === "regular" && ((edge.a === oslo && edge.b === jutland) || (edge.a === jutland && edge.b === oslo)))

	assert.equal(matchingEdges.length, 1)
	assert.equal(adjacency[oslo].filter((edge) => edge.to === jutland && edge.type === "regular").length, 1)
	assert.equal(adjacency[jutland].filter((edge) => edge.to === oslo && edge.type === "regular").length, 1)
})

test("a Limited supply source does not hide a reachable Full supply source", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Origin", kind: "land", nation: "it" }, { id: 2, name: "Syracuse", kind: "land", nation: "it", supply: "axis_limited" }, { id: 3, name: "Rome", kind: "land", nation: "it", supply: "axis" }],
	}
	const localAdjacency = [
		[],
		[{ to: 2, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
	]
	const game = {
		turn: 2,
		control: [null, "axis", "axis", "axis"],
		events: {},
		options: {},
		partisans: [],
		beachheads: {},
		destroyed_forts: [],
	}

	const details = Engine.map.traceSupplyDetails(game, localData, localAdjacency, "axis", 1, "ge")
	assert.equal(details.status, "full")
	assert.equal(
		details.terminals.some((terminal) => terminal.space_id === 2 && terminal.status === "limited"),
		true,
	)
	assert.equal(
		details.terminals.some((terminal) => terminal.space_id === 3 && terminal.status === "full"),
		true,
	)
})

test("Winter 42 blocks a German Panzer entering a Soviet Combat marker from outside the USSR", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Outside USSR", kind: "land", nation: "pl" }, { id: 2, name: "Inside USSR", kind: "land", nation: "su" }],
		pieces: [null, { id: 1, name: "German Panzer", side: "axis", nation: "ge", size: "lcu", unit_type: "mechanized", mf: 4, rmf: 4 }],
	}
	const localAdjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]
	const game = {
		turn: 4,
		action_round: 1,
		pieces: [null, 1],
		reduced: [],
		control: [null, "axis", "axis"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
		action: { attack_spaces: [2], activation_supply: { 1: "full" } },
	}

	assert.equal(Engine.map.legalMovePaths(game, localData, localAdjacency, 1).has(2), false)
	game.events.von_paulus_pause = true
	assert.equal(Engine.map.legalMovePaths(game, localData, localAdjacency, 1).has(2), true)
})
