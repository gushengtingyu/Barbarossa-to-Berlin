"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog } = require("./i18n_helpers.js")
const rules = require("../rules.js")
const { data } = require("../data.js")

function axisCard(number) {
	return data.cards.find((card) => card?.side === "axis" && card.num === number).id
}

function alliedCard(number) {
	return data.cards.find((card) => card?.side === "allied" && card.num === number).id
}

function finishCampaignSetup(game) {
	while (game.state === "axis_setup_occupied_france") game = rules.action(game, "Axis", "space", rules.view(game, "Axis").actions.space[0])
	return game
}

function setupWithPlayableAlliedHand() {
	for (let seed = 1; seed < 1000; seed++) {
		let game = finishCampaignSetup(rules.setup(seed, "Campaign", {}))
		game = rules.action(game, "Axis", "card", axisCard(1))
		if (game.state === "turn1_stalin_orders") return finishTurnOneOrders(game)
	}
	throw new Error("could not find deterministic setup seed")
}

function finishTurnOneOrders(game) {
	while (game.state === "turn1_stalin_orders") {
		const actions = rules.view(game, "Axis").actions
		if (actions.continue) game = rules.action(game, "Axis", "continue")
		else game = rules.action(game, "Axis", "space", actions.space[0])
	}
	return game
}

function finishAxisOpeningEvent(game) {
	game = rules.action(game, "Axis", "play_event", axisCard(1))
	while (game.state === "event_combat_markers") {
		const actions = rules.view(game, "Axis").actions
		if (actions.continue) game = rules.action(game, "Axis", "continue")
		else game = rules.action(game, "Axis", "attack", actions.attack[0])
	}
	if (game.state === "ops_combat") game = rules.action(game, "Axis", "done")
	return game
}

function finishAxisOpeningAttrition(game) {
	game = finishAxisOpeningEvent(game)
	assert.equal(game.state, "axis_attrition")
	return rules.action(game, "Axis", "apply_attrition")
}

function finishTurnEndPhases(game) {
	assert.equal(game.state, "allied_attrition")
	game = rules.action(game, "Allied", "apply_attrition")
	if (game.state === "allied_replacements") game = rules.action(game, "Allied", "done")
	if (game.state === "axis_replacements") game = rules.action(game, "Axis", "done")
	for (const role of ["Allied", "Axis"]) {
		assert.equal(game.state, role === "Allied" ? "draw_discard_allied" : "draw_discard_axis")
		game = rules.action(game, role, "continue")
	}
	assert.equal(game.state, "end_voluntary_elimination")
	game = rules.action(game, "Allied", "done")
	for (const role of ["Allied", "Axis"]) {
		assert.equal(game.state, "end_remove_trenches")
		game = rules.action(game, role, "done")
	}
	return game
}

test("Rally rules contract is present", () => {
	assert.deepEqual(rules.scenarios, ["Campaign"])
	assert.deepEqual(rules.roles, ["Allied", "Axis"])
	for (const method of ["setup", "static_view", "view", "action", "query"]) assert.equal(typeof rules[method], "function")
})

test("card language is a create-game option and opening choices are visible actions", () => {
	let game = rules.setup(7, "Campaign", { card_language: "EN" })
	assert.equal(game.options.card_language, "EN")
	assert.equal(rules.static_view(game).options.card_language, "EN")
	game = finishCampaignSetup(game)
	const opening = rules.view(game, "Axis")
	assert.deepEqual(opening.actions.card, game.opening_cards)
	assert.equal(opening.prompt, "选择开局事件。")
	assert.deepEqual(opening.log, [])
})

test("setup and opening deal are deterministic", () => {
	let first = finishCampaignSetup(rules.setup(42, "Campaign", {}))
	let second = finishCampaignSetup(rules.setup(42, "Campaign", {}))
	first = rules.action(first, "Axis", "card", axisCard(2))
	second = rules.action(second, "Axis", "card", axisCard(2))
	assert.deepEqual(first, second)
	assert.equal(first.hands.axis.length, 7)
	assert.equal(first.hands.allied.length, 7)
	assert.equal(first.hands.axis.includes(axisCard(2)), true)
})

