"use strict"

const Runtime = require("../runtime.js")
const Engine = Object.freeze({
	constants: require("../core/constants.js"),
	state: require("../core/state.js"),
	cards: require("../systems/cards.js"),
	events: require("../systems/events.js"),
	invasions: require("../systems/invasions.js"),
	map: Runtime.map,
	neutrals: require("../systems/neutrals.js"),
	weather: require("../systems/weather.js"),
	turn: Runtime.turn,
})

const { ALLIED, AXIS } = Engine.constants

function eligiblePartisanSpaces(game, data) {
	return Engine.events.legalPartisanSpaces(game, data)
}

function startCardAction(game, mode, points, track = mode) {
	game.action = {
		mode,
		track,
		points,
		move_spaces: [],
		attack_spaces: [],
		activation_cost: {},
		activation_supply: {},
		moved: [],
		sr_moved: [],
		stalin_moved: false,
		sr_reserve_entries: {},
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
}

function eventTrackType(game, side) {
	if (game.event?.invasion || game.invasion) return "allied_invasion"
	const nation = game.reinforcement?.nation
	if (side === ALLIED && nation === "br") return "br_reinf"
	if (side === ALLIED && nation === "usa") return "usa_reinf"
	if (side === ALLIED && nation === "su") return "su_reinf"
	if (side === AXIS && nation === "ge") return "ge_reinf"
	if (side === AXIS && nation) return "axis_reinf"
	return "other_event"
}

function discardPlayedCard(game, data, side, cardId, asEvent = false) {
	Engine.cards.discard(game, data, side, cardId, asEvent)
}

function logCardAction(game, cardId, usage, ops = 0) {
	const key = {
		event: "action.usage.event",
		ops: "action.usage.ops",
		sr: "action.usage.sr",
		rp: "action.usage.rp",
	}[usage]
	if (!key) throw new Error(`unknown card usage: ${usage}`)
	Engine.state.log(game, "action.log.card", { card: `c${cardId}`, usage: { key, params: usage === "ops" || usage === "sr" ? { ops } : {} } })
}

function addCardMenuActions(result, game, data, side, cardIds) {
	if (game.turn === 1 && side === AXIS) {
		result.action(
			"play_event",
			cardIds.filter((cardId) => Engine.events.canPlayEvent(game, data, cardId)),
		)
		return
	}
	if (Engine.weather.canPlayOpsCard(game)) result.action("play_ops", cardIds)
	if (game.action_history[side].at(-1) !== "sr") result.action("play_sr", cardIds)
	if (Engine.cards.canPlayRpCard(game, side)) result.action("play_rp", cardIds)
	result.action(
		"play_event",
		cardIds.filter((cardId) => Engine.events.canPlayEvent(game, data, cardId)),
	)
}

function vonPaulusAutoOpsRemaining(game, side) {
	if (side !== AXIS || game.turn !== 2) return 0
	return Math.max(0, Number(game.events?.axis_forced_auto_ops) || 0)
}

function mustTakeVonPaulusAutoOps(game, side) {
	const remaining = vonPaulusAutoOpsRemaining(game, side)
	return remaining > 0 && (remaining === 1 || game.action_round >= 3)
}

function playEventCard(game, role, noun, { data }) {
	const side = Engine.constants.sideForRole(role)
	const cardId = Number(noun)
	logCardAction(game, cardId, "event")
	Engine.events.playEvent(game, data, cardId)
	discardPlayedCard(game, data, side, cardId, true)
	const eventOps = Engine.events.eventOpsValue(game, data, cardId)
	game.action = {
		mode: eventOps ? "ops" : "event",
		track: eventTrackType(game, side),
		card: cardId,
		event_card: cardId,
		points: eventOps,
		move_spaces: [],
		attack_spaces: [],
		activation_cost: {},
		activation_supply: {},
		moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		piece: null,
	}
	if (eventOps) game.event.dual_ops = eventOps
	if (game.event?.invasion) game.state = game.invasion?.markers ? "event_invasion_beach" : "event_invasion_mode"
	else if (game.event?.reinforcement) game.state = "event_reinforcement_lcu"
	else if (game.event?.panzer_afrika_transfer) game.state = "event_panzer_afrika_transfer"
	else if (game.event?.front_replacement) game.state = "event_front_replacement"
	else if (game.event?.panzer_refit_pieces) game.state = "event_panzer_refit"
	else if (game.event?.hedgehog_spaces) game.state = "event_hedgehogs"
	else if (game.event?.atlantic_wall_spaces) game.state = "event_atlantic_wall"
	else if (game.event?.east_wall_spaces) game.state = "event_east_wall"
	else if (game.event?.final_production_surge_pieces) game.state = "event_final_production_surge"
	else if (game.event?.banzai_pieces) game.state = "event_banzai"
	else if (game.event?.luftwaffe_supply) game.state = "event_luftwaffe_supply"
	else if (game.event?.optional_axis_marker) game.state = "event_axis_marker_space"
	else if (game.event?.sorge_markers) game.state = "event_sorge_space"
	else if (game.event?.tito) game.state = "event_tito_space"
	else if (game.event?.remove_partisans) game.state = "event_remove_partisans"
	else if (game.event?.partisan_placements) {
		game.action.placements = game.event.partisan_placements
		game.action.placed = []
		game.state = "partisan_space"
	} else if (game.event?.combat_markers) game.state = "event_combat_markers"
	else if (eventOps) game.state = "ops_activate"
	else Engine.turn.finishAction(game, side)
}

function playRpCard(game, role, noun, { data }) {
	const side = Engine.constants.sideForRole(role)
	const cardId = Number(noun)
	logCardAction(game, cardId, "rp")
	Engine.cards.applyReplacementCard(game, data, side, cardId)
	discardPlayedCard(game, data, side, cardId)
	game.action = { mode: "rp", track: "rp", card: cardId }
	Engine.turn.finishAction(game, side)
}

function playOpsCard(game, role, noun, { data }) {
	const side = Engine.constants.sideForRole(role)
	const cardId = Number(noun)
	logCardAction(game, cardId, "ops", Engine.cards.cardOps(data, cardId))
	discardPlayedCard(game, data, side, cardId)
	startCardAction(game, "ops", Engine.cards.cardOps(data, cardId), "ops")
	game.action.card = cardId
	game.state = "ops_activate"
}

function playSrCard(game, role, noun, { data }) {
	const side = Engine.constants.sideForRole(role)
	const cardId = Number(noun)
	logCardAction(game, cardId, "sr", Engine.cards.cardOps(data, cardId))
	discardPlayedCard(game, data, side, cardId)
	startCardAction(game, "sr", Engine.cards.cardOps(data, cardId), "sr")
	game.action.card = cardId
	game.state = "sr_piece"
}

function register(registerState) {
	registerState("action_select", {
		inactive: { "zh-CN": "选择行动", en: "to choose an action" },
		prompt(result, game, role, { data }) {
			const side = Engine.constants.sideForRole(game.active)
			const cardIds = game.hands[side].slice()
			result.prompt("action.choose", { turn: game.turn, round: game.action_round })
			if (mustTakeVonPaulusAutoOps(game, side)) {
				result.action("auto_ops")
				return
			}
			addCardMenuActions(result, game, data, side, cardIds)
			result.action("auto_ops")
			if (!Engine.neutrals.isAtWar(game, "tu")) result.action("declare_turkey")
			if (!Engine.neutrals.isAtWar(game, "sw")) result.action("declare_sweden")
			if (side === ALLIED && game.events.partisans && game.partisans.length < 6) result.action("place_partisan")
			if (side === ALLIED && Engine.invasions.canDeclareNoMoreInvasions(game)) result.action("end_invasions")
		},
		play_event: playEventCard,
		play_rp: playRpCard,
		play_ops: playOpsCard,
		play_sr: playSrCard,
		auto_ops(game) {
			const side = Engine.constants.sideForRole(game.active)
			const vonPaulusRemaining = vonPaulusAutoOpsRemaining(game, side)
			Engine.state.log(game, "action.log.auto_ops")
			startCardAction(game, "ops", 1, "one_ops")
			if (vonPaulusRemaining) {
				game.events.axis_forced_auto_ops = vonPaulusRemaining - 1
				game.action.von_paulus_no_soviet_combat = true
			}
			game.state = "ops_activate"
		},
		declare_turkey(game, role, noun, { data }) {
			Engine.neutrals.declareWar(game, data, "tu", Engine.constants.sideForRole(role))
		},
		declare_sweden(game, role, noun, { data }) {
			Engine.neutrals.declareWar(game, data, "sw", Engine.constants.sideForRole(role))
		},
		place_partisan(game) {
			game.action = {
				mode: "partisan",
				track: "partisans",
				placements: game.turn >= 8 ? 2 : 1,
				placed: [],
			}
			game.state = "partisan_space"
		},
		end_invasions(game) {
			Engine.invasions.declareNoMoreInvasions(game)
		},
	})

	registerState("partisan_space", {
		prompt(result, game, role, { data }) {
			const spaces = eligiblePartisanSpaces(game, data)
			const mayPlace = game.action.placed.length < game.action.placements
			const placed = game.action.placed.length
			if (mayPlace) result.prompt("action.partisans.place", { placed, total: game.action.placements })
			else result.prompt("action.partisans.complete")
			if (mayPlace && spaces.length) result.action("space", spaces)
			if (game.action.placed.length > 0 || !spaces.length) result.action("done")
		},
		space(game, role, noun, { data }) {
			const side = Engine.constants.sideForRole(role)
			const spaceId = Number(noun)
			game.partisans.push(spaceId)
			Engine.map.syncPartisanVp(game, data)
			game.action.placed.push(spaceId)
			Engine.state.log(game, "action.log.partisan", { space: `s${spaceId}` })
			const complete = game.action.placed.length >= game.action.placements || !eligiblePartisanSpaces(game, data).length
			if (complete && !game.event?.partisan_placements) Engine.turn.finishAction(game, side)
		},
		done(game, role) {
			Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
		},
	})
}

module.exports = {
	eligiblePartisanSpaces,
	playEventCard,
	register,
	startCardAction,
}
