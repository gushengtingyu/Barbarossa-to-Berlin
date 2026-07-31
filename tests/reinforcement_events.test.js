"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog } = require("./i18n_helpers.js")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine
const adjacency = Engine.map.buildAdjacency(data)

function alliedCard(number) {
	return data.cards.find((card) => card?.side === "allied" && card.num === number).id
}

function axisCard(number) {
	return data.cards.find((card) => card?.side === "axis" && card.num === number).id
}

function pieceNamed(name) {
	return data.pieces.find((piece) => piece?.name === name).id
}

function spaceNamed(name) {
	return data.spaces.find((space) => space?.name === name).id
}

function prepareAlliedEvent(number, turn = 2, options = {}) {
	const game = rules.setup(73, "Campaign", options)
	const cardId = alliedCard(number)
	game.turn = turn
	game.phase = "action"
	game.state = "action_select"
	game.active = "Allied"
	game.action_round = 1
	game.action_history = { allied: [], axis: [] }
	game.hands.allied = [cardId]
	for (const pile of [game.decks.allied, game.discards.allied, game.removed.allied]) {
		for (let index = pile.indexOf(cardId); index >= 0; index = pile.indexOf(cardId)) pile.splice(index, 1)
	}
	return { game, cardId }
}

function startEvent(number, turn = 2) {
	let { game, cardId } = prepareAlliedEvent(number, turn)
	game = rules.action(game, "Allied", "play_event", cardId)
	return { game, cardId }
}

function prepareAxisEvent(number, turn = 2) {
	const game = rules.setup(79, "Campaign", {})
	const cardId = axisCard(number)
	game.turn = turn
	game.phase = "action"
	game.state = "action_select"
	game.active = "Axis"
	game.action_round = 1
	game.action_history = { allied: [], axis: [] }
	game.hands.axis = [cardId]
	for (const pile of [game.decks.axis, game.discards.axis, game.removed.axis]) {
		for (let index = pile.indexOf(cardId); index >= 0; index = pile.indexOf(cardId)) pile.splice(index, 1)
	}
	return { game, cardId }
}

function startAxisEvent(number, turn = 2) {
	let { game, cardId } = prepareAxisEvent(number, turn)
	game = rules.action(game, "Axis", "play_event", cardId)
	return { game, cardId }
}

function referenceReinforcementPlacementSpaces(game, unit) {
	if (unit.placement === "desert") return Engine.reinforcements.legalDesertArmyReinforcementSpaces(game, data, Engine.map, adjacency, unit.piece_id)
	if (unit.placement === "lcu_style") return Engine.reinforcements.legalLcuStyleReinforcementSpaces(game, data, Engine.map, adjacency, unit.piece_id)
	return Engine.reinforcements.legalLcuReinforcementSpaces(game, data, Engine.map, adjacency, unit.piece_id)
}

function referenceCanPlaceAllUnits(game, units) {
	const sandbox = { ...game, pieces: game.pieces.slice(), reduced: game.reduced.slice() }
	function place(index) {
		if (index >= units.length) return true
		const unit = units[index]
		const original = sandbox.pieces[unit.piece_id]
		for (const spaceId of referenceReinforcementPlacementSpaces(sandbox, unit)) {
			sandbox.pieces[unit.piece_id] = spaceId
			if (place(index + 1)) return true
			sandbox.pieces[unit.piece_id] = original
		}
		return false
	}
	return place(0)
}

function referenceLegalReinforcementSpaces(game) {
	const reinforcement = game.reinforcement
	const pieceId = reinforcement.lcus[reinforcement.index]
	let candidates
	if (reinforcement.placement_type === "desert") candidates = Engine.reinforcements.legalDesertArmyReinforcementSpaces(game, data, Engine.map, adjacency, pieceId)
	else if (reinforcement.placement_type === "lcu_style") candidates = Engine.reinforcements.legalLcuStyleReinforcementSpaces(game, data, Engine.map, adjacency, pieceId)
	else candidates = Engine.reinforcements.legalLcuReinforcementSpaces(game, data, Engine.map, adjacency, pieceId)
	const remaining = reinforcement.units.slice(reinforcement.index + 1)
	if (!remaining.length) return candidates
	return candidates.filter((spaceId) => {
		const sandbox = { ...game, pieces: game.pieces.slice(), reduced: game.reduced.slice() }
		sandbox.pieces[pieceId] = spaceId
		return referenceCanPlaceAllUnits(sandbox, remaining)
	})
}

test("Rule 7.62 prohibits Reinforcement Event cards on the June 1941 turn", () => {
	const { game, cardId } = prepareAlliedEvent(2, 1)
	assert.equal(Engine.events.canPlayEvent(game, data, cardId), false)
	assert.equal(rules.view(game, "Allied").actions.play_event, undefined)
})

