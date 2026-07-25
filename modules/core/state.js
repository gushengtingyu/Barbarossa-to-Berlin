"use strict"

const { ALLIED, AXIS, DATA_VERSION, RULESET_VERSION, SCHEMA_VERSION } = require("./constants.js")
const I18n = require("./i18n.js")

function clone(value) {
	return JSON.parse(JSON.stringify(value))
}

const UNDO_PRESERVED_KEYS = new Set(["undo", "rollback", "rollback_state"])

function snapshot(game) {
	const saved = { undo: [] }
	for (const [key, value] of Object.entries(game)) {
		if (key === "log") {
			saved.log = Array.isArray(value) ? value.length : 0
			continue
		}
		if (UNDO_PRESERVED_KEYS.has(key)) continue
		saved[key] = value === undefined ? undefined : clone(value)
	}
	return saved
}

function pushUndo(game, group = null) {
	if (!Array.isArray(game.undo)) game.undo = []
	if (group && game.undo[game.undo.length - 1]?._undo_group === group) return false
	const saved = snapshot(game)
	if (group) saved._undo_group = group
	game.undo.push(saved)
	if (game.undo.length > 50) game.undo.shift()
	return true
}

function clearUndo(game) {
	game.undo = []
}

function canUndo(game) {
	if (!Array.isArray(game?.undo) || !game.undo.length) return false
	const owner = game.undo[game.undo.length - 1]?.active
	const current = game.active
	const ownerIsPlayer = owner === "Allied" || owner === "Axis"
	const currentIsPlayer = current === "Allied" || current === "Axis"
	return !ownerIsPlayer || !currentIsPlayer || owner === current
}

function restoreUndo(game) {
	if (!canUndo(game)) throw new Error("nothing to undo")
	const history = game.undo
	const restored = history.pop()
	delete restored._undo_group
	if (Number.isInteger(restored.log)) {
		const currentLog = Array.isArray(game.log) ? game.log : []
		currentLog.length = Math.min(currentLog.length, restored.log)
		restored.log = currentLog
	}
	restored.undo = history
	if (game.rollback !== undefined) restored.rollback = game.rollback
	if (game.rollback_state !== undefined) restored.rollback_state = game.rollback_state
	return restored
}

function restoreUndoToState(game, state) {
	if (!game.undo?.some((saved) => saved?.state === state)) throw new Error(`no undo checkpoint for state ${state}`)
	let restored = game
	do restored = restoreUndo(restored)
	while (restored.state !== state)
	return restored
}

function log(game, key, params = {}, format = "") {
	if (!Array.isArray(game.log)) game.log = []
	game.log.push(I18n.message(key, params, format))
}

function logH1(game, key, params = {}) {
	log(game, "core.blank")
	log(game, key, params, "h1")
	log(game, "core.blank")
}

function pieceLogRef(game, pieceId, reduced = null) {
	if (reduced === null) reduced = Array.isArray(game.reduced) && game.reduced.includes(pieceId)
	return `${reduced ? "p" : "P"}${pieceId}`
}

function formatDie(side, raw, drm = 0, result = raw) {
	if (!Number.isFinite(result)) return I18n.localized("未掷骰", "not rolled")
	const color = side === ALLIED ? "W" : "B"
	if (!Number.isFinite(raw)) return `${color}${result}`
	const modifier = Number(drm) || 0
	if (!modifier && raw === result) return `${color}${raw}`
	if (!modifier) return `${color}${raw} → ${result}`
	return `${color}${raw} ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)} = ${result}`
}

function normalizeOptions(options = {}) {
	const flag = (name) => options[name] === true || options[name] === "true" || options[name] === 1 || options[name] === "1"
	const cardLanguage = String(options.card_language || "").toUpperCase() === "EN" ? "EN" : "CN"
	return {
		ui_locale: I18n.normalizeLocale(options.ui_locale),
		card_language: cardLanguage,
		allied_2_24_exclusive_1941: flag("allied_2_24_exclusive_1941"),
		no_invasions_before_summer_42: flag("no_invasions_before_summer_42"),
		sunny_italy: flag("sunny_italy"),
		time_of_mud: flag("time_of_mud"),
	}
}

function migrateGame(game) {
	if (game.schema_version !== SCHEMA_VERSION) throw new Error(`不支持的存档版本 ${game.schema_version}；当前版本为 ${SCHEMA_VERSION}`)
	return game
}

