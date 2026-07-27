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

test("Spring Thaw blocks OPS cards only in the first two Spring rounds", () => {
	const game = { turn: 1, action_round: 6 }
	assert.equal(Engine.weather.isSpringTurn(game.turn), true)
	assert.equal(Engine.weather.canPlayOpsCard(game), true)
	for (const turn of [5, 9, 13, 17]) {
		game.turn = turn
		game.action_round = 1
		assert.equal(Engine.weather.canPlayOpsCard(game), false)
		game.action_round = 2
		assert.equal(Engine.weather.canPlayOpsCard(game), false)
		game.action_round = 3
		assert.equal(Engine.weather.canPlayOpsCard(game), true)
	}
	for (const turn of [2, 3, 4, 6, 7, 8]) {
		game.turn = turn
		game.action_round = 1
		assert.equal(Engine.weather.canPlayOpsCard(game), true)
	}
})

test("Turn Record Track seasons include June 1941 as Spring round 6", () => {
	const expected = [null, "spring", "summer", "fall", "winter", "spring", "summer", "fall", "winter", "spring", "summer", "fall", "winter", "spring", "summer", "fall", "winter", "spring", "summer"]
	for (let turn = 1; turn <= 18; turn++) assert.equal(Engine.weather.seasonForTurn(turn), expected[turn])
	assert.equal(Engine.weather.seasonForTurn(0), null)
	assert.equal(Engine.weather.seasonForTurn(19), null)
})

test("Spring Thaw is enforced by the Rally legal-action whitelist", () => {
	const game = rules.setup(6, "Campaign", {})
	const cardId = data.cards.find((card) => card?.side === "axis" && card.num === 3).id
	game.turn = 5
	game.action_round = 1
	game.state = "action_select"
	game.active = "Axis"
	game.hands.axis = [cardId]
	assert.equal(rules.view(game, "Axis").actions.play_ops, undefined)
	assert.throws(() => rules.action(game, "Axis", "play_ops", cardId), /illegal action/)
	game.action_round = 3
	assert.deepEqual(rules.view(game, "Axis").actions.play_ops, [cardId])
})

test("Spring Thaw still permits Automatic 1 OPS and printed Yellow Event OPS", () => {
	let game = rules.setup(1501, "Campaign", {})
	const okh = data.cards.find((card) => card?.side === "axis" && card.num === 3).id
	game.turn = 5
	game.action_round = 1
	game.phase = "action"
	game.state = "action_select"
	game.active = "Axis"
	game.events = {}
	game.action_history = { allied: [], axis: [] }
	game.hands.axis = [okh]
	const actions = rules.view(game, "Axis").actions
	assert.equal(actions.auto_ops, 1)
	assert.equal(actions.play_ops, undefined)
	assert.deepEqual(actions.play_event, [okh])
	game = rules.action(game, "Axis", "play_event", okh)
	assert.equal(game.state, "ops_activate")
	assert.equal(game.action.points, 2)

	game = rules.setup(1502, "Campaign", {})
	game.turn = 5
	game.action_round = 1
	game.phase = "action"
	game.state = "action_select"
	game.active = "Axis"
	game.action_history = { allied: [], axis: [] }
	game = rules.action(game, "Axis", "auto_ops")
	assert.equal(game.state, "ops_activate")
	assert.equal(game.action.points, 1)
})

test("Winter 42 gives German units in the USSR Limited Supply unless VPP was played", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 4, {})
	const german = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu").id
	const location = space("Brest Litovsk")
	game.pieces[german] = location
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.turn = 4
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "axis", location, "ge"), "limited")
	game.events.von_paulus_pause = true
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "axis", location, "ge"), "full")
})

test("Winter 42 leaves German movement allowance unchanged while removing mechanized status in the USSR", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1503, {})
	const panzer = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && piece.unit_type === "mechanized").id
	const location = space("Brest Litovsk")
	game.turn = 4
	game.pieces[panzer] = location
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.action = { activation_supply: { [panzer]: "limited" } }
	assert.equal(Engine.map.movementAllowance(game, data, adjacency, panzer), data.pieces[panzer].mf)
	assert.equal(Engine.map.isMechanizedInSupply(game, data, adjacency, panzer), false)
	game.events.von_paulus_pause = true
	assert.equal(Engine.map.isMechanizedInSupply(game, data, adjacency, panzer), true)
})

test("Winter 42 applies the German one-column penalty and removes non-trench defensive terrain", () => {
	const localData = {
		spaces: [null, { id: 1, nation: "su", terrain: "clear" }, { id: 2, nation: "su", terrain: "mountain" }],
		pieces: [
			null,
			{
				id: 1,
				side: "allied",
				nation: "su",
				size: "lcu",
				cf: 5,
				lf: 3,
				rcf: 3,
				rlf: 3,
			},
			{
				id: 2,
				side: "axis",
				nation: "ge",
				size: "lcu",
				cf: 5,
				lf: 3,
				rcf: 3,
				rlf: 3,
			},
		],
	}
	const game = {
		seed: 9,
		turn: 4,
		pieces: [0, 1, 2],
		reduced: [],
		trench: {},
		events: {},
		options: {},
	}
	const combat = {
		origin_spaces: [1],
		defender_space: 2,
		attackers: [1],
		defenders: [2],
	}
	Engine.combat.resolve(game, localData, { traceSupply: () => "full" }, [[], [{ to: 2 }], [{ to: 1 }]], combat)
	assert.equal(combat.attacker_shift, 0)
	assert.equal(combat.defender_shift, -1)
	assert.equal(Engine.combat.canCancelRetreat(game, localData, combat), false)
	game.trench[2] = 1
	assert.equal(Engine.combat.canCancelRetreat(game, localData, combat), true)
	delete game.trench[2]
	game.events.hedgehogs_turn = 4
	assert.equal(Engine.combat.canCancelRetreat(game, localData, combat), true)
})

test("Rule 15.3 blocks winter invasions only at beaches A-I", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1504, {})
	const spec = { letters: ["A", "I", "J", "K"] }
	game.beachheads = {}
	game.control = data.spaces.map((entry) => entry?.side || null)
	for (const candidate of data.spaces.filter((entry) => ["dz", "tn", "ly", "eg"].includes(entry?.nation))) game.control[candidate.id] = "allied"
	game.control[space("Syracuse")] = "allied"
	for (const turn of [4, 8, 12, 16]) {
		game.turn = turn
		assert.deepEqual(Engine.invasions.legalBeachLetters(game, data, spec), ["J", "K"])
	}
	game.turn = 3
	assert.deepEqual(Engine.invasions.legalBeachLetters(game, data, spec), ["A", "I", "J", "K"])
})