test("optional Rule 7.62 permits only one of Allied Events 2 and 24 during 1941", () => {
	let prepared = prepareAlliedEvent(2, 2)
	prepared.game.options.allied_2_24_exclusive_1941 = true
	let game = rules.action(prepared.game, "Allied", "play_event", prepared.cardId)
	assert.equal(game.events.allied_2_24_played, prepared.cardId)

	prepared = prepareAlliedEvent(24, 3)
	prepared.game.options.allied_2_24_exclusive_1941 = true
	prepared.game.events.allied_2_24_played = alliedCard(2)
	assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), false)
	assert.equal(rules.view(prepared.game, "Allied").actions.play_event, undefined)

	prepared.game.turn = 4
	assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), true)
})

test("Allied Events 2 and 24 remain independent when the optional rule is disabled", () => {
	const { game, cardId } = prepareAlliedEvent(24, 3, { disable_optional_rules: true })
	game.events.allied_2_24_played = alliedCard(2)
	assert.equal(game.options.allied_2_24_exclusive_1941, false)
	assert.equal(Engine.events.canPlayEvent(game, data, cardId), true)
})

test("Allied card 2 places four Soviet Armies in Reserve and all four Fronts legally", () => {
	let { game, cardId } = startEvent(2)
	const fronts = ["SU Don Front", "SU Stalingrad Front", "SU Steppe Front", "SU Voronezh Front"].map(pieceNamed)
	assert.equal(game.state, "event_reinforcement_lcu")
	assert.deepEqual(game.reinforcement.lcus, fronts)
	assert.deepEqual(game.reinforcement.reserve_scus, [483, 484, 485, 486])
	assert.equal(
		game.reinforcement.reserve_scus.every((pieceId) => game.pieces[pieceId] === "reserve:allied"),
		true,
	)
	assert.equal(renderLog(game).at(-1), `c${cardId} -- 事件`)

	const berlin = data.spaces.find((space) => space?.name === "Berlin").id
	assert.equal(rules.view(game, "Allied").actions.space.includes(berlin), false)
	assert.throws(() => rules.action(game, "Allied", "space", berlin), /illegal action/)

	for (let index = 0; index < fronts.length; index++) {
		const view = rules.view(game, "Allied")
		assert.match(view.prompt, /部署.+方面军/)
		assert.ok(view.actions.space.length > 0)
		const spaceId = view.actions.space[0]
		assert.equal(data.spaces[spaceId].nation, "su")
		assert.equal(game.control[spaceId], "allied")
		assert.equal(Engine.map.traceSupply(game, data, adjacency, "allied", spaceId, "su"), "full")
		game = rules.action(game, "Allied", "space", spaceId)
		assert.ok(renderLog(game).includes(`盟军将P${fronts[index]}部署至s${spaceId}。`))
	}

	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Axis")
	assert.equal(game.reinforcement, null)
	assert.equal(
		fronts.every((pieceId) => Number.isInteger(game.pieces[pieceId])),
		true,
	)
	assert.equal(
		fronts.every((pieceId) => !Engine.combat.isReduced(game, pieceId)),
		true,
	)
	assert.equal(game.removed.allied.includes(cardId), true)
	assert.equal(game.reinforcement_usage.allied.su, true)
	assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(24)), false)
})

test("shared reinforcement search preserves every legal first placement", () => {
	let { game } = startEvent(2)
	while (game.state === "event_reinforcement_lcu") {
		const optimized = Engine.events.legalReinforcementSpaces(game, data)
		assert.deepEqual(optimized, referenceLegalReinforcementSpaces(game))
		game = rules.action(game, "Allied", "space", optimized[0])
	}
})

test("Allied card 24 uses its printed three Fronts and three ordinary Soviet Armies", () => {
	let { game, cardId } = startEvent(24, 3)
	const fronts = ["SU Bryansk Front", "SU Kalinin Front", "SU Volkhov Front"].map(pieceNamed)
	const reserveScus = game.reinforcement.reserve_scus.slice()
	assert.deepEqual(game.reinforcement.lcus, fronts)
	assert.deepEqual(reserveScus, [487, 488, 489])
	assert.equal(
		reserveScus.every((pieceId) => data.pieces[pieceId].name === "SU SCU"),
		true,
	)
	while (game.state === "event_reinforcement_lcu") {
		const actions = rules.view(game, "Allied").actions
		game = rules.action(game, "Allied", "space", actions.space[0])
	}
	assert.equal(
		fronts.every((pieceId) => Number.isInteger(game.pieces[pieceId])),
		true,
	)
	assert.equal(
		reserveScus.every((pieceId) => game.pieces[pieceId] === "reserve:allied"),
		true,
	)
	assert.equal(game.removed.allied.includes(cardId), true)
})

