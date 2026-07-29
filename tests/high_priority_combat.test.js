"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Combat = require("../modules/systems/combat.js")
const Logistics = require("../modules/systems/logistics.js")
const CombatStates = require("../modules/states/states_combat.js")

function combatMap(statusByPiece = {}, fort = false) {
	return {
		pieceSide: (game, data, pieceId) => data.pieces[pieceId]?.side,
		pieceSupplyStatus: (game, data, adjacency, pieceId) => statusByPiece[pieceId] || "full",
		traceSupply: () => "full",
		isFortIntactForSide: () => fort,
		enemyPiecesInSpace: () => [],
		canStack: () => true,
	}
}

function combatGame(overrides = {}) {
	return {
		turn: 6,
		action_round: 3,
		pieces: [0, 1, 2],
		reduced: [],
		trench: {},
		trench_owner: {},
		trench_kind: {},
		destroyed_forts: [],
		partisans: [],
		events: {},
		options: {},
		action: { attack_spaces: [], activation_supply: { 1: "full" } },
		...overrides,
	}
}

test("OOS defenders retain ordinary terrain and No Retreat while Western trenches remain unavailable", () => {
	const data = {
		spaces: [null, { id: 1, name: "Attack", kind: "land", nation: "ge", terrain: "clear" }, { id: 2, name: "Mountain", kind: "land", nation: "fr", terrain: "mountain" }],
		pieces: [null, { id: 1, side: "axis", nation: "ge", size: "lcu", cf: 5, lf: 3, mf: 3, rcf: 3, rlf: 3, rmf: 3 }, { id: 2, side: "allied", nation: "br", size: "scu", cf: 2, lf: 1, mf: 3, rcf: 1, rlf: 1, rmf: 3 }],
	}
	const adjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]
	const game = combatGame()
	const combat = { origin_spaces: [1], defender_space: 2, attackers: [1], defenders: [2] }
	const map = combatMap({ 2: "oos" })

	let profile = Combat.preview(game, data, map, adjacency, combat)
	assert.equal(profile.attacker_shift, -1)
	assert.equal(profile.defender_shift, -1)
	assert.deepEqual(profile.attacker_shift_factors, [{ reason: "terrain", amount: -1, terrain: "mountain" }])
	assert.deepEqual(profile.defender_shift_factors, [{ reason: "oos", amount: -1 }])
	assert.equal(Combat.canCancelRetreat(game, data, map, adjacency, combat), true)

	game.trench[2] = 1
	game.trench_owner[2] = "allied"
	profile = Combat.preview(game, data, map, adjacency, combat)
	assert.equal(profile.attacker_shift, -1)
	assert.equal(profile.defender_shift, -1)
	assert.deepEqual(profile.attacker_shift_factors, [{ reason: "terrain", amount: -1, terrain: "mountain" }])
	assert.deepEqual(profile.defender_shift_factors, [{ reason: "oos", amount: -1 }])
	assert.equal(Combat.canCancelRetreat(game, data, map, adjacency, combat), true)
})

test("Barbarossa preserves Soviet trench Att shifts while cancelling Def1R and No Retreat", () => {
	const data = {
		spaces: [null, { id: 1, name: "Attack", kind: "land", nation: "ge", terrain: "clear" }, { id: 2, name: "Defense", kind: "land", nation: "su", terrain: "clear" }],
		pieces: [null, { id: 1, side: "axis", nation: "ge", size: "lcu", cf: 5, lf: 3, mf: 3, rcf: 3, rlf: 3, rmf: 3 }, { id: 2, side: "allied", nation: "su", size: "lcu", cf: 3, lf: 3, mf: 3, rcf: 2, rlf: 3, rmf: 3 }],
	}
	const adjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]
	const combat = { origin_spaces: [1], defender_space: 2, attackers: [1], defenders: [2] }
	const map = combatMap()
	const barbarossa = combatGame({
		turn: 1,
		trench: { 2: 1 },
		trench_owner: { 2: "allied" },
		trench_kind: { 2: "soviet" },
		events: { barbarossa: true },
	})
	let profile = Combat.preview(barbarossa, data, map, adjacency, combat)
	assert.equal(profile.attacker_shift, -1)
	assert.equal(profile.defender_shift, 0)
	assert.equal(Combat.canCancelRetreat(barbarossa, data, map, adjacency, combat), false)

	barbarossa.trench[2] = 2
	profile = Combat.preview(barbarossa, data, map, adjacency, combat)
	assert.equal(profile.attacker_shift, -2)
	assert.equal(profile.defender_shift, 0)
	assert.equal(Combat.canCancelRetreat(barbarossa, data, map, adjacency, combat), false)

	barbarossa.trench[2] = 1
	barbarossa.trench_kind = {}
	profile = Combat.preview(barbarossa, data, map, adjacency, combat)
	assert.equal(profile.attacker_shift, -1)
	assert.equal(profile.defender_shift, 0)
	assert.equal(Combat.canCancelRetreat(barbarossa, data, map, adjacency, combat), false)

	const pause = combatGame({
		turn: 1,
		trench: { 2: 1 },
		trench_owner: { 2: "allied" },
		trench_kind: { 2: "soviet" },
		events: { von_paulus_pause: true },
	})
	profile = Combat.preview(pause, data, map, adjacency, combat)
	assert.equal(profile.attacker_shift, -1)
	assert.equal(profile.defender_shift, 1)
	assert.equal(Combat.canCancelRetreat(pause, data, map, adjacency, combat), false)
})

