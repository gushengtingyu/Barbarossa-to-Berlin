"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Combat = require("../modules/systems/combat.js")
const Engine = require("../modules/engine.js")
const { data } = require("../data.js")

const adjacency = Engine.map.buildAdjacency(data)

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

test("official SCU and LCU fire tables use bounded column shifts", () => {
	assert.equal(Combat.fireResult("scu", Combat.shiftedColumn("scu", 0, 0), 1), 0)
	assert.equal(Combat.fireResult("scu", Combat.shiftedColumn("scu", 7, 0), 6), 3)
	assert.equal(Combat.fireResult("lcu", Combat.shiftedColumn("lcu", 15, 0), 1), 4)
	assert.equal(Combat.fireResult("lcu", Combat.shiftedColumn("lcu", 6, -99), 6), 2)
	assert.equal(Combat.shiftedColumn("lcu", 15, 99), 8)
	assert.equal(Combat.fireColumnLabel("scu", 7), 7)
	assert.equal(Combat.fireColumnLabel("lcu", 8), 15)
})

test("combat resolution consumes only the deterministic game seed", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Attack", terrain: "clear" }, { id: 2, name: "Defense", terrain: "mountain" }],
		pieces: [
			null,
			{
				id: 1,
				side: "axis",
				nation: "ge",
				size: "lcu",
				unit_type: "army",
				cf: 5,
				lf: 3,
				rcf: 3,
				rlf: 3,
			},
			{
				id: 2,
				side: "allied",
				nation: "su",
				size: "scu",
				unit_type: "corps",
				cf: 2,
				lf: 1,
				rcf: 1,
				rlf: 1,
			},
		],
	}
	const makeGame = () => ({
		seed: 77,
		turn: 1,
		pieces: [0, 1, 2],
		reduced: [],
		trench: {},
		events: { barbarossa: true },
		event: { attack_drm: 1 },
	})
	const map = { traceSupply: () => "full" }
	const first = {
		origin_spaces: [1],
		defender_space: 2,
		attackers: [1],
		defenders: [2],
	}
	const second = JSON.parse(JSON.stringify(first))
	const gameA = makeGame()
	const gameB = makeGame()
	Combat.resolve(gameA, localData, map, [[], [{ to: 2 }], [{ to: 1 }]], first)
	Combat.resolve(gameB, localData, map, [[], [{ to: 2 }], [{ to: 1 }]], second)
	assert.deepEqual(first, second)
	assert.equal(first.attacker_shift, -1)
	assert.equal(first.attacker_drm, 1)
	assert.equal(gameA.seed, gameB.seed)
})

test("Rule 11.45 excludes previously retreated strength but retains its unit class and supply effects", () => {
	const localData = {
		spaces: [null, { id: 1, kind: "land", nation: "ge", terrain: "clear" }, { id: 2, kind: "land", nation: "su", terrain: "clear" }],
		pieces: [
			null,
			{ id: 1, side: "axis", nation: "ge", size: "scu", cf: 1, lf: 1, rcf: 1, rlf: 1 },
			{ id: 2, side: "allied", nation: "su", size: "scu", cf: 2, lf: 1, rcf: 1, rlf: 1 },
			{ id: 3, side: "allied", nation: "su", size: "lcu", cf: 5, lf: 3, rcf: 3, rlf: 3 },
		],
	}
	const game = {
		seed: 4,
		turn: 8,
		pieces: [null, 1, 2, 2],
		reduced: [],
		trench: {},
		events: {},
		options: {},
		action: { activation_supply: { 1: "full" } },
	}
	const combat = {
		origin_spaces: [1],
		defender_space: 2,
		attackers: [1],
		defenders: [2],
		retreated_defenders: [3],
		attacker_side: "axis",
		defender_side: "allied",
	}
	const supplyAwareMap = {
		pieceSide: (state, dataSet, pieceId) => dataSet.pieces[pieceId].side,
		pieceSupplyStatus: (state, dataSet, localAdjacency, pieceId) => (pieceId === 3 ? "oos" : "full"),
		isFortIntactForSide: () => false,
		traceSupply: () => "full",
	}
	const profile = Combat.preview(game, localData, supplyAwareMap, [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]], combat)
	assert.equal(profile.defender_strength, 2)
	assert.equal(profile.defender_table, "lcu")
	assert.equal(profile.defender_shift, -1)
})