test("Campaign setup places the six printed starting trenches", () => {
	const game = rules.setup(1, "Campaign", {})
	const expected = {
		Bialystok: 1,
		Lwow: 2,
		Kishinev: 1,
		Tobruk: 1,
		Saar: 1,
		Stuttgart: 1,
	}
	for (const [name, level] of Object.entries(expected)) {
		const spaceId = data.spaces.findIndex((space) => space?.name === name)
		assert.equal(game.trench[spaceId], level, `${name} trench`)
	}
	assert.equal(Object.keys(game.trench).length, 6)
})

test("Axis deploys the reduced 1st and 7th Armies unstacked in Occupied France", () => {
	let game = rules.setup(1, "Campaign", {})
	assert.equal(game.state, "axis_setup_occupied_france")
	const pieceIds = game.setup_choice.occupied_france.pieces
	assert.equal(pieceIds.length, 2)
	assert.equal(
		pieceIds.every((pieceId) => game.reduced.includes(pieceId)),
		true,
	)
	const nevers = data.spaces.findIndex((space) => space?.name === "Nevers")
	assert.equal(data.spaces[nevers].side, "neutral")
	assert.equal(rules.view(game, "Axis").actions.space.includes(nevers), false)
	game.control[nevers] = "axis" // A setup game created before the data correction must still reject Nevers.
	assert.throws(() => rules.action(game, "Axis", "space", nevers), /illegal action/)
	const first = rules.view(game, "Axis").actions.space[0]
	game = rules.action(game, "Axis", "space", first)
	assert.equal(rules.view(game, "Axis").actions.space.includes(first), false)
	const second = rules.view(game, "Axis").actions.space[0]
	game = rules.action(game, "Axis", "space", second)
	assert.equal(game.state, "axis_opening_choice")
	assert.notEqual(game.pieces[pieceIds[0]], game.pieces[pieceIds[1]])
	for (const pieceId of pieceIds) {
		const location = data.spaces[game.pieces[pieceId]]
		assert.equal(location.nation, "fr")
		assert.equal(location.side, "axis")
	}
})

test("Axis setup placements remain undoable through the opening-card prompt", () => {
	let game = rules.setup(71, "Campaign", {})
	const first = rules.view(game, "Axis").actions.space[0]
	game = rules.action(game, "Axis", "space", first)
	assert.equal(rules.view(game, "Axis").actions.undo, 1)
	const second = rules.view(game, "Axis").actions.space.find((spaceId) => spaceId !== first)
	game = rules.action(game, "Axis", "space", second)
	assert.equal(game.state, "axis_opening_choice")
	assert.equal(rules.view(game, "Axis").actions.undo, 1)
	game = rules.action(game, "Axis", "undo")
	assert.equal(game.state, "axis_setup_occupied_france")
	assert.ok(rules.view(game, "Axis").actions.space.includes(second))
})

test("Turn 1 Axis places three legal Stalin Orders before its mandatory event", () => {
	let game
	for (let seed = 1; seed < 1000; seed++) {
		game = finishCampaignSetup(rules.setup(seed, "Campaign", {}))
		game = rules.action(game, "Axis", "card", axisCard(1))
		if (game.state === "turn1_stalin_orders") break
	}
	assert.equal(game.state, "turn1_stalin_orders")
	assert.equal(game.active, "Axis")
	const firstSpace = rules.view(game, "Axis").actions.space[0]
	game = rules.action(game, "Axis", "space", firstSpace)
	assert.equal(rules.view(game, "Axis").actions.undo, 1)
	game = rules.action(game, "Axis", "undo")
	assert.equal(game.stand_fast[firstSpace], undefined)
	assert.deepEqual(game.orders.placements, [])
	for (let count = 0; count < 3; count++) {
		const currentView = rules.view(game, "Axis")
		const actions = currentView.actions
		assert.match(currentView.prompt, new RegExp(`（${count}/3）`))
		assert.equal(actions.continue, undefined)
		assert.ok(actions.space.length > 0)
		game = rules.action(game, "Axis", "space", actions.space[0])
	}
	const completedView = rules.view(game, "Axis")
	assert.match(completedView.prompt, /（3\/3）/)
	assert.equal(completedView.actions.continue, 1)
	assert.equal(completedView.actions.space, undefined)
	assert.equal(Object.keys(game.stand_fast).length, 3)
	assert.deepEqual(new Set(Object.values(game.stand_fast)), new Set(["stalin"]))
	assert.throws(() => rules.action(game, "Axis", "space", firstSpace), /illegal action/)
	assert.equal(Object.keys(game.stand_fast).length, 3)
	game = rules.action(game, "Axis", "continue")
	assert.equal(game.state, "axis_turn1_event")
	assert.equal(game.undo.length, 0)
})

