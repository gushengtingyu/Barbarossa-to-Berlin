"use strict"

const { ALLIED, AXIS, AXIS_ROLE, ALLIED_ROLE, roleForSide } = require("../core/constants.js")
const { clearUndo, log, logH1 } = require("../core/state.js")
const { drawTo, totalWarDue } = require("./cards.js")
const Orders = require("./orders.js")
const Resources = require("./resources.js")
const CombatCards = require("./combat_cards.js")
const Invasions = require("./invasions.js")
const Collaboration = require("./collaboration.js")
const Events = require("./events.js")

const TURN_NAMES = Object.freeze([
	null,
	"1941年6月",
	"1941年夏季",
	"1941年秋季",
	"1942年冬季",
	"1942年春季",
	"1942年夏季",
	"1942年秋季",
	"1943年冬季",
	"1943年春季",
	"1943年夏季",
	"1943年秋季",
	"1944年冬季",
	"1944年春季",
	"1944年夏季",
	"1944年秋季",
	"1945年冬季",
	"1945年春季",
	"1945年夏季",
])
const TURN_NAMES_EN = Object.freeze([
	null,
	"June 1941",
	"Summer 1941",
	"Fall 1941",
	"Winter 1942",
	"Spring 1942",
	"Summer 1942",
	"Fall 1942",
	"Winter 1943",
	"Spring 1943",
	"Summer 1943",
	"Fall 1943",
	"Winter 1944",
	"Spring 1944",
	"Summer 1944",
	"Fall 1944",
	"Winter 1945",
	"Spring 1945",
	"Summer 1945",
])

const WINTER_VP_REQUIREMENTS = Object.freeze({
	4: 5,
	8: 6,
	12: 2,
	16: 1,
})

function setActive(game, side) {
	game.active = roleForSide(side)
	clearUndo(game)
}

function logTurnHeading(game) {
	if (game.turn_heading_turn === game.turn) return
	logH1(game, "turn.phase.turn_heading", {
		turn: game.turn,
		name: { "zh-CN": TURN_NAMES[game.turn], en: TURN_NAMES_EN[game.turn] },
	})
	game.turn_heading_turn = game.turn
}

function startAction(game, side, round, runtime) {
	const beginsRound = game.action_round !== round
	game.phase = "action"
	game.state = "action_select"
	game.action_round = round
	if (beginsRound) Orders.recordStandFastUnits(game, runtime.data)
	game.action = null
	setActive(game, side)
	log(game, "core.blank")
	if (beginsRound && round === 1) log(game, "action.log.phase", {}, "h2")
	log(game, "action.log.round", { turn: game.turn, round }, side === ALLIED ? "h3_allied" : "h3_axis")
	Collaboration.markActionBoundary(game)
}

function checkAutomaticVictory(game) {
	if (game.vp <= 0) {
		finish(game, ALLIED_ROLE, "turn.victory.allied_automatic")
		return true
	}
	if (game.vp >= 20 && !game.events.totaler_krieg) {
		finish(game, AXIS_ROLE, "turn.victory.axis_automatic")
		return true
	}
	return false
}

function winterVpSpaces(game, data) {
	const result = data.spaces.filter((space) => space?.vp && ["su", "eg", "iq"].includes(space.nation) && game.control[space.id] === AXIS)
	if (game.turn === 16) {
		const courland = data.spaces.find((space) => space?.name === "Courland")
		if (courland && game.control[courland.id] === AXIS) result.push(courland)
	}
	if (game.events.herkules) {
		const tobruk = data.spaces.find((space) => space?.name === "Tobruk")
		if (tobruk && game.control[tobruk.id] === AXIS) result.push(tobruk)
	}
	return result
}

function applyWinterVpPenalty(game, data) {
	const required = WINTER_VP_REQUIREMENTS[game.turn] || 0
	if (!required) return 0
	const controlled = winterVpSpaces(game, data).length
	const penalty = Math.max(0, required - controlled)
	if (penalty) {
		game.vp -= penalty
		log(game, "turn.log.winter_penalty", {
			turn_name: { "zh-CN": TURN_NAMES[game.turn], en: TURN_NAMES_EN[game.turn] },
			controlled,
			penalty,
			vp: game.vp,
		})
	} else log(game, "turn.log.winter_pass", { turn_name: { "zh-CN": TURN_NAMES[game.turn], en: TURN_NAMES_EN[game.turn] }, required })
	return penalty
}

