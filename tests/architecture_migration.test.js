"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const rules = require("../rules.js")
const State = require("../modules/core/state.js")
const States = require("../modules/states/index.js")
const View = require("../modules/view.js")
const CompatibilityStates = require("../modules/states/game.js")
const Engine = require("../modules/engine.js")

const EXPECTED_STATES = [
	"axis_setup_occupied_france",
	"axis_opening_choice",
	"allied_mulligan",
	"allied_mulligan_exchange",
	"axis_turn1_event",
	"turn1_stalin_orders",
	"orders_axis",
	"orders_allied",
	"orders_stand_fast",
	"axis_attrition",
	"allied_attrition",
	"allied_replacements",
	"axis_replacements",
	"replacement_place_lcu",
	"eliminated_theater_choice",
	"draw_discard_allied",
	"draw_discard_axis",
	"total_war_allied_pick",
	"total_war_axis_pick",
	"end_voluntary_elimination",
	"end_remove_trenches",
	"action_select",
	"partisan_space",
	"ops_activate",
	"ops_move",
	"ops_move_piece",
	"ops_entrench_roll",
	"sr_piece",
	"sr_destination",
	"sr_stalin_destination",
	"ops_combat",
	"combat_confirm",
	"combat_attacker_cc",
	"combat_defender_cc",
	"combat_panzerfaust",
	"combat_defender_losses",
	"combat_attacker_losses",
	"combat_retreat_option",
	"combat_retreat",
	"combat_retreat_piece",
	"combat_advance",
	"allied_invasion_reserve",
	"event_invasion_mode",
	"event_invasion_beach",
	"event_invasion_advance",
	"neutral_deployment",
	"event_combat_markers",
	"event_sorge_space",
	"event_sorge_marker",
	"event_reinforcement_lcu",
	"event_panzer_afrika_transfer",
	"event_front_replacement",
	"event_panzer_refit",
	"event_hedgehogs",
	"event_atlantic_wall",
	"event_east_wall",
	"event_final_production_surge",
	"event_banzai",
	"event_luftwaffe_supply",
	"event_extra_attack_prompt",
	"event_extra_attack_target",
	"event_extra_attack_confirm",
	"event_axis_marker_space",
	"event_axis_marker_type",
	"event_reinforcement_activation",
	"event_tito_space",
	"event_remove_partisans",
	"game_over",
	"flag_supply_warnings",
	"review_supply_warnings",
	"review_rollback_proposal",
]

function setupCampaignOpening(seed = 2) {
	let game = rules.setup(seed, "Campaign", {})
	while (game.state === "axis_setup_occupied_france") game = rules.action(game, "Axis", "space", rules.view(game, "Axis").actions.space[0])
	return rules.action(game, "Axis", "card", game.opening_cards[0])
}

test("workflow registry owns every reachable state exactly once", () => {
	assert.deepEqual(States.registeredStates().slice().sort(), EXPECTED_STATES.slice().sort())
	assert.equal(States.stateEntries().length, EXPECTED_STATES.length)
	for (const [name, spec] of States.stateEntries()) {
		assert.equal(typeof spec.prompt, "function", `${name} prompt`)
		assert.equal(typeof spec.undo, "boolean", `${name} undo metadata`)
	}
	assert.equal(CompatibilityStates.applyAction, States.applyAction)
	assert.equal(CompatibilityStates.stateView, States.stateView)
	assert.equal(Object.isFrozen(States), true)
	assert.equal(States.registry, undefined)
})

test("state projection provides Chinese prompts and actions only to the active role", () => {
	const game = rules.setup(7, "Campaign", {})
	const active = rules.view(game, "Axis")
	const inactive = rules.view(game, "Allied")
	const observer = rules.view(game, "Observer")
	assert.match(active.prompt, /[\u3400-\u9fff]/)
	assert.ok(active.actions.space.length > 0)
	assert.equal(active.actions.undo, 0)
	assert.equal(States.legalActions(game, "Axis").undo, undefined)
	assert.throws(() => rules.action(game, "Axis", "undo"), /illegal action/)
	assert.equal(inactive.prompt, "等待 轴心国 行动")
	assert.equal(observer.prompt, "等待 轴心国 行动")
	assert.equal(inactive.actions, undefined)
	assert.equal(observer.actions, undefined)
	assert.equal(rules.view(game, "Axis", true).actions, undefined)

	game.state = "allied_mulligan"
	game.active = "Allied"
	assert.equal(rules.view(game, "Axis").prompt, "等待 盟军 行动")
})

