"use strict"

const Runtime = require("./modules/runtime.js")
const GameStates = require("./modules/states/index.js")
const View = require("./modules/view.js")
const Collaboration = require("./modules/systems/collaboration.js")

const Engine = Object.freeze({
	constants: require("./modules/core/constants.js"),
	state: require("./modules/core/state.js"),
	map: require("./modules/systems/map.js"),
	setup: require("./modules/systems/setup.js"),
})
const { data } = Runtime

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
	const result = GameStates.applyAction(game, player, verb, noun)
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

exports.query = View.query

exports.normalize_game = function normalizeGame(game) {
	game = Engine.state.normalizeGame(game)
	Engine.map.normalizeControlNations(game, data)
	Engine.map.syncPartisanVp(game, data)
	return game
}