test("Industrial Evacuation is a conditional dual event and unlocks Tank Armies after four turns", () => {
	let { game, cardId } = prepareAlliedEvent(7, 2)
	assert.equal(Engine.events.eventOpsValue(game, data, cardId), 5)
	game = rules.action(game, "Allied", "play_event", cardId)
	assert.equal(game.events.industrial_evacuation, true)
	assert.equal(game.events.industrial_evacuation_turn, 2)
	assert.equal(game.state, "ops_activate")
	assert.equal(game.action.points, 5)
	assert.equal(game.action.mode, "ops")
	assert.equal(game.removed.allied.includes(cardId), true)
	assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(4)), false)

	game.turn = 6
	assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(4)), true)
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "allied"), 7)
	game.turn = 10
	assert.equal(Engine.resources.handLimit(game, data, Engine.map, adjacency, "allied"), 8)
})

test("Industrial Evacuation loses dual use outside Moscow, is event-only in Spring Thaw, and is barred after Axis occupation", () => {
	let prepared = prepareAlliedEvent(7, 2)
	prepared.game.stalin_location = spaceNamed("Kuibishev")
	assert.equal(Engine.events.eventOpsValue(prepared.game, data, prepared.cardId), 0)
	let selected = rules.action(prepared.game, "Allied", "play_event", prepared.cardId)
	assert.equal(selected.active, "Axis")

	prepared = prepareAlliedEvent(7, 5)
	prepared.game.action_round = 1
	assert.equal(Engine.events.eventOpsValue(prepared.game, data, prepared.cardId), 0)

	prepared = prepareAlliedEvent(7, 2)
	const german = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu").id
	Engine.map.enterSpace(prepared.game, data, german, spaceNamed("Moscow"))
	assert.equal(prepared.game.events.axis_occupied_moscow, true)
	assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), false)
})

test("Lend-Lease unlocks Soviet mechanized Front reinforcement cards only from a later turn", () => {
	let { game, cardId } = startEvent(14, 3)
	assert.equal(game.events.lend_lease, true)
	assert.equal(game.events.lend_lease_turn, 3)
	assert.equal(game.removed.allied.includes(cardId), true)
	assert.equal(game.active, "Axis")

	game.turn = 3
	assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(31)), false)
	game.turn = 4
	assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(31)), true)
	assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(37)), true)
	assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(39)), true)
})

test("cards 31, 37 and 39 replace eligible supplied 3-3-3 Fronts in place before granting OPS", () => {
	const cases = [
		[31, [451, 452, 453, 454], 4],
		[37, [455, 456, 457], 4],
		[39, [459, 460, 461], 5],
	]
	for (const [number, newFronts, ops] of cases) {
		let { game, cardId } = prepareAlliedEvent(number, 4)
		game.events.lend_lease = true
		game.events.lend_lease_turn = 3
		assert.equal(Engine.events.canPlayEvent(game, data, cardId), true)
		assert.equal(Engine.events.eventOpsValue(game, data, cardId), ops)
		game = rules.action(game, "Allied", "play_event", cardId)
		assert.equal(game.state, "event_front_replacement")
		assert.deepEqual(game.reinforcement.lcus, newFronts)

		for (let index = 0; index < newFronts.length; index++) {
			const view = rules.view(game, "Allied")
			const legal = Engine.events.legalFrontReplacementPieces(game, data)
			assert.deepEqual(view.actions.piece, legal)
			assert.equal(view.reinforcement.lcus[view.reinforcement.index], newFronts[index])
			assert.match(view.prompt, /满编 3-3-3 苏军方面军/)
			assert.equal(view.actions.piece.includes(newFronts[index]), false)
			assert.throws(() => rules.action(game, "Allied", "piece", newFronts[index]), /illegal action/)

			const oldFront = view.actions.piece.at(-1)
			const location = game.pieces[oldFront]
			game = rules.action(game, "Allied", "piece", oldFront)
			assert.equal(game.pieces[oldFront], "removed")
			assert.equal(game.pieces[newFronts[index]], location)
			assert.equal(Engine.combat.isReduced(game, newFronts[index]), false)
			assert.match(renderLog(game).at(-1), /原方面军移出游戏/)
		}

		assert.equal(game.state, "ops_activate")
		assert.equal(game.action.points, ops)
		assert.equal(game.action.mode, "ops")
		assert.equal(game.reinforcement, null)
		assert.equal(game.reinforcement_usage.allied.su, true)
		assert.equal(game.removed.allied.includes(cardId), true)
		assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(number === 31 ? 37 : 31)), false)
	}
})