test("Barbarossa trench cancellation follows Soviet trench identity, including mixed defenders", () => {
	const data = {
		spaces: [null, { id: 1, name: "Attack", kind: "land", nation: "ge", terrain: "clear" }, { id: 2, name: "Defense", kind: "land", nation: "su", terrain: "clear" }],
		pieces: [
			null,
			{ id: 1, side: "axis", nation: "ge", size: "lcu", cf: 5, lf: 3, mf: 3, rcf: 3, rlf: 3, rmf: 3 },
			{ id: 2, side: "allied", nation: "su", size: "lcu", cf: 3, lf: 3, mf: 3, rcf: 2, rlf: 3, rmf: 3 },
			{ id: 3, side: "allied", nation: "br", size: "scu", cf: 1, lf: 1, mf: 3, rcf: 1, rlf: 1, rmf: 3 },
		],
	}
	const adjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]
	const map = combatMap()
	const barbarossa = combatGame({
		turn: 1,
		pieces: [0, 1, 2, 2],
		trench: { 2: 1 },
		trench_owner: { 2: "allied" },
		trench_kind: { 2: "soviet" },
		events: { barbarossa: true },
	})
	const mixedCombat = { origin_spaces: [1], defender_space: 2, attackers: [1], defenders: [2, 3] }
	let profile = Combat.preview(barbarossa, data, map, adjacency, mixedCombat)
	assert.equal(profile.attacker_shift, -1)
	assert.equal(profile.defender_shift, 0)
	assert.equal(Combat.canCancelRetreat(barbarossa, data, map, adjacency, mixedCombat), false)

	barbarossa.pieces = [0, 1, 0, 2]
	barbarossa.trench_kind[2] = "british"
	const britishCombat = { origin_spaces: [1], defender_space: 2, attackers: [1], defenders: [3] }
	profile = Combat.preview(barbarossa, data, map, adjacency, britishCombat)
	assert.equal(profile.attacker_shift, -1)
	assert.equal(profile.defender_shift, 1)
	assert.equal(Combat.canCancelRetreat(barbarossa, data, map, adjacency, britishCombat), true)
})

test("Allied Antwerp and attacks solely across either Skagerrak connection permit No Retreat", () => {
	const data = {
		spaces: [
			null,
			{ id: 1, name: "Jutland", kind: "land", nation: "dk", terrain: "clear" },
			{ id: 2, name: "Oslo", kind: "land", nation: "no", terrain: "clear" },
			{ id: 3, name: "Other", kind: "land", nation: "no", terrain: "clear" },
			{ id: 4, name: "Copenhagen", kind: "land", nation: "dk", terrain: "clear" },
			{ id: 5, name: "Malmo", kind: "land", nation: "sw", terrain: "clear" },
			{ id: 6, name: "Antwerp", kind: "land", nation: "be", terrain: "clear" },
		],
		pieces: [null, { id: 1, side: "axis", nation: "ge", size: "scu" }, { id: 2, side: "allied", nation: "br", size: "scu" }],
	}
	const game = combatGame({
		pieces: [0, 1, 2],
		control: [null, "axis", "allied", "axis", "axis", "allied", "allied"],
	})
	const map = combatMap()

	assert.equal(Combat.canCancelRetreat(game, data, map, [], { origin_spaces: [1], defender_space: 2, attackers: [1], defenders: [2] }), true)
	assert.equal(Combat.canCancelRetreat(game, data, map, [], { origin_spaces: [1, 3], defender_space: 2, attackers: [1], defenders: [2] }), false)
	assert.equal(Combat.canCancelRetreat(game, data, map, [], { origin_spaces: [4], defender_space: 5, attackers: [1], defenders: [2] }), true)
	assert.equal(Combat.canCancelRetreat(game, data, map, [], { origin_spaces: [3], defender_space: 6, attackers: [1], defenders: [2] }), true)
	game.control[6] = "axis"
	assert.equal(Combat.canCancelRetreat(game, data, map, [], { origin_spaces: [3], defender_space: 6, attackers: [1], defenders: [2] }), false)
})