test("views redact opponent hands and reject forged actions", () => {
	const game = setupWithPlayableAlliedHand()
	const axis = rules.view(game, "Axis")
	const allied = rules.view(game, "Allied")
	const observer = rules.view(game, "Observer")
	assert.deepEqual(axis.hand, game.hands.axis)
	assert.deepEqual(allied.hand, game.hands.allied)
	assert.equal(observer.hand, undefined)
	assert.equal(axis.action_log, undefined)
	assert.deepEqual(axis.discard, game.discards.axis)
	assert.equal(axis.discards, undefined)
	assert.equal(allied.discard.includes(game.discards.axis[0]), false)
	assert.equal(axis.actions.card, undefined)
	assert.equal(allied.actions, undefined)
	assert.throws(() => rules.action(game, "Allied", "card", alliedCard(2)), /illegal action/)
})

test("action-round cards expose per-card menu actions without entering card mode", () => {
	let game = finishAxisOpeningAttrition(setupWithPlayableAlliedHand())
	const view = rules.view(game, "Allied")
	assert.equal(game.state, "action_select")
	assert.equal(view.actions.card, undefined)
	assert.deepEqual(view.actions.play_ops, game.hands.allied)
	const cardId = game.hands.allied[0]
	game = rules.action(game, "Allied", "play_ops", cardId)
	assert.equal(game.state, "ops_activate")
	assert.equal(game.action.card, cardId)
	assert.equal(game.action.track, "ops")
})

test("Turn 1 resolves each side's attrition immediately after its own action", () => {
	let game = finishAxisOpeningEvent(setupWithPlayableAlliedHand())
	assert.equal(game.phase, "attrition")
	assert.equal(game.state, "axis_attrition")
	assert.equal(game.active, "Axis")
	assert.equal(game.resume_allied_action_after_axis_attrition, true)
	assert.deepEqual(game.action_track.axis, ["other_event"])
	assert.deepEqual(game.action_track.allied, [])

	const isolatedPieces = data.pieces
		.filter((piece) => piece?.side === "axis" && piece.size === "scu")
		.slice(0, 2)
		.map((piece) => piece.id)
	const isolatedSpace = data.spaces.find((space) => space?.kind === "land" && space.nation === "su" && !space.supply).id
	const germanSupply = data.spaces.find((space) => space?.kind === "land" && space.nation === "ge" && space.supply === "axis").id
	game.pieces.fill(0)
	game.pieces[isolatedPieces[0]] = isolatedSpace
	game.control = data.spaces.map((space) => (space?.kind === "land" ? "allied" : null))
	game.control[isolatedSpace] = "axis"
	game.control[germanSupply] = "axis"

	game = rules.action(game, "Axis", "apply_attrition")
	assert.equal(game.pieces[isolatedPieces[0]], "eliminated:axis")
	assert.equal(game.control[isolatedSpace], "allied")
	assert.equal(game.phase, "action")
	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Allied")
	assert.equal(game.action_round, 6)
	assert.equal(game.resume_allied_action_after_axis_attrition, undefined)

	game.pieces[isolatedPieces[1]] = isolatedSpace
	game.control[isolatedSpace] = "axis"
	game = rules.action(game, "Allied", "auto_ops")
	game = rules.action(game, "Allied", "done")
	assert.equal(game.state, "allied_attrition")
	assert.equal(game.pieces[isolatedPieces[1]], isolatedSpace)
	game = rules.action(game, "Allied", "apply_attrition")
	assert.equal(game.pieces[isolatedPieces[1]], isolatedSpace)
})

test("Turn 1 opening event and Allied automatic OPS advance to Turn 2", () => {
	let game = setupWithPlayableAlliedHand()
	game = finishAxisOpeningAttrition(game)
	assert.equal(game.active, "Allied")
	assert.equal(game.state, "action_select")
	game = rules.action(game, "Allied", "auto_ops")
	assert.equal(game.action.track, "one_ops")
	game = rules.action(game, "Allied", "done")
	assert.deepEqual(game.action_track.axis, ["other_event"])
	assert.deepEqual(game.action_track.allied, ["one_ops"])
	assert.equal(game.state, "allied_attrition")
	assert.equal(game.active, "Allied")
	game = finishTurnEndPhases(game)
	assert.equal(game.turn, 2)
	assert.equal(game.state, "orders_axis")
	assert.equal(game.events.barbarossa, true)
	game = rules.action(game, "Axis", "continue")
	assert.match(renderLog(game).at(-1), /^轴心国：B[1-6] → (?:无命令|OKW强制攻势|希特勒命令)$/)
	assert.doesNotMatch(renderLog(game).at(-1), /(?:okw_mo|hitler_orders|none)/)
})