test("mechanized Front reinforcements reject Spring Thaw, used Soviet allowances, reduced Fronts, and insufficient candidates", () => {
	let prepared = prepareAlliedEvent(31, 5)
	prepared.game.events.lend_lease = true
	prepared.game.events.lend_lease_turn = 4
	prepared.game.action_round = 1
	assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), false)
	prepared.game.action_round = 3
	assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), true)

	prepared.game.reinforcement_usage = {
		turn: 5,
		allied: { su: true },
		axis: {},
	}
	assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), false)

	prepared = prepareAlliedEvent(31, 4)
	prepared.game.events.lend_lease = true
	prepared.game.events.lend_lease_turn = 3
	const eligible = Engine.events.legalFrontReplacementPieces(prepared.game, data)
	Engine.combat.setReduced(prepared.game, eligible[0], true)
	assert.equal(Engine.events.legalFrontReplacementPieces(prepared.game, data).includes(eligible[0]), false)
	for (const pieceId of eligible.slice(1, 5)) Engine.combat.setReduced(prepared.game, pieceId, true)
	assert.equal(Engine.events.legalFrontReplacementPieces(prepared.game, data).length, 2)
	assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), false)
})

test("Allied card 4 places all six Tank Armies on the map using LCU reinforcement rules", () => {
	const tooEarly = prepareAlliedEvent(4, 5)
	tooEarly.game.events.industrial_evacuation = true
	tooEarly.game.events.industrial_evacuation_turn = 2
	assert.equal(Engine.events.canPlayEvent(tooEarly.game, data, tooEarly.cardId), false)

	let { game, cardId } = prepareAlliedEvent(4, 6)
	game.events.industrial_evacuation = true
	game.events.industrial_evacuation_turn = 2
	game = rules.action(game, "Allied", "play_event", cardId)
	const tanks = [469, 474, 475, 476, 477, 478]
	assert.equal(game.state, "event_reinforcement_lcu")
	assert.deepEqual(game.reinforcement.lcus, tanks)
	assert.deepEqual(game.reinforcement.labels_zh, ["苏联第1坦克集团军", "苏联第2坦克集团军", "苏联第3坦克集团军", "苏联第4坦克集团军", "苏联第5坦克集团军", "苏联第6坦克集团军"])

	while (game.state === "event_reinforcement_lcu") {
		const view = rules.view(game, "Allied")
		assert.ok(view.actions.space.length > 0)
		const spaceId = view.actions.space[0]
		assert.equal(data.spaces[spaceId].nation, "su")
		assert.equal(Engine.map.traceSupply(game, data, adjacency, "allied", spaceId, "su"), "full")
		game = rules.action(game, "Allied", "space", spaceId)
	}
	assert.equal(
		tanks.every((pieceId) => Number.isInteger(game.pieces[pieceId])),
		true,
	)
	assert.equal(
		tanks.every((pieceId) => !Engine.combat.isReduced(game, pieceId)),
		true,
	)
	assert.equal(game.reinforcement_usage.allied.su, true)
	assert.equal(game.removed.allied.includes(cardId), true)
	assert.equal(game.active, "Axis")
})

test("Sorge places optional Move or Combat markers on two distinct Soviet spaces", () => {
	let { game, cardId } = startEvent(11, 2)
	assert.equal(game.events.sorge, true)
	assert.equal(game.events.sorge_turn, 2)
	assert.equal(game.state, "event_sorge_space")
	assert.equal(game.removed.allied.includes(cardId), true)

	let view = rules.view(game, "Allied")
	assert.ok(view.actions.space.length > 1)
	assert.equal(
		view.actions.space.every((spaceId) => Engine.map.friendlyPiecesInSpace(game, data, "allied", spaceId).some((pieceId) => data.pieces[pieceId].nation === "su")),
		true,
	)
	assert.equal(view.actions.space.includes(spaceNamed("Berlin")), false)

	const moveSpace = view.actions.space[0]
	game = rules.action(game, "Allied", "space", moveSpace)
	view = rules.view(game, "Allied")
	assert.equal(view.action.event_space, moveSpace)
	assert.equal(view.actions.move_marker, 1)
	game = rules.action(game, "Allied", "move_marker")

	view = rules.view(game, "Allied")
	assert.equal(view.actions.space.includes(moveSpace), false)
	const combatSpace = view.actions.space[0]
	game = rules.action(game, "Allied", "space", combatSpace)
	game = rules.action(game, "Allied", "combat_marker")
	assert.equal(game.state, "ops_move")
	assert.deepEqual(game.action.move_spaces, [moveSpace])
	assert.deepEqual(game.action.attack_spaces, [combatSpace])
	assert.equal(game.action.activation_supply[Engine.map.friendlyPiecesInSpace(game, data, "allied", moveSpace)[0]] !== undefined, true)
})