test("Axis defenders in a Partisan space lose ordinary terrain and No Retreat but retain trenches", () => {
	const data = {
		spaces: [null, { id: 1, name: "Attack", kind: "land", nation: "su", terrain: "clear" }, { id: 2, name: "Partisan Fort", kind: "land", nation: "su", terrain: "mountain", fort: true }],
		pieces: [null, { id: 1, side: "allied", nation: "su", size: "lcu", cf: 3, lf: 3, mf: 3, rcf: 2, rlf: 3, rmf: 3 }, { id: 2, side: "axis", nation: "ge", size: "lcu", cf: 3, lf: 3, mf: 3, rcf: 2, rlf: 3, rmf: 3 }],
	}
	const adjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]
	const game = combatGame({ partisans: [2] })
	const combat = { origin_spaces: [1], defender_space: 2, attackers: [1], defenders: [2] }
	const map = combatMap({}, true)

	let profile = Combat.preview(game, data, map, adjacency, combat)
	assert.equal(profile.attacker_shift, 0)
	assert.equal(Combat.canCancelRetreat(game, data, map, adjacency, combat), false)

	game.trench[2] = 1
	game.trench_owner[2] = "axis"
	profile = Combat.preview(game, data, map, adjacency, combat)
	assert.equal(profile.attacker_shift, -1)
	assert.equal(profile.defender_shift, 1)
	assert.equal(Combat.canCancelRetreat(game, data, map, adjacency, combat), true)
})