function finishTurn(game, runtime) {
	runtime.map.syncPartisanVp(game, runtime.data)
	game.phase = "end"
	if (checkAutomaticVictory(game)) return
	applyWinterVpPenalty(game, runtime.data)
	if (checkAutomaticVictory(game)) return
	if (game.turn >= 18) return finish(game, AXIS_ROLE, "turn.victory.axis_campaign")
	game.turn += 1
	game.action_round = 0
	game.action_history = { [ALLIED]: [], [AXIS]: [] }
	game.action_track = { [ALLIED]: [], [AXIS]: [] }
	game.reinforcement_usage = { turn: game.turn, [ALLIED]: {}, [AXIS]: {} }
	game.invasion_usage = { turn: game.turn, used: null }
	game.phase = "orders"
	game.state = "orders_axis"
	game.orders = { axis: null, allied: null, placements: [] }
	game.stand_fast = {}
	game.stand_fast_round_units = {}
	setActive(game, AXIS)
	logTurnHeading(game)
}

function startDrawPhase(game) {
	game.phase = "draw"
	game.state = "draw_discard_allied"
	setActive(game, ALLIED)
	logH1(game, "turn.phase.draw")
}

function handLimit(game, side, runtime) {
	if (side === AXIS && game.phase === "draw" && game.events?.final_production_surge_draw_pending) return 7
	return Resources.handLimit(game, runtime.data, runtime.map, runtime.adjacency, side)
}

function completeDrawPhase(game, runtime) {
	drawTo(game, ALLIED, handLimit(game, ALLIED, runtime), true)
	drawTo(game, AXIS, handLimit(game, AXIS, runtime), true)
	if (game.events?.final_production_surge_draw_pending) {
		delete game.events.final_production_surge_draw_pending
		game.events.final_production_surge_draw_consumed_turn = game.turn
	}
	Resources.clearTemporaryHandLimitModifiers(game)
	clearUndo(game)
	game.phase = "end"
	game.state = "end_voluntary_elimination"
	setActive(game, ALLIED)
}

function finishDrawForSide(game, side, runtime) {
	clearUndo(game)
	if (side === ALLIED) {
		game.state = "draw_discard_axis"
		setActive(game, AXIS)
	} else if (totalWarDue(game)) {
		game.state = "total_war_allied_pick"
		setActive(game, ALLIED)
	} else {
		completeDrawPhase(game, runtime)
	}
}

function settleActionPhase(game) {
	Events.revealForeignArmiesEastAtEnd(game)
	CombatCards.discardAtEndOfTurn(game)
	if (game.turn > 1) {
		const penalties = Orders.applyPenalties(game)
		for (const side of penalties) log(game, "turn.log.mandated_offensive_failed", { side: side === ALLIED ? { "zh-CN": "盟军", en: "The Allies" } : { "zh-CN": "轴心国", en: "The Axis" } })
	}
	game.action = null
	game.event = null
}

function startAttrition(game, side, resumeAlliedAction = false) {
	if (resumeAlliedAction) game.resume_allied_action_after_axis_attrition = true
	else delete game.resume_allied_action_after_axis_attrition
	game.phase = "attrition"
	game.state = side === AXIS ? "axis_attrition" : "allied_attrition"
	setActive(game, side)
	logH1(game, "turn.phase.attrition")
}

function startEndPhases(game) {
	settleActionPhase(game)
	startAttrition(game, AXIS)
}

function finish(game, result, message) {
	if (game.state === "game_over") return game
	let descriptor
	if (typeof message === "string") descriptor = { key: message, params: {} }
	else if (message && typeof message === "object" && !Array.isArray(message) && typeof message.key === "string") {
		descriptor = {
			key: message.key,
			params: message.params === undefined ? {} : message.params,
			...(message.format !== undefined ? { format: message.format } : {}),
		}
	} else throw new Error("game-over message must be an i18n key or descriptor")

	log(game, descriptor.key, descriptor.params, descriptor.format === undefined ? "" : descriptor.format)
	game.result = result
	game.victory = {
		key: descriptor.key,
		params: { ...descriptor.params },
		...(descriptor.format ? { format: descriptor.format } : {}),
	}
	game.phase = "game_over"
	game.state = "game_over"
	game.active = "None"
	clearUndo(game)
	return game
}