function normalizeGame(game) {
	if (!game || typeof game !== "object") throw new Error("game state must be an object")
	game = migrateGame(game)
	if (game.data_version !== DATA_VERSION) throw new Error(`不支持的数据版本 ${game.data_version}；当前版本为 ${DATA_VERSION}`)
	if (game.ruleset_version !== RULESET_VERSION) throw new Error(`不支持的规则版本 ${game.ruleset_version}；当前版本为 ${RULESET_VERSION}`)
	game.options = normalizeOptions(game.options)
	game.log ||= []
	if (!Array.isArray(game.log) || game.log.some((entry) => !entry || typeof entry !== "object" || typeof entry.key !== "string")) throw new Error("invalid structured game log")
	game.action_log ||= []
	game.undo ||= []
	game.rollback ||= []
	game.rollback_state ||= null
	game.events ||= {}
	if (game.event?.attack_drm && !game.event.attack_modifier) {
		game.event.attack_modifier = {
			attacker_side: AXIS,
			nations: ["ge"],
			defender_nations: ["su"],
			drm: Number(game.event.attack_drm),
			no_retreat: false,
		}
		delete game.event.attack_drm
	}
	game.beachheads ||= {}
	game.invasion_usage ||= { turn: game.turn || 1, used: null }
	if (game.invasion) {
		game.invasion.markers ||= game.invasion.marker ? [game.invasion.marker] : null
		game.invasion.marker_option ||= game.invasion.markers?.length === 2 ? "double" : "single"
		game.invasion.beaches ||= game.invasion.beach_id
			? [
					{
						space_id: game.invasion.beach_id,
						letter: null,
						marker: game.invasion.markers?.[0] || game.invasion.marker || "allied",
						connected_land: game.invasion.connected_land || null,
					},
				]
			: []
	}
	game.neutrals ||= {
		tu: { at_war: false, controller: null },
		sw: { at_war: false, controller: null },
	}
	game.neutrals.tu ||= { at_war: false, controller: null }
	game.neutrals.sw ||= { at_war: false, controller: null }
	game.reduced ||= []
	game.control_nation ||= []
	game.retreat_history ||= []
	game.partisan_vp_adjustment ??= 0
	game.stand_fast ||= {}
	game.stand_fast_round_units ||= {}
	game.trench ||= {}
	game.trench_owner ||= {}
	game.trench_kind ||= {}
	game.destroyed_forts ||= []
	for (const spaceId of Object.keys(game.trench)) game.trench_owner[spaceId] ||= game.control?.[spaceId] || null
	if (!Object.hasOwn(game, "stalin_location")) game.stalin_location = 403
	game.eliminated_theater ||= {}
	game.theater_choice ||= null
	game.replacement ||= null
	game.replacement_usage ||= { turn: game.turn || 1, panzer_steps: 0 }
	game.replacement_usage.wehrkreis_applied ??= false
	game.replacement_usage.wehrkreis_count ??= 0
	game.replacement_usage.wehrkreis_deducted ??= 0
	game.reinforcement_usage ||= {
		turn: game.turn || 1,
		[ALLIED]: {},
		[AXIS]: {},
	}
	game.reinforcement_origin ||= {}
	game.hands ||= { [ALLIED]: [], [AXIS]: [] }
	game.decks ||= { [ALLIED]: [], [AXIS]: [] }
	game.discards ||= { [ALLIED]: [], [AXIS]: [] }
	game.removed ||= { [ALLIED]: [], [AXIS]: [] }
	game.combat_cards ||= { [ALLIED]: [], [AXIS]: [] }
	game.combat_cards[ALLIED] ||= []
	game.combat_cards[AXIS] ||= []
	game.combat_card_usage ||= { [ALLIED]: [], [AXIS]: [] }
	game.combat_card_usage[ALLIED] ||= []
	game.combat_card_usage[AXIS] ||= []
	game.action_history ||= { [ALLIED]: [], [AXIS]: [] }
	game.action_history[ALLIED] ||= []
	game.action_history[AXIS] ||= []
	game.action_track ||= { [ALLIED]: [], [AXIS]: [] }
	game.action_track[ALLIED] ||= []
	game.action_track[AXIS] ||= []
	game.rp ||= { ge: 0, axis: 0, br: 0, usa: 0, su: 0, tu: 0 }
	game.rp.tu ??= 0
	game.schema_version = SCHEMA_VERSION
	return game
}

module.exports = {
	canUndo,
	clearUndo,
	clone,
	formatDie,
	log,
	logH1,
	pieceLogRef,
	migrateGame,
	normalizeGame,
	normalizeOptions,
	pushUndo,
	restoreUndo,
	restoreUndoToState,
	snapshot,
}
