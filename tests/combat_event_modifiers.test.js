"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Combat = require("../modules/systems/combat.js")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine

const localData = {
	spaces: [null, { id: 1, name: "Attack", kind: "land", terrain: "clear" }, { id: 2, name: "Defense", kind: "land", terrain: "forest" }],
	pieces: [
		null,
		{
			id: 1,
			side: "allied",
			nation: "su",
			size: "lcu",
			cf: 4,
			lf: 3,
			rcf: 3,
			rlf: 3,
		},
		{
			id: 2,
			side: "axis",
			nation: "ge",
			size: "lcu",
			cf: 3,
			lf: 3,
			rcf: 2,
			rlf: 2,
		},
		{
			id: 3,
			side: "allied",
			nation: "br",
			size: "lcu",
			cf: 4,
			lf: 3,
			rcf: 3,
			rlf: 3,
		},
	],
}

const map = {
	traceSupply: () => "full",
	isFortIntactForSide: () => false,
}
const adjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]

function resolveWith(attackers, event) {
	const game = {
		seed: 411,
		turn: 10,
		pieces: [0, 1, 2, 1],
		reduced: [],
		trench: {},
		destroyed_forts: [],
		events: {},
		event,
	}
	const combat = {
		origin_spaces: [1],
		defender_space: 2,
		attackers,
		defenders: [2],
	}
	Combat.resolve(game, localData, map, adjacency, combat)
	return combat
}

function alliedCard(number) {
	return data.cards.find((card) => card?.side === "allied" && card.num === number).id
}

test("Uranus and Bagration are barred by Spring Thaw and become 5 OPS Soviet attack modifiers afterward", () => {
	for (const number of [22, 35]) {
		let game = rules.setup(420 + number, "Campaign", {})
		const id = alliedCard(number)
		game.turn = 9
		game.action_round = 1
		game.phase = "action"
		game.state = "action_select"
		game.active = "Allied"
		game.action_history = { allied: [], axis: [] }
		game.hands.allied = [id]
		assert.equal(Engine.events.canPlayEvent(game, data, id), false)
		game.action_round = 3
		assert.equal(Engine.events.canPlayEvent(game, data, id), true)
		game = rules.action(game, "Allied", "play_event", id)
		assert.equal(game.state, "ops_activate")
		assert.deepEqual(game.event.attack_modifier, {
			attacker_side: "allied",
			nations: ["su"],
			drm: 1,
			no_retreat: number === 35,
		})
		assert.equal(game.event.dual_ops, 5)
		assert.equal(game.removed.allied.includes(id), true)
	}
})

test("current action DRM applies only to pure Soviet attacks and legacy numeric Barbarossa saves still work", () => {
	const modifier = {
		attack_modifier: {
			attacker_side: "allied",
			nations: ["su"],
			drm: 1,
			no_retreat: false,
		},
	}
	assert.equal(resolveWith([1], modifier).attacker_drm, 1)
	assert.equal(resolveWith([3], modifier).attacker_drm, 0)
	assert.equal(resolveWith([1, 3], modifier).attacker_drm, 0)

	const legacyData = {
		spaces: localData.spaces,
		pieces: [null, { ...localData.pieces[2], id: 1, side: "axis", nation: "ge" }, { ...localData.pieces[1], id: 2, side: "allied", nation: "su" }],
	}
	const game = {
		seed: 433,
		turn: 1,
		pieces: [0, 1, 2],
		reduced: [],
		trench: {},
		destroyed_forts: [],
		events: {},
		event: { attack_drm: 1 },
	}
	const combat = {
		origin_spaces: [1],
		defender_space: 2,
		attackers: [1],
		defenders: [2],
	}
	Combat.resolve(game, legacyData, map, adjacency, combat)
	assert.equal(combat.attacker_drm, 1)
})

test("schema-v2 normalization converts legacy numeric attack DRM into the JSON modifier shape", () => {
	const legacyState = rules.setup(434, "Campaign", {})
	legacyState.event = { card_id: 56, attack_drm: 1 }
	const normalized = rules.normalize_game(legacyState)
	assert.equal(normalized.event.attack_drm, undefined)
	assert.deepEqual(normalized.event.attack_modifier, {
		attacker_side: "axis",
		nations: ["ge"],
		defender_nations: ["su"],
		drm: 1,
		no_retreat: false,
	})
})
test("Bagration blocks Axis No Retreat only against a qualifying Soviet attack", () => {
	const combat = { defender_space: 2, attackers: [1], defenders: [2] }
	const game = {
		turn: 10,
		pieces: [0, 1, 2, 1],
		reduced: [],
		trench: {},
		destroyed_forts: [],
		events: {},
		event: {
			attack_modifier: {
				attacker_side: "allied",
				nations: ["su"],
				drm: 1,
				no_retreat: true,
			},
		},
	}
	assert.equal(Combat.canCancelRetreat(game, localData, map, adjacency, combat), false)
	assert.equal(
		Combat.canCancelRetreat(game, localData, map, adjacency, {
			...combat,
			attackers: [3],
		}),
		true,
	)
	game.event.attack_modifier.no_retreat = false
	assert.equal(Combat.canCancelRetreat(game, localData, map, adjacency, combat), true)
})