test("Rule 11.45 eliminates a previously retreated LCU and its mandatory Reserve SCU without OOS delay", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 9, {})
	const lcu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && piece.unit_type !== "mechanized").id
	const scu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu" && piece.unit_type !== "mechanized").id
	game.pieces.fill(Engine.unitLocations.REMOVED)
	game.pieces[lcu] = space("Warsaw")
	game.pieces[scu] = Engine.unitLocations.reserve("axis")
	game.reduced = [lcu]
	const outcome = Combat.eliminatePreviouslyRetreated(game, data, lcu)
	assert.equal(outcome.replacement, scu)
	assert.equal(game.pieces[lcu], Engine.unitLocations.eliminated("axis"))
	assert.equal(game.pieces[scu], Engine.unitLocations.eliminated("axis"))
	assert.equal(game.reduced.includes(lcu), false)
	assert.equal(game.reduced.includes(scu), false)
})

test("river terrain shifts the attack only when every participating unit crosses a blue dotted connection", () => {
	const localData = {
		spaces: [null, { id: 1, terrain: "clear" }, { id: 2, terrain: "clear" }, { id: 3, terrain: "clear" }],
		pieces: [
			null,
			{
				id: 1,
				side: "axis",
				nation: "ge",
				size: "scu",
				cf: 2,
				lf: 1,
				rcf: 1,
				rlf: 1,
			},
			{
				id: 2,
				side: "allied",
				nation: "su",
				size: "scu",
				cf: 1,
				lf: 1,
				rcf: 1,
				rlf: 1,
			},
			{
				id: 3,
				side: "axis",
				nation: "ge",
				size: "scu",
				cf: 2,
				lf: 1,
				rcf: 1,
				rlf: 1,
			},
		],
	}
	const map = { traceSupply: () => "full" }
	const makeGame = () => ({
		seed: 12,
		turn: 2,
		pieces: [0, 1, 2, 3],
		reduced: [],
		trench: {},
		events: {},
		event: {},
	})
	const makeCombat = () => ({
		origin_spaces: [1, 3],
		defender_space: 2,
		attackers: [1, 3],
		defenders: [2],
	})
	const allRiver = [[], [{ to: 2, type: "river" }], [], [{ to: 2, type: "river" }]]
	const mixed = [[], [{ to: 2, type: "river" }], [], [{ to: 2, type: "regular" }]]
	const riverCombat = makeCombat()
	const mixedCombat = makeCombat()
	const previewGame = makeGame()
	const preview = Combat.preview(previewGame, localData, map, allRiver, makeCombat())
	assert.equal(previewGame.seed, 12)
	assert.equal(preview.attacker_strength, 4)
	assert.equal(preview.attacker_shift, -1)
	assert.equal(preview.attacker_die, undefined)
	Combat.resolve(makeGame(), localData, map, allRiver, riverCombat)
	Combat.resolve(makeGame(), localData, map, mixed, mixedCombat)
	assert.equal(riverCombat.river_attack, true)
	assert.equal(riverCombat.attacker_shift, -1)
	assert.equal(riverCombat.attacker_column, preview.attacker_column)
	assert.equal(mixedCombat.river_attack, false)
	assert.equal(mixedCombat.attacker_shift, 0)
})

test("loss choices preserve the maximum loss number including LCU replacement", () => {
	const lcus = data.pieces.filter((piece) => piece?.nation === "ge" && piece.size === "lcu" && piece.unit_type === "army")
	const reserveScu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu" && piece.unit_type === "corps")
	assert.ok(lcus.length >= 2 && reserveScu)
	const full = lcus[0].id
	const reduced = lcus[1].id
	const game = {
		pieces: Array(data.pieces.length).fill(0),
		reduced: [reduced],
	}
	game.pieces[full] = 10
	game.pieces[reduced] = 10
	game.pieces[reserveScu.id] = "reserve:axis"
	const combat = { attackers: [full, reduced], defenders: [] }
	const choices = Combat.legalLossChoices(game, data, combat, "attackers", 5)
	assert.deepEqual(choices, [reduced])
	const first = Combat.applyStepLoss(game, data, combat, reduced)
	assert.equal(first.replacement, reserveScu.id)
	assert.equal(game.pieces[reserveScu.id], 10)
	assert.equal(Combat.maxReachableLoss(game, data, combat, "attackers", 2), 2)
})

test("Rule 11.3 permanently eliminates an LCU when a hypothetical reserve SCU absorbs more loss", () => {
	const localData = {
		pieces: [
			null,
			{
				id: 1,
				name: "GE full army",
				side: "axis",
				nation: "ge",
				size: "lcu",
				unit_type: "army",
				lf: 3,
				rlf: 3,
			},
			{
				id: 2,
				name: "GE reduced army",
				side: "axis",
				nation: "ge",
				size: "lcu",
				unit_type: "army",
				lf: 3,
				rlf: 3,
			},
			{
				id: 3,
				name: "GE corps",
				side: "axis",
				nation: "ge",
				size: "scu",
				unit_type: "corps",
				lf: 1,
				rlf: 1,
			},
		],
	}
	const game = { pieces: [0, 10, 10, 20], reduced: [2] }
	const combat = { attackers: [1, 2], defenders: [] }

	assert.deepEqual(Combat.legalLossChoices(game, localData, combat, "attackers", 5), [2])
	const result = Combat.applyStepLoss(game, localData, combat, 2, 5)
	assert.deepEqual(result, {
		cost: 5,
		eliminated: true,
		replacement: null,
		permanent: true,
		origin_space_id: 10,
	})
	assert.equal(game.pieces[2], "removed")
	assert.equal(game.pieces[3], 20)
})