test("Siberians requires Sorge and places all five Shock Armies before conditional OPS", () => {
	const blocked = prepareAlliedEvent(13, 3)
	assert.equal(Engine.events.canPlayEvent(blocked.game, data, blocked.cardId), false)

	let { game, cardId } = prepareAlliedEvent(13, 3)
	game.events.sorge = true
	game.events.sorge_turn = 2
	assert.equal(Engine.events.canPlayEvent(game, data, cardId), true)
	assert.equal(Engine.events.eventOpsValue(game, data, cardId), 3)
	game = rules.action(game, "Allied", "play_event", cardId)
	const shocks = [462, 465, 466, 467, 468]
	assert.equal(game.state, "event_reinforcement_lcu")
	assert.deepEqual(game.reinforcement.lcus, shocks)

	while (game.state === "event_reinforcement_lcu") {
		const view = rules.view(game, "Allied")
		const spaceId = view.actions.space[0]
		assert.equal(data.spaces[spaceId].nation, "su")
		assert.equal(Engine.map.traceSupply(game, data, adjacency, "allied", spaceId, "su"), "full")
		game = rules.action(game, "Allied", "space", spaceId)
	}
	assert.equal(game.state, "ops_activate")
	assert.equal(game.action.points, 3)
	assert.equal(
		shocks.every((pieceId) => Number.isInteger(game.pieces[pieceId])),
		true,
	)
	assert.equal(
		shocks.every((pieceId) => !Engine.combat.isReduced(game, pieceId)),
		true,
	)
	assert.equal(game.reinforcement_usage.allied.su, true)
	assert.equal(game.removed.allied.includes(cardId), true)
	game = rules.action(game, "Allied", "done")
	assert.equal(game.active, "Axis")
})

test("Siberians remains playable as an event during Spring Thaw without its provisional OPS", () => {
	let { game, cardId } = prepareAlliedEvent(13, 5)
	game.action_round = 1
	game.events.sorge = true
	game.events.sorge_turn = 4
	assert.equal(Engine.events.eventOpsValue(game, data, cardId), 0)
	game = rules.action(game, "Allied", "play_event", cardId)
	while (game.state === "event_reinforcement_lcu") game = rules.action(game, "Allied", "space", rules.view(game, "Allied").actions.space[0])
	assert.equal(game.active, "Axis")
	assert.equal(game.action, null)
})

test("Allied card 5 places the Desert Army only at Alexandria, Cairo, or Basra and one CW corps in Reserve", () => {
	let { game, cardId } = startEvent(5, 2)
	const desert = pieceNamed("BR Desert Army")
	assert.equal(game.state, "event_reinforcement_lcu")
	assert.deepEqual(
		rules
			.view(game, "Allied")
			.actions.space.slice()
			.sort((a, b) => a - b),
		["Alexandria", "Cairo", "Basra"].map(spaceNamed).sort((a, b) => a - b),
	)
	assert.equal(game.reinforcement.reserve_scus.length, 1)
	assert.equal(data.pieces[game.reinforcement.reserve_scus[0]].nation, "cw")
	assert.equal(game.pieces[game.reinforcement.reserve_scus[0]], "reserve:allied")
	game = rules.action(game, "Allied", "space", spaceNamed("Cairo"))
	assert.equal(game.pieces[desert], spaceNamed("Cairo"))
	assert.equal(Engine.combat.isReduced(game, desert), false)
	assert.equal(game.events.british_desert_reinforcements, true)
	assert.equal(game.events.british_desert_reinforcements_turn, 2)
	assert.equal(game.reinforcement_usage.allied.br, true)
	assert.equal(game.removed.allied.includes(cardId), true)
	assert.equal(game.active, "Axis")
	assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(26)), false)
})