test("Campaign setup offers the Allied mulligan before Turn 1 when cards 2 and 24 are absent", () => {
	const game = setupCampaignOpening()
	const initialReinforcements = [2, 24].map((number) => Engine.cards.findCard(Engine.data, "allied", number))

	assert.equal(
		game.hands.allied.some((cardId) => initialReinforcements.includes(cardId)),
		false,
	)
	assert.equal(game.state, "allied_mulligan")
	assert.equal(game.active, "Allied")
	assert.equal(game.phase, "setup")
	assert.equal(game.action_round, 0)
})

test("Allied may pass the initial mulligan without changing any card pile", () => {
	let game = setupCampaignOpening()
	const before = {
		hand: game.hands.allied.slice(),
		deck: game.decks.allied.slice(),
		discard: game.discards.allied.slice(),
	}

	assert.equal(rules.view(game, "Allied").actions.pass, 1)
	game = rules.action(game, "Allied", "pass")

	assert.equal(game.state, "turn1_stalin_orders")
	assert.equal(game.active, "Axis")
	assert.equal(game.phase, "action")
	assert.equal(game.action_round, 6)
	assert.deepEqual(game.hands.allied, before.hand)
	assert.deepEqual(game.decks.allied, before.deck)
	assert.deepEqual(game.discards.allied, before.discard)
})

test("rule 4 Allied mulligan may retain one card and refill to seven", () => {
	let game = rules.setup(81, "Campaign", {})
	game.state = "allied_mulligan"
	game.active = "Allied"
	game.hands.allied = [1, 8]
	game.decks.allied = [7, 6, 5, 4, 3, 2]

	game = rules.action(game, "Allied", "card", 1)
	assert.equal(game.state, "turn1_stalin_orders")
	assert.equal(game.hands.allied.length, 7)
	assert.ok(game.hands.allied.includes(1))
	assert.ok(game.hands.allied.includes(2))
	assert.ok(!game.hands.allied.includes(8))
	assert.ok(game.discards.allied.includes(8))
	assert.equal(game.mulligan_keep, undefined)
})

test("allied mulligan still permits discarding the entire opening hand", () => {
	let game = rules.setup(82, "Campaign", {})
	game.state = "allied_mulligan"
	game.active = "Allied"
	game.hands.allied = [1, 8]
	game.decks.allied = [9, 7, 6, 5, 4, 3, 2]

	game = rules.action(game, "Allied", "discard_all")
	assert.equal(game.state, "turn1_stalin_orders")
	assert.equal(game.hands.allied.length, 7)
	assert.ok(!game.hands.allied.includes(1))
	assert.ok(!game.hands.allied.includes(8))
	assert.ok(game.discards.allied.includes(1))
	assert.ok(game.discards.allied.includes(8))
})

test("rule 4 second failed Allied mulligan exchanges a 3+ OPS card for card 24", () => {
	let game = rules.setup(83, "Campaign", {})
	game.state = "allied_mulligan_exchange"
	game.active = "Allied"
	game.hands.allied = [1, 3, 4, 5, 6, 7, 8]
	const card24 = Engine.cards.findCard(Engine.data, "allied", 24)
	game.decks.allied = game.decks.allied.filter((cardId) => !game.hands.allied.includes(cardId) && cardId !== card24)
	game.decks.allied.push(card24)
	const exchange = game.hands.allied.find((cardId) => Engine.cards.cardOps(Engine.data, cardId) >= 3)

	game = rules.action(game, "Allied", "card", exchange)
	assert.equal(game.state, "turn1_stalin_orders")
	assert.equal(game.hands.allied.length, 7)
	assert.ok(game.hands.allied.includes(card24))
	assert.ok(game.discards.allied.includes(exchange))
	assert.ok(!game.decks.allied.includes(card24))
})

test("Allied may pass the second mulligan exchange without changing any card pile", () => {
	let game = setupCampaignOpening()
	game.state = "allied_mulligan_exchange"
	const before = {
		hand: game.hands.allied.slice(),
		deck: game.decks.allied.slice(),
		discard: game.discards.allied.slice(),
	}

	assert.equal(rules.view(game, "Allied").actions.pass, 1)
	game = rules.action(game, "Allied", "pass")

	assert.equal(game.state, "turn1_stalin_orders")
	assert.equal(game.active, "Axis")
	assert.equal(game.phase, "action")
	assert.equal(game.action_round, 6)
	assert.deepEqual(game.hands.allied, before.hand)
	assert.deepEqual(game.decks.allied, before.deck)
	assert.deepEqual(game.discards.allied, before.discard)
})

