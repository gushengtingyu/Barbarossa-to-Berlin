"use strict"

const Runtime = require("../runtime.js")
const State = require("../core/state.js")
const I18n = require("../core/i18n.js")
const Collaboration = require("../systems/collaboration.js")

const runtime = Object.freeze({
	data: Runtime.data,
	adjacency: Runtime.adjacency,
})

const registry = new Map()

class StateResult {
	constructor() {
		this._prompt = null
		this.actions = {}
	}

	prompt(key, params = {}) {
		this._prompt = typeof key === "string" ? I18n.message(key, params) : key
	}

	action(verb, nouns) {
		if (typeof verb !== "string" || !verb) throw new Error("action verb must be a non-empty string")
		if (nouns === undefined) {
			this.actions[verb] = 1
			return
		}
		const values = Array.isArray(nouns) ? nouns : [nouns]
		if (!values.length) return
		const prior = Array.isArray(this.actions[verb]) ? this.actions[verb] : []
		this.actions[verb] = [...new Set([...prior, ...values])]
	}
}

function registerState(name, spec) {
	if (typeof name !== "string" || !name) throw new Error("state name must be a non-empty string")
	if (registry.has(name)) throw new Error(`duplicate state registration: ${name}`)
	if (!spec || typeof spec !== "object") throw new Error(`state ${name} must be an object`)
	if (typeof spec.prompt !== "function") throw new Error(`state ${name} requires prompt`)
	for (const [key, value] of Object.entries(spec)) if (key !== "undo" && typeof value !== "function") throw new Error(`state ${name} field ${key} must be a function`)
	registry.set(name, Object.freeze({ undo: spec.undo !== false, ...spec }))
}

require("./states_turn.js").register(registerState, runtime)
require("./states_action.js").register(registerState, runtime)
require("./states_activation.js").register(registerState, runtime)
require("./states_combat.js").register(registerState, runtime)
require("./event_states.js").register(registerState, runtime)

function stateSpec(name) {
	const spec = registry.get(name)
	if (!spec) throw new Error(`unknown game state: ${name}`)
	return spec
}

function buildStateResult(game, role) {
	const spec = stateSpec(game.state)
	const result = new StateResult()
	spec.prompt(result, game, role, runtime)
	if (!result._prompt) throw new Error(`state ${game.state} produced an empty prompt`)
	for (const verb of Object.keys(result.actions)) if (typeof spec[verb] !== "function") throw new Error(`state ${game.state} exposes action ${verb} without a handler`)
	return { result, spec }
}

function availableActions(game, role, result, spec) {
	if (role !== game.active || game.state === "game_over") return {}
	const actions = { ...result.actions }
	if (spec.undo && State.canUndo(game)) actions.undo = 1
	const rollback = Collaboration.rollbackIndices(game)
	if (rollback.length) actions.propose_rollback = rollback
	if (Collaboration.canFlagSupplyWarnings(game)) actions.flag_supply_warnings = 1
	return actions
}

function stateView(game, role, options = {}) {
	const includeActions = options.includeActions !== false
	const { result, spec } = buildStateResult(game, role)
	const locale = game.options?.ui_locale
	const activeRole = game.active === "Allied" ? I18n.render(locale, "core.role.allied") : game.active === "Axis" ? I18n.render(locale, "core.role.axis") : String(game.active)
	const prompt = game.state !== "game_over" && role !== game.active ? I18n.render(locale, "core.waiting", { role: activeRole }) : I18n.render(locale, result._prompt)
	const view = { prompt }
	if (includeActions) {
		const actions = availableActions(game, role, result, spec)
		if (Object.keys(actions).length) view.actions = actions
	}
	return view
}

function legalActions(game, role) {
	return stateView(game, role).actions || {}
}

function isLegal(actions, verb, noun) {
	const legal = actions[verb]
	if (Array.isArray(legal)) return legal.includes(noun) || legal.includes(Number(noun))
	return legal === 1 && (noun === undefined || noun === null)
}

function applyAction(game, role, verb, noun) {
	const { result, spec } = buildStateResult(game, role)
	const actions = availableActions(game, role, result, spec)
	if (!isLegal(actions, verb, noun)) throw new Error(`illegal action: ${role} ${verb} ${noun ?? ""}`.trim())
	if (verb === "undo") return State.restoreUndo(game)
	if (verb === "propose_rollback") return Collaboration.proposeRollback(game, Number(noun))
	if (verb === "flag_supply_warnings") {
		Collaboration.startSupplyWarnings(game)
		return game
	}
	const handler = spec[verb]
	if (typeof handler !== "function") throw new Error(`state ${game.state} has no handler for ${verb}`)
	const undoRestoreState = Reflect.get(handler, "undo_restore_state")
	if (typeof undoRestoreState === "string") return Collaboration.markSkipActionLog(State.restoreUndoToState(game, undoRestoreState))
	const activeBefore = game.active
	const seedBefore = game.seed
	const undoGroup = Reflect.get(handler, "undo_group")
	if (spec.undo) State.pushUndo(game, typeof undoGroup === "string" ? `${game.active}:${game.state}:${undoGroup}` : null)
	const next = handler(game, role, noun, runtime) || game
	const changedPlayers = (activeBefore === "Allied" || activeBefore === "Axis") && (next.active === "Allied" || next.active === "Axis") && activeBefore !== next.active
	if (changedPlayers || next.seed !== seedBefore) State.clearUndo(next)
	return next
}

function registeredStates() {
	return [...registry.keys()]
}

function hasState(name) {
	return registry.has(name)
}

function stateEntries() {
	return [...registry.entries()]
}

module.exports = Object.freeze({
	applyAction,
	hasState,
	isLegal,
	legalActions,
	registeredStates,
	stateEntries,
	stateView,
})
