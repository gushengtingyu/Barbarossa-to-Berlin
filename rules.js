"use strict"

const Runtime = require("./modules/runtime.js")
const GameStates = require("./modules/states/index.js")
const View = require("./modules/view.js")
const Collaboration = require("./modules/systems/collaboration.js")
const I18n = require("./modules/core/i18n.js")

const Engine = Object.freeze({
	constants: require("./modules/core/constants.js"),
	state: require("./modules/core/state.js"),
	map: require("./modules/systems/map.js"),
	setup: require("./modules/systems/setup.js"),
})
const { data } = Runtime
const { ALLIED_ROLE, AXIS_ROLE } = Engine.constants

function localizedRole(role) {
	if (role === ALLIED_ROLE) return I18n.message("core.role.allied")
	if (role === AXIS_ROLE) return I18n.message("core.role.axis")
	throw new Error(`invalid role: ${String(role)}`)
}

function isStrictJsonValue(value, ancestors = new Set()) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return true
	if (typeof value === "number") return Number.isFinite(value)
	if (!value || typeof value !== "object" || ancestors.has(value)) return false
	ancestors.add(value)

	let valid = true
	if (Array.isArray(value)) {
		const keys = Object.keys(value)
		valid = keys.length === value.length && keys.every((key, index) => key === String(index)) && Reflect.ownKeys(value).length === value.length + 1
		for (let index = 0; valid && index < value.length; index++) {
			const property = Object.getOwnPropertyDescriptor(value, String(index))
			valid = Boolean(property?.enumerable && Object.hasOwn(property, "value") && isStrictJsonValue(property.value, ancestors))
		}
	} else {
		valid = Object.getPrototypeOf(value) === Object.prototype && Object.getOwnPropertySymbols(value).length === 0
		for (const key of Object.keys(value)) {
			const property = Object.getOwnPropertyDescriptor(value, key)
			if (!property || !property.enumerable || !Object.hasOwn(property, "value") || !isStrictJsonValue(property.value, ancestors)) {
				valid = false
				break
			}
		}
		if (valid && Reflect.ownKeys(value).length !== Object.keys(value).length) valid = false
	}

	ancestors.delete(value)
	return valid
}

function sameJsonValue(left, right) {
	if (Object.is(left, right)) return true
	if (!left || !right || typeof left !== "object" || typeof right !== "object") return false
	if (Array.isArray(left) !== Array.isArray(right)) return false
	const leftKeys = Object.keys(left)
	const rightKeys = Object.keys(right)
	return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(right, key) && sameJsonValue(left[key], right[key]))
}

function replayDebugEntryJson(entry) {
	const actionTuple = Array.isArray(entry) && entry.length === 4 && Number.isSafeInteger(entry[0]) && entry[0] >= 0 && typeof entry[1] === "string" && entry[1].length === 2 && typeof entry[2] === "string" && entry[2].length > 0
	const pieTuple = Array.isArray(entry) && entry.length === 3 && Number.isSafeInteger(entry[0]) && entry[0] >= 0 && entry[1] === "invoked pie" && typeof entry[2] === "string"
	if (!actionTuple && !pieTuple) throw new Error("invalid replay debug tuple")
	try {
		if (!isStrictJsonValue(entry)) throw new Error("invalid replay debug tuple")
	} catch {
		throw new Error("invalid replay debug tuple")
	}

	let json
	let decoded
	try {
		json = JSON.stringify(entry)
		decoded = JSON.parse(json)
	} catch {
		throw new Error("invalid replay debug tuple")
	}
	if (!sameJsonValue(entry, decoded)) throw new Error("invalid replay debug tuple")
	return json
}

exports.scenarios = Engine.constants.SCENARIOS.slice()
exports.roles = Engine.constants.ROLES.slice()

exports.setup = function setup(seed, scenario = "Campaign", options = {}) {
	return Engine.setup.createInitialState(data, scenario, seed, options)
}

exports.static_view = View.staticView

exports.view = View.playerView

exports.action = function action(game, player, verb, noun) {
	game = Engine.state.normalizeGame(game)
	Engine.map.normalizeControlNations(game, data)
	if ((Number(game.partisan_vp_adjustment) || 0) !== Engine.map.partisanVpAdjustment(game, data)) game = Engine.state.clone(game)
	Engine.map.syncPartisanVp(game, data)
	const result = Engine.state.normalizeGame(GameStates.applyAction(game, player, verb, noun))
	Engine.map.syncPartisanVp(result, data)
	const skipActionLog = Collaboration.consumeSkipActionLog(result)
	if (verb !== "undo" && !skipActionLog)
		result.action_log.push({
			player,
			verb,
			noun: noun === undefined ? null : noun,
		})
	Collaboration.consumeActionBoundary(result)
	Collaboration.interceptSupplyWarningReview(result)
	return result
}

exports.replay = function replay(seed, scenario = "Campaign", options = {}, actions = []) {
	let game = exports.setup(seed, scenario, options)
	for (const entry of actions) {
		if (entry.player === "System" && entry.verb === "rollback_seed") Collaboration.applyRollbackAudit(game, entry.noun)
		else game = exports.action(game, entry.player, entry.verb, entry.noun)
	}
	return game
}

exports.resign = function resign(state, role) {
	const game = exports.normalize_game(state)
	if (game.state === "game_over") return game
	const loser = localizedRole(role)
	const result = role === ALLIED_ROLE ? AXIS_ROLE : ALLIED_ROLE
	return Runtime.turn.finish(
		game,
		result,
		I18n.message("turn.victory.resigned", {
			role: loser,
		}),
	)
}

exports.finish = function finish(state, result, message) {
	const game = exports.normalize_game(state)
	if (game.state === "game_over") return game
	const resignation = typeof message === "string" ? /^(Allied|Axis) resigned\.$/.exec(message) : null
	if (resignation) return exports.resign(game, resignation[1])
	if (typeof message !== "string") throw new Error("game-over message must be a string")
	return Runtime.turn.finish(game, result, I18n.message("turn.game_over", { result: message }))
}

exports.replay_debug_log = function replayDebugLog(state, entry) {
	const game = exports.normalize_game(state)
	Engine.state.log(game, "core.replay.debug", { entry: replayDebugEntryJson(entry) })
	return game
}

exports.query = View.query

exports.normalize_game = function normalizeGame(game) {
	game = Engine.state.normalizeGame(game)
	Engine.map.normalizeControlNations(game, data)
	Engine.map.syncPartisanVp(game, data)
	return game
}
