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
	const game = { turn: 5, action_round: 1 }
	assert.equal(Engine.weather.canPlayOpsCard(game), false)
	game.action_round = 2
	assert.equal(Engine.weather.canPlayOpsCard(game), false)
	game.action_round = 3
	assert.equal(Engine.weather.canPlayOpsCard(game), true)
	game.turn = 6
	game.action_round = 1
	assert.equal(Engine.weather.canPlayOpsCard(game), true)
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
})