test("Allied card 21 replaces a supplied on-map Desert Army with the full-strength British 8th Army", () => {
	let { game, cardId } = prepareAlliedEvent(21, 5)
	const desert = pieceNamed("BR Desert Army")
	const eighth = pieceNamed("BR 8 Army")
	game.events.us_buildup = true
	game.events.us_buildup_turn = 3
	game.events.british_desert_reinforcements = true
	game.events.british_desert_reinforcements_turn = 2
	game.pieces[desert] = spaceNamed("Alexandria")
	game.pieces[eighth] = "available"
	Engine.combat.setReduced(game, eighth, true)
	assert.equal(Engine.events.canPlayEvent(game, data, cardId), true)
	game = rules.action(game, "Allied", "play_event", cardId)
	assert.equal(game.pieces[desert], "removed")
	assert.equal(game.pieces[eighth], spaceNamed("Alexandria"))
	assert.equal(Engine.combat.isReduced(game, eighth), false)
	assert.equal(game.reinforcement_usage.allied.br, true)
	assert.equal(game.active, "Axis")

	const sameTurn = prepareAlliedEvent(21, 5)
	sameTurn.game.events.us_buildup = true
	sameTurn.game.events.us_buildup_turn = 5
	sameTurn.game.events.british_desert_reinforcements = true
	sameTurn.game.events.british_desert_reinforcements_turn = 2
	sameTurn.game.pieces[desert] = spaceNamed("Alexandria")
	assert.equal(Engine.events.canPlayEvent(sameTurn.game, data, sameTurn.cardId), false)

	const unsupplied = prepareAlliedEvent(21, 5)
	unsupplied.game.events.us_buildup = true
	unsupplied.game.events.us_buildup_turn = 3
	unsupplied.game.events.british_desert_reinforcements = true
	unsupplied.game.events.british_desert_reinforcements_turn = 2
	unsupplied.game.control = data.spaces.map(() => "axis")
	unsupplied.game.pieces[desert] = spaceNamed("Warsaw")
	assert.equal(Engine.events.canPlayEvent(unsupplied.game, data, unsupplied.cardId), false)
})

test("card 26 uses British-compatible non-Shingle entry and grants an activation on the Overlord beachhead", () => {
	let { game, cardId } = prepareAlliedEvent(26, 8)
	const canadian = pieceNamed("CW 1 Cdn Army")
	const overlord = spaceNamed("Beachhead D")
	const usBeach = spaceNamed("Beachhead E")
	const shingle = spaceNamed("Beachhead K")
	game.beachheads[overlord] = { type: "br", card_id: 33 }
	game.beachheads[usBeach] = { type: "us", card_id: 33 }
	game.beachheads[shingle] = { type: "allied", card_id: 46, shingle: true }
	for (const beach of [overlord, usBeach, shingle]) game.control[beach] = "allied"
	game = rules.action(game, "Allied", "play_event", cardId)
	const spaces = rules.view(game, "Allied").actions.space
	assert.equal(spaces.includes(overlord), true)
	assert.equal(spaces.includes(usBeach), false)
	assert.equal(spaces.includes(shingle), false)
	game = rules.action(game, "Allied", "space", overlord)
	assert.equal(game.pieces[canadian], overlord)
	assert.equal(game.state, "event_reinforcement_activation")
	assert.equal(rules.view(game, "Allied").actions.move_marker, 1)
	game = rules.action(game, "Allied", "move_marker")
	assert.equal(game.state, "ops_move")
	assert.deepEqual(game.action.move_spaces, [overlord])
	assert.equal(game.reinforcement_usage.allied.br, true)
	assert.equal(game.removed.allied.includes(cardId), true)
})

test("US reinforcement cards require prior-turn US Build-Up and share one US reinforcement allowance", () => {
	for (const [number, armyName] of [
		[38, "US 15 Army"],
		[40, "US 3 Army"],
		[41, "US 9 Army"],
	]) {
		let { game, cardId } = prepareAlliedEvent(number, 9)
		game.events.us_buildup = true
		game.events.us_buildup_turn = 8
		game.control[spaceNamed("Naples")] = "allied"
		assert.equal(Engine.events.canPlayEvent(game, data, cardId), true)
		game = rules.action(game, "Allied", "play_event", cardId)
		assert.equal(game.reinforcement.reserve_scus.length, 1)
		assert.equal(data.pieces[game.reinforcement.reserve_scus[0]].nation, "us")
		assert.equal(rules.view(game, "Allied").actions.space.includes(spaceNamed("Naples")), true)
		game = rules.action(game, "Allied", "space", spaceNamed("Naples"))
		assert.equal(game.pieces[pieceNamed(armyName)], spaceNamed("Naples"))
		assert.equal(game.state, "event_reinforcement_activation")
		game = rules.action(game, "Allied", "combat_marker")
		assert.equal(game.state, "ops_combat")
		assert.deepEqual(game.action.attack_spaces, [spaceNamed("Naples")])
		assert.equal(game.reinforcement_usage.allied.usa, true)
		assert.equal(Engine.events.canPlayEvent(game, data, alliedCard(number === 38 ? 40 : 38)), false)
	}

	const noBuildup = prepareAlliedEvent(38, 9)
	assert.equal(Engine.events.canPlayEvent(noBuildup.game, data, noBuildup.cardId), false)
	const sameTurn = prepareAlliedEvent(38, 9)
	sameTurn.game.events.us_buildup = true
	sameTurn.game.events.us_buildup_turn = 9
	assert.equal(Engine.events.canPlayEvent(sameTurn.game, data, sameTurn.cardId), false)
})