test("view, static_view and query are read-only and clone public structures", () => {
	const game = rules.setup(9, "Campaign", {})
	game.secret = { future_choice: [1, 2, 3] }
	game.events.test_nested = { values: [1] }
	game.discards.allied = [1]
	game.discards.axis = [56]
	const before = JSON.stringify(game)
	const view = rules.view(game, "Axis")
	const staticResult = rules.static_view(game)
	const queryResult = rules.query(game, "Axis", "removed")
	const ownDiscard = rules.query(game, "Axis", "discard")
	const observerDiscard = rules.query(game, "Observer", "discard")
	const alliedSupply = rules.query(game, "Observer", "allied_supply")
	const axisSupply = rules.query(game, "Allied", "axis_supply")
	assert.equal(JSON.stringify(game), before)
	assert.equal(view.secret, undefined)
	assert.equal(view.action_log, undefined)
	assert.equal(view.decks, undefined)
	assert.equal(view.hands, undefined)
	assert.equal(view.schema_version, 5)
	assert.equal(view.data_version, 1)
	assert.equal(view.ruleset_version, 1)
	assert.deepEqual(staticResult, {
		schema_version: 5,
		data_version: 1,
		ruleset_version: 1,
		map: staticResult.map,
		scenario: "Campaign",
		options: game.options,
		reinforcement_catalog: staticResult.reinforcement_catalog,
	})
	view.pieces[1] = "tampered"
	view.events.test_nested.values.push(2)
	queryResult.axis.push(999)
	assert.notEqual(game.pieces[1], "tampered")
	assert.deepEqual(game.events.test_nested.values, [1])
	assert.equal(game.removed.axis.includes(999), false)
	assert.deepEqual(ownDiscard, [56])
	assert.equal(ownDiscard.includes(1), false)
	assert.equal(observerDiscard, null)
	assert.equal(alliedSupply.side, "allied")
	assert.equal(axisSupply.side, "axis")
	for (const result of [alliedSupply, axisSupply]) {
		for (const [pieceId, status] of Object.entries(result.pieces)) {
			assert.ok(["full", "limited", "oos"].includes(status))
			assert.equal(Engine.map.pieceSide(game, Engine.data, Number(pieceId)), result.side)
			assert.ok(Number.isInteger(game.pieces[pieceId]) && game.pieces[pieceId] > 0)
		}
	}
	ownDiscard.push(999)
	assert.equal(game.discards.axis.includes(999), false)
})

test("view normalization does not mutate additive fields in an older game", () => {
	const game = rules.setup(10, "Campaign", {})
	delete game.rp.tu
	delete game.action_track
	game.secret = { future_choice: [1, 2, 3] }
	const before = JSON.stringify(game)
	const view = rules.view(game, "Axis")
	const readable = View.readNormalized(game)
	readable.secret.future_choice.push(4)
	assert.equal(JSON.stringify(game), before)
	assert.equal(view.rp.tu, 0)
	assert.deepEqual(view.action_track, { allied: [], axis: [] })
	assert.deepEqual(view.hand_limit, { allied: 7, axis: 7 })
	assert.deepEqual(game.secret.future_choice, [1, 2, 3])
})

test("old schemas are rejected and current provenance is enforced", () => {
	const original = rules.setup(11, "Campaign", {})
	const legacy = State.clone(original)
	legacy.schema_version = 1
	assert.throws(() => rules.normalize_game(legacy), /不支持的存档版本 1/)
	assert.equal(rules.normalize_game(original), original)
	assert.throws(() => rules.normalize_game({ ...original, schema_version: 6 }), /不支持的存档版本 6/)
	assert.throws(() => rules.normalize_game({ ...original, data_version: 2 }), /不支持的数据版本 2/)
	assert.throws(() => rules.normalize_game({ ...original, ruleset_version: 2 }), /不支持的规则版本 2/)
})

test("forged verbs and nouns leave the state byte-equivalent", () => {
	const game = rules.setup(13, "Campaign", {})
	const before = JSON.stringify(game)
	assert.throws(() => rules.action(game, "Axis", "space", -1), /illegal action/)
	assert.equal(JSON.stringify(game), before)
	assert.throws(() => rules.action(game, "Axis", "forged", null), /illegal action/)
	assert.equal(JSON.stringify(game), before)
})