test("combat losses remove Stand Fast only after all Action Round starting units are eliminated", () => {
	const localData = {
		pieces: [
			null,
			{
				id: 1,
				name: "SU corps 1",
				side: "allied",
				nation: "su",
				size: "scu",
				unit_type: "corps",
				lf: 1,
				rlf: 1,
			},
			{
				id: 2,
				name: "SU corps 2",
				side: "allied",
				nation: "su",
				size: "scu",
				unit_type: "corps",
				lf: 1,
				rlf: 1,
			},
		],
	}
	const game = {
		pieces: [0, 10, 10],
		reduced: [1, 2],
		stand_fast: { 10: "stalin" },
		stand_fast_round_units: {},
	}
	const combat = { attackers: [], defenders: [1, 2] }
	Engine.orders.recordStandFastUnits(game, localData)

	Combat.applyStepLoss(game, localData, combat, 1)
	assert.equal(game.stand_fast[10], "stalin")
	Combat.applyStepLoss(game, localData, combat, 2)
	assert.equal(game.stand_fast[10], undefined)
})

test("mechanized advance reaches up to three spaces and stops after restrictive terrain", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const pieceId = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && piece.unit_type === "mechanized").id
	const origin = space("Memel")
	game.pieces.fill(0)
	game.pieces[pieceId] = origin
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.turn = 2
	game.action = { attack_spaces: [] }
	const defender = adjacency[origin].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").to
	const combat = {
		attackers: [pieceId],
		defenders: [],
		advanced: [],
		defender_space: defender,
		retreat_path: [],
	}
	const paths = Combat.legalAdvancePaths(game, data, Engine.map, adjacency, combat, pieceId)
	assert.ok([...paths.values()].some((path) => path.length === 3))
	for (const path of paths.values()) {
		assert.ok(path.length <= 3)
		for (const intermediate of path.slice(0, -1)) {
			const location = data.spaces[intermediate]
			assert.equal(!!(location.fort || ["forest", "mountain", "swamp"].includes(location.terrain)), false)
		}
	}
})

test("retreat length, Shock Armies, Winter 42 and Time of Mud cap advance length", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {
		time_of_mud: true,
	})
	const panzer = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && piece.unit_type === "mechanized").id
	game.pieces[panzer] = space("Brest Litovsk")
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	const combat = { retreat_path: [space("Pinsk")] }
	game.turn = 2
	assert.equal(Combat.advanceLimit(game, data, Engine.map, adjacency, combat, panzer), 2)
	game.turn = 3
	game.action_round = 2
	assert.equal(Combat.advanceLimit(game, data, Engine.map, adjacency, { retreat_path: [] }, panzer), 1)
	game.options.time_of_mud = false
	game.turn = 4
	assert.equal(Combat.advanceLimit(game, data, Engine.map, adjacency, { retreat_path: [] }, panzer), 1)
	const shock = data.pieces.find((piece) => piece?.nation === "su" && piece.name.includes("Shock")).id
	game.pieces[shock] = space("Moscow")
	game.turn = 8
	assert.equal(Combat.advanceLimit(game, data, Engine.map, adjacency, { retreat_path: [] }, shock), 1)
})

test("non-mechanized units may follow both vacated spaces after a two-space retreat", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const pieceId = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && Number(piece.mf) < 4).id
	const origin = space("Memel")
	game.pieces.fill(0)
	game.pieces[pieceId] = origin
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.action = { attack_spaces: [] }
	const defender = adjacency[origin].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").to
	const firstRetreat = adjacency[defender].find((edge) => edge.type !== "sr" && edge.to !== origin && data.spaces[edge.to]?.kind === "land").to
	const combat = {
		attackers: [pieceId],
		defenders: [],
		advanced: [],
		defender_space: defender,
		retreat_path: [firstRetreat, origin],
	}
	const paths = Combat.legalAdvancePaths(game, data, Engine.map, adjacency, combat, pieceId)
	assert.deepEqual(paths.get(defender), [defender])
	assert.deepEqual(paths.get(firstRetreat), [defender, firstRetreat])
})