test("Patton and Guderian cannot repeat a target or attack a second time from an OOS activation", () => {
	const states = {}
	CombatStates.register((name, spec) => {
		states[name] = spec
	})
	const state = states.event_extra_attack_target
	const data = {
		spaces: [null, { id: 1, name: "Origin", kind: "land", nation: "ge" }, { id: 2, name: "First target", kind: "land", nation: "su" }, { id: 3, name: "Second target", kind: "land", nation: "su" }],
		pieces: [null, { id: 1, side: "axis", nation: "ge", size: "lcu" }, { id: 2, side: "allied", nation: "su", size: "scu" }, { id: 3, side: "allied", nation: "su", size: "scu" }],
	}
	const adjacency = [
		[],
		[
			{ to: 2, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[{ to: 1, type: "regular" }],
		[{ to: 1, type: "regular" }],
	]
	const game = {
		turn: 6,
		action_round: 3,
		pieces: [0, 1, 2, 3],
		events: {},
		event: { extra_attack: { piece_id: 1, first_attack_completed: true, used: false } },
		action: { defended: [2], activation_supply: { 1: "full" } },
	}
	function targets() {
		const actions = {}
		state.prompt(
			{
				prompt() {},
				action(verb, nouns) {
					actions[verb] = nouns
				},
			},
			game,
			"Axis",
			{ data, adjacency },
		)
		return actions.space
	}

	assert.deepEqual(targets(), [3])
	game.action.activation_supply[1] = "oos"
	assert.deepEqual(targets(), [])
})

test("Rule 11.31 chooses the exact Soviet, German Panzer, SS, and Free French SCU types", () => {
	const data = {
		pieces: [
			null,
			{ id: 1, name: "SU 1 Ukr Mech Front", side: "allied", nation: "su", size: "lcu", unit_type: "mechanized" },
			{ id: 2, name: "SU Shock Army", side: "allied", nation: "su", size: "scu", unit_type: "corps" },
			{ id: 3, name: "SU Tank Army", side: "allied", nation: "su", size: "scu", unit_type: "mechanized" },
			{ id: 4, name: "SU SCU", side: "allied", nation: "su", size: "scu", unit_type: "corps" },
			{ id: 5, name: "GE 6SS Panzer Army", side: "axis", nation: "ge", size: "lcu", unit_type: "mechanized" },
			{ id: 6, name: "GE Armor SCU", side: "axis", nation: "ge", size: "scu", unit_type: "mechanized" },
			{ id: 7, name: "GE 1SS Armor Corps", side: "axis", nation: "ge", size: "scu", unit_type: "mechanized" },
			{ id: 8, name: "GE 5 Panzer Army", side: "axis", nation: "ge", size: "lcu", unit_type: "mechanized" },
			{ id: 9, name: "FF Army", side: "allied", nation: "ff", size: "lcu", unit_type: "army" },
			{ id: 10, name: "US SCU", side: "allied", nation: "us", size: "scu", unit_type: "corps" },
			{ id: 11, name: "FF SCU", side: "allied", nation: "ff", size: "scu", unit_type: "corps" },
		],
	}
	const game = { pieces: Array(data.pieces.length).fill("available"), reduced: [] }
	for (const pieceId of [2, 3, 4, 6, 7, 10, 11]) game.pieces[pieceId] = data.pieces[pieceId].side === "axis" ? "reserve:axis" : "reserve:allied"

	assert.equal(Combat.findLcuReplacement(game, data, 1), 4)
	assert.equal(Combat.findLcuReplacement(game, data, 5), 7)
	assert.equal(Combat.findLcuReplacement(game, data, 8), 6)
	assert.equal(Combat.findLcuReplacement(game, data, 9), 11)
})

function southwestData() {
	return {
		pieces: [
			null,
			{ id: 1, name: "SU Southwest Front", side: "allied", nation: "su", size: "lcu", unit_type: "mechanized", lf: 3, rlf: 3, traits: "non_replaceable" },
			{ id: 2, name: "SU Southwest Front (Infantry)", side: "allied", nation: "su", size: "lcu", unit_type: "army", lf: 3, rlf: 3 },
			{ id: 3, name: "SU SCU", side: "allied", nation: "su", size: "scu", unit_type: "corps", lf: 1, rlf: 1 },
		],
	}
}

test("Southwest Front elimination still places or consumes its mandatory matching SCU", () => {
	const data = southwestData()
	const combatGameState = {
		pieces: [0, 1, "available", "reserve:allied"],
		reduced: [1],
		stand_fast: {},
	}
	const combat = { attackers: [1], defenders: [], southwest_loss_taken: false }
	const outcome = Combat.applyStepLoss(combatGameState, data, combat, 1)
	assert.equal(combatGameState.pieces[1], "removed")
	assert.equal(combatGameState.pieces[2], "eliminated:allied")
	assert.equal(combatGameState.pieces[3], 1)
	assert.equal(outcome.scu_replacement, 3)
	assert.equal(combat.attackers.includes(3), true)

	const attritionGame = {
		turn: 5,
		pieces: [0, 1, "available", "reserve:allied"],
		reduced: [],
		stand_fast: {},
	}
	Logistics.eliminateForAttrition(attritionGame, data, 1)
	assert.equal(attritionGame.pieces[1], "removed")
	assert.equal(attritionGame.pieces[2], "eliminated:allied")
	assert.equal(attritionGame.pieces[3], "eliminated:allied")

	const noCorps = {
		pieces: [0, 1, "available", "available"],
		reduced: [1],
		stand_fast: {},
	}
	const permanent = Combat.applyStepLoss(noCorps, data, { attackers: [1], defenders: [] }, 1)
	assert.equal(permanent.permanent, true)
	assert.equal(noCorps.pieces[1], "removed")
	assert.equal(noCorps.pieces[2], "available")
})

test("Winter 42 German mechanized advance halts upon entering the Soviet Union", () => {
	const data = {
		spaces: [
			null,
			{ id: 1, name: "Border origin", kind: "land", nation: "ge", terrain: "clear" },
			{ id: 2, name: "Soviet border", kind: "land", nation: "su", terrain: "clear" },
			{ id: 3, name: "Soviet rear", kind: "land", nation: "su", terrain: "clear" },
		],
		pieces: [null, { id: 1, name: "GE Panzer Army", side: "axis", nation: "ge", size: "lcu", unit_type: "mechanized", mf: 5, rmf: 5 }],
	}
	const adjacency = [
		[],
		[{ to: 2, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
	]
	const game = combatGame({
		turn: 4,
		pieces: [0, 1],
		control: [null, "axis", "axis", "axis"],
		action: { attack_spaces: [], activation_supply: { 1: "full" } },
	})
	const combat = { origin_spaces: [1], defender_space: 2, attackers: [1], defenders: [], advanced: [], retreat_distance: 2 }
	const map = combatMap()

	let paths = Combat.legalAdvancePaths(game, data, map, adjacency, combat, 1)
	assert.deepEqual(paths.get(2), [2])
	assert.equal(paths.has(3), false)

	game.events.von_paulus_pause = true
	paths = Combat.legalAdvancePaths(game, data, map, adjacency, combat, 1)
	assert.deepEqual(paths.get(3), [2, 3])
})