test("Antwerp requires Clearing the Scheldt and ordinary beachheads do not grant the reinforcement activation bonus", () => {
	let { game, cardId } = prepareAlliedEvent(26, 8)
	const canadian = pieceNamed("CW 1 Cdn Army")
	const antwerp = spaceNamed("Antwerp")
	const ordinaryBeach = spaceNamed("Beachhead D")
	game.control[antwerp] = "allied"
	game.beachheads[ordinaryBeach] = { type: "allied", card_id: 16 }
	game.control[ordinaryBeach] = "allied"
	game = rules.action(game, "Allied", "play_event", cardId)
	assert.equal(rules.view(game, "Allied").actions.space.includes(antwerp), false)
	assert.equal(rules.view(game, "Allied").actions.space.includes(ordinaryBeach), true)
	game = rules.action(game, "Allied", "space", ordinaryBeach)
	assert.equal(game.pieces[canadian], ordinaryBeach)
	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Axis")
	;({ game, cardId } = prepareAlliedEvent(26, 8))
	game.events.clearing_the_scheldt = true
	game.control[antwerp] = "allied"
	game = rules.action(game, "Allied", "play_event", cardId)
	assert.equal(rules.view(game, "Allied").actions.space.includes(antwerp), true)
	game = rules.action(game, "Allied", "space", antwerp)
	assert.equal(game.state, "event_reinforcement_activation")
	game = rules.action(game, "Allied", "pass")
	assert.equal(game.active, "Axis")
})

test("Rule 7.62 lets 1945 Antwerp reinforcements use Yellow Event OPS instead of the free marker", () => {
	let { game, cardId } = prepareAlliedEvent(26, 16)
	const canadian = pieceNamed("CW 1 Cdn Army")
	const antwerp = spaceNamed("Antwerp")
	game.events.clearing_the_scheldt = true
	game.control[antwerp] = "allied"
	game = rules.action(game, "Allied", "play_event", cardId)
	assert.equal(game.action.mode, "event")
	assert.equal(game.action.points, 0)
	game = rules.action(game, "Allied", "space", antwerp)
	assert.equal(game.pieces[canadian], antwerp)
	assert.equal(game.state, "event_reinforcement_activation")
	assert.equal(rules.view(game, "Allied").actions.yellow_ops, 1)

	game = rules.action(game, "Allied", "yellow_ops")
	assert.equal(game.state, "ops_activate")
	assert.equal(game.reinforcement, null)
	assert.equal(game.action.mode, "ops")
	assert.equal(game.action.points, data.cards[cardId].ops)
	assert.deepEqual(game.action.move_spaces, [])
	assert.deepEqual(game.action.attack_spaces, [])
	assert.ok(renderLog(game).some((entry) => /黄色事件/.test(entry)))

	for (const [turn, eligible] of [
		[15, false],
		[16, true],
		[18, true],
		[19, false],
	]) {
		const probe = prepareAlliedEvent(26, turn).game
		probe.events.clearing_the_scheldt = true
		probe.control[antwerp] = "allied"
		assert.equal(Engine.reinforcements.reinforcementYellowEventEligible(probe, data, canadian, antwerp), eligible)
	}
})

test("card 23 opens Allied-controlled Antwerp for supply and Western reinforcement entry", () => {
	let { game, cardId } = prepareAlliedEvent(23, 8)
	const antwerp = spaceNamed("Antwerp")
	game.control[antwerp] = "allied"
	assert.equal(Engine.events.canPlayEvent(game, data, cardId), true)
	game = rules.action(game, "Allied", "play_event", cardId)
	assert.equal(game.events.clearing_the_scheldt, true)
	assert.equal(game.removed.allied.includes(cardId), true)

	const canadian = pieceNamed("CW 1 Cdn Army")
	assert.equal(Engine.logistics.legalLcuReinforcementSpaces(game, data, Engine.map, adjacency, canadian).includes(antwerp), true)

	const blocked = prepareAlliedEvent(23, 8)
	assert.equal(Engine.events.canPlayEvent(blocked.game, data, blocked.cardId), false)
})

test("Rule 7.62 and Axis card 22 deploy Panzer Armee Afrika and transfer one supplied Panzer corps", () => {
	let { game, cardId } = prepareAxisEvent(22, 2)
	const panzerAfrika = pieceNamed("GE Panzer Armee Afrika")
	const tripoli = spaceNamed("Tripoli")
	assert.equal(Engine.events.canPlayEvent(game, data, cardId), true)
	game = rules.action(game, "Axis", "play_event", cardId)
	assert.equal(game.state, "event_panzer_afrika_transfer")
	assert.equal(game.pieces[panzerAfrika], tripoli)
	assert.equal(Engine.combat.isReduced(game, panzerAfrika), false)

	const legal = rules.view(game, "Axis").actions.piece
	assert.ok(legal.length > 0)
	const transferred = legal[0]
	game = rules.action(game, "Axis", "piece", transferred)
	assert.equal(game.pieces[transferred], "reserve:axis")
	assert.equal(game.reinforcement_usage.axis.ge, true)
	assert.equal(game.removed.axis.includes(cardId), true)
	assert.equal(game.active, "Allied")
})