function alliedControlsAllGermanSupplySpaces(game, data) {
	const sources = data.spaces.filter((space) => space?.kind === "land" && space.nation === "ge" && space.supply === "axis")
	if (game.events?.national_redoubt) {
		const munich = data.spaces.find((space) => space?.name === "Munich")
		if (munich && !sources.includes(munich)) sources.push(munich)
	}
	return sources.length > 0 && sources.every((space) => game.control[space.id] === ALLIED)
}

function continueAfterAction(game, side, runtime) {
	if (side === ALLIED && alliedControlsAllGermanSupplySpaces(game, runtime.data)) {
		finish(game, ALLIED_ROLE, "turn.victory.allied_german_supply")
		return
	}
	if (game.turn === 1) {
		if (side === AXIS) startAttrition(game, AXIS, true)
		else {
			settleActionPhase(game)
			startAttrition(game, ALLIED)
		}
		return
	}
	if (side === AXIS && game.action_round === 6) startAttrition(game, AXIS, true)
	else if (side === AXIS) startAction(game, ALLIED, game.action_round, runtime)
	else if (game.action_round < 6) startAction(game, AXIS, game.action_round + 1, runtime)
	else {
		settleActionPhase(game)
		startAttrition(game, ALLIED)
	}
}

function finishAction(game, side, runtime) {
	runtime.map.syncPartisanVp(game, runtime.data)
	Events.settleActionEvent(game)
	game.action_history[side].push(game.action?.mode || "pass")
	game.action_track ||= { [ALLIED]: [], [AXIS]: [] }
	game.action_track[side] ||= []
	const track =
		game.action?.track ||
		{
			ops: "ops",
			sr: "sr",
			rp: "rp",
			partisan: "partisans",
			event: "other_event",
		}[game.action?.mode]
	if (track) game.action_track[side].push(track)
	game.action = null
	game.event = null
	game.invasion = null
	if (side === ALLIED && alliedControlsAllGermanSupplySpaces(game, runtime.data)) {
		continueAfterAction(game, side, runtime)
		return
	}
	if (side === ALLIED && Invasions.transferCandidates(game, runtime.data, runtime.map, runtime.adjacency).length > 0) {
		game.state = "allied_invasion_reserve"
		setActive(game, ALLIED)
		return
	}
	continueAfterAction(game, side, runtime)
}

function finishInvasionReserve(game, runtime) {
	continueAfterAction(game, ALLIED, runtime)
}

function startAfterOrders(game, runtime) {
	if (game.turn === 1) logTurnHeading(game)
	startAction(game, AXIS, 1, runtime)
}

function create(runtime) {
	if (!runtime?.data || !runtime?.map || !runtime?.adjacency) throw new Error("turn system requires data, map, and adjacency")
	return Object.freeze({
		TURN_NAMES,
		WINTER_VP_REQUIREMENTS,
		alliedControlsAllGermanSupplySpaces: (game) => alliedControlsAllGermanSupplySpaces(game, runtime.data),
		applyWinterVpPenalty: (game) => {
			runtime.map.syncPartisanVp(game, runtime.data)
			return applyWinterVpPenalty(game, runtime.data)
		},
		checkAutomaticVictory: (game) => {
			runtime.map.syncPartisanVp(game, runtime.data)
			return checkAutomaticVictory(game)
		},
		completeDrawPhase: (game) => completeDrawPhase(game, runtime),
		finish,
		finishAction: (game, side) => finishAction(game, side, runtime),
		finishInvasionReserve: (game) => finishInvasionReserve(game, runtime),
		finishDrawForSide: (game, side) => finishDrawForSide(game, side, runtime),
		finishTurn: (game) => finishTurn(game, runtime),
		handLimit: (game, side) => handLimit(game, side, runtime),
		setActive,
		startAction: (game, side, round) => startAction(game, side, round, runtime),
		startAfterOrders: (game) => startAfterOrders(game, runtime),
		startDrawPhase,
		startEndPhases,
		winterVpSpaces: (game) => winterVpSpaces(game, runtime.data),
	})
}

module.exports = { create }