test("Barbarossa requires five distinct occupied combat-marker spaces", () => {
	let game = setupWithPlayableAlliedHand()
	game = rules.action(game, "Axis", "play_event", axisCard(1))
	assert.equal(game.state, "event_combat_markers")
	for (let count = 0; count < 5; count++) {
		const actions = rules.view(game, "Axis").actions
		assert.equal(actions.continue, undefined)
		const space = actions.attack[0]
		game = rules.action(game, "Axis", "attack", space)
		assert.equal(new Set(game.action.attack_spaces).size, count + 1)
	}
	assert.equal(rules.view(game, "Axis").actions.continue, 1)
	assert.throws(() => rules.action(game, "Axis", "attack", game.action.attack_spaces[0]), /illegal action/)
})

test("a Turn 1 Barbarossa combat resolves losses and automatically closes an empty combat step", () => {
	let game = setupWithPlayableAlliedHand()
	game = rules.action(game, "Axis", "play_event", axisCard(1))
	for (let count = 0; count < 5; count++) {
		const actions = rules.view(game, "Axis").actions
		const memel = actions.attack.find((spaceId) => data.spaces[spaceId].name === "Memel")
		game = rules.action(game, "Axis", "attack", memel || actions.attack[0])
	}
	game = rules.action(game, "Axis", "continue")
	const attacker = rules.view(game, "Axis").actions.piece[0]
	game = rules.action(game, "Axis", "piece", attacker)
	if (rules.view(game, "Axis").actions.select_all) game = rules.action(game, "Axis", "select_all")
	game = rules.action(game, "Axis", "space", rules.view(game, "Axis").actions.space[0])
	game = rules.action(game, "Axis", "confirm")
	for (let guard = 0; !["ops_combat", "action_select"].includes(game.state) && guard < 50; guard++) {
		const actions = rules.view(game, game.active).actions
		if (game.state === "combat_advance" && actions.move?.length) game = rules.action(game, game.active, "move", actions.move[0])
		else if (actions.piece?.length) game = rules.action(game, game.active, "piece", actions.piece[0])
		else if (actions.move?.length) game = rules.action(game, game.active, "move", actions.move[0])
		else if (actions.apply_attrition) game = rules.action(game, game.active, "apply_attrition")
		else if (actions.continue) game = rules.action(game, game.active, "continue")
		else if (actions.done) game = rules.action(game, game.active, "done")
		else assert.fail(`combat stalled in ${game.state}`)
	}
	assert.equal(game.state, "action_select")
	assert.ok(game.last_combat.attacker_die >= 1 && game.last_combat.attacker_die <= 6)
	assert.ok(game.last_combat.defender_die >= 1 && game.last_combat.defender_die <= 6)
	assert.ok(renderLog(game).some((entry) => /^> B[1-6](?: [+-] \d+ = \d+)? × /.test(entry)))
	assert.ok(renderLog(game).some((entry) => /^> W[1-6](?: [+-] \d+ = \d+)? × /.test(entry)))
	assert.equal(game.undo.length, 0)
	assert.equal(rules.view(game, "Axis").actions?.undo, undefined)
})

test("missing and future schemas are rejected during early development", () => {
	const game = rules.setup(1, "Campaign", {
		sunny_italy: "true",
		card_language: "EN",
	})
	delete game.schema_version
	assert.throws(() => rules.normalize_game(game), /不支持的存档版本/)
	game.schema_version = 99
	assert.throws(() => rules.normalize_game(game), /不支持的存档版本/)
})

test("recorded legal actions replay to a byte-equivalent normalized state", () => {
	let game = setupWithPlayableAlliedHand()
	const seed = game.initial_seed
	// setupWithPlayableAlliedHand has already recorded the opening-card choice.
	game = finishAxisOpeningAttrition(game)
	game = rules.action(game, "Allied", "auto_ops")
	game = rules.action(game, "Allied", "done")
	game = finishTurnEndPhases(game)
	const replayed = rules.replay(seed, "Campaign", game.options, game.action_log)
	assert.equal(JSON.stringify(replayed), JSON.stringify(game))
})