test("Axis card 24 places one ordinary and one SS Panzer corps in the Reserve Box", () => {
	let { game, cardId } = prepareAxisEvent(24, 2)
	const ordinary = data.pieces.filter((piece) => piece?.name === "GE Armor SCU" && game.pieces[piece.id] === "available").map((piece) => piece.id)
	const ss = data.pieces.filter((piece) => ["GE 1SS Armor Corps", "GE 2SS Armor Corps"].includes(piece?.name) && game.pieces[piece.id] === "available").map((piece) => piece.id)
	game = rules.action(game, "Axis", "play_event", cardId)
	assert.deepEqual(
		[...ordinary, ...ss].filter((pieceId) => game.pieces[pieceId] === "reserve:axis"),
		[518, 571],
	)
	assert.equal(ordinary.filter((pieceId) => game.pieces[pieceId] === "reserve:axis").length, 1)
	assert.equal(ss.filter((pieceId) => game.pieces[pieceId] === "reserve:axis").length, 1)
	assert.equal(game.reinforcement_usage.axis.ge, true)
	assert.equal(Engine.events.canPlayEvent(game, data, axisCard(32)), false)
	assert.equal(game.active, "Allied")
})

for (const [number, names, reserveCount] of [
	[32, ["GE 10 Army", "GE 14 Army"], 2],
	[33, ["GE 15 Army", "GE 19 Army"], 2],
]) {
	test(`Axis card ${number} places its bracketed Armies reduced and two corps in Reserve`, () => {
		let { game } = startAxisEvent(number, 6)
		const armies = names.map(pieceNamed)
		assert.deepEqual(game.reinforcement.lcus, armies)
		assert.equal(game.reinforcement.reserve_scus.length, reserveCount)
		assert.equal(
			game.reinforcement.reserve_scus.every((pieceId) => game.pieces[pieceId] === "reserve:axis"),
			true,
		)
		for (const army of armies) {
			const spaceId = rules.view(game, "Axis").actions.space[0]
			game = rules.action(game, "Axis", "space", spaceId)
			assert.equal(Engine.combat.isReduced(game, army), true)
		}
		assert.equal(game.active, "Allied")
	})
}

for (const [number, name, reserveCount] of [
	[34, "GE 8 Army", 1],
	[37, "GE 1FJ Army", 0],
]) {
	test(`Axis card ${number} places ${name} at full strength`, () => {
		let { game } = startAxisEvent(number, 6)
		const army = pieceNamed(name)
		assert.equal(game.reinforcement.reserve_scus.length, reserveCount)
		const spaceId = rules.view(game, "Axis").actions.space[0]
		game = rules.action(game, "Axis", "space", spaceId)
		assert.equal(game.pieces[army], spaceId)
		assert.equal(Engine.combat.isReduced(game, army), false)
	})
}

test("Speer unlocks Axis cards 35 and 36 and cannot be played after Totaler Krieg", () => {
	let prepared = prepareAxisEvent(16, 5)
	let game = rules.action(prepared.game, "Axis", "play_event", prepared.cardId)
	assert.equal(game.events.speer, true)
	assert.equal(game.events.speer_turn, 5)

	prepared = prepareAxisEvent(16, 5)
	prepared.game.events.totaler_krieg = true
	assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), false)

	for (const [number, armyName, reserveNames] of [
		[35, "GE 5 Panzer Army", ["GE Armor SCU"]],
		[36, "GE 6SS Panzer Army", ["GE 1SS Armor Corps", "GE 2SS Armor Corps"]],
	]) {
		prepared = prepareAxisEvent(number, 6)
		assert.equal(Engine.events.canPlayEvent(prepared.game, data, prepared.cardId), false)
		prepared.game.events.speer = true
		prepared.game.events.speer_turn = 5
		game = rules.action(prepared.game, "Axis", "play_event", prepared.cardId)
		const reserve = game.reinforcement.reserve_scus[0]
		assert.equal(reserveNames.includes(data.pieces[reserve].name), true)
		assert.equal(game.pieces[reserve], "reserve:axis")
		const spaceId = rules.view(game, "Axis").actions.space[0]
		game = rules.action(game, "Axis", "space", spaceId)
		assert.equal(game.pieces[pieceNamed(armyName)], spaceId)
		assert.equal(Engine.combat.isReduced(game, pieceNamed(armyName)), false)
	}
})
