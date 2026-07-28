"use strict"

const zlib = require("node:zlib")
const { ALLIED_ROLE, AXIS_ROLE } = require("../core/constants.js")
const { clone, log } = require("../core/state.js")
const I18n = require("../core/i18n.js")

const MAX_ROLLBACK_POINTS = 18
const COLLABORATION_STATES = new Set(["flag_supply_warnings", "review_supply_warnings", "review_rollback_proposal"])
const SNAPSHOT_OMIT_KEYS = new Set(["undo", "rollback", "rollback_state", "rollback_proposal", "supply_warning_resume", "_checkpoint_pending"])

function otherRole(role) {
	if (role === ALLIED_ROLE) return AXIS_ROLE
	if (role === AXIS_ROLE) return ALLIED_ROLE
	throw new Error(`unknown role: ${role}`)
}

function roleName(role) {
	if (role === ALLIED_ROLE) return I18n.message("core.role.allied")
	if (role === AXIS_ROLE) return I18n.message("core.role.axis")
	return String(role)
}

function encodeRollbackStates(states) {
	if (!states.length) return null
	return zlib.deflateRawSync(Buffer.from(JSON.stringify(states))).toString("base64")
}

function decodeRollbackStates(encoded) {
	if (!encoded) return []
	if (Array.isArray(encoded)) return clone(encoded)
	if (typeof encoded !== "string") throw new Error("invalid rollback state storage")
	return JSON.parse(zlib.inflateRawSync(Buffer.from(encoded, "base64")).toString("utf8"))
}

function historySnapshot(game) {
	const snapshot = {}
	for (const [key, value] of Object.entries(game)) {
		if (key === "log") {
			snapshot.log = null
			snapshot.log_length = Array.isArray(value) ? value.length : 0
			continue
		}
		if (key === "undo" || key === "rollback" || key === "rollback_state") {
			snapshot[key] = null
			continue
		}
		if (SNAPSHOT_OMIT_KEYS.has(key)) continue
		snapshot[key] = value === undefined ? undefined : clone(value)
	}
	return snapshot
}

function checkpointLabel(point) {
	return I18n.message(point.kind === "turn_start" ? "core.rollback.turn_start" : "core.rollback.action_round", {
		turn: point.turn,
		...(point.kind === "turn_start" ? {} : { round: point.round }),
		side: roleName(point.active),
	})
}

function saveRollbackPoint(game) {
	if (game.phase !== "action" || game.state !== "action_select") return false
	const states = decodeRollbackStates(game.rollback_state)
	game.rollback ||= []
	const point = {
		kind: game.action_round === 1 && game.active === AXIS_ROLE ? "turn_start" : "action_round",
		turn: game.turn,
		round: game.action_round,
		active: game.active,
		log_index: game.log.length,
		action_log_length: game.action_log.length,
	}
	point.name = checkpointLabel(point)
	const previous = game.rollback.at(-1)
	if (previous && previous.turn === point.turn && previous.round === point.round && previous.active === point.active && previous.action_log_length === point.action_log_length) return false
	game.rollback.push(point)
	states.push(historySnapshot(game))
	while (game.rollback.length > MAX_ROLLBACK_POINTS) {
		game.rollback.shift()
		states.shift()
	}
	game.rollback_state = encodeRollbackStates(states)
	return true
}

function markActionBoundary(game) {
	game._checkpoint_pending = true
}

function consumeActionBoundary(game) {
	if (!game._checkpoint_pending) return false
	delete game._checkpoint_pending
	return saveRollbackPoint(game)
}

function canProposeRollback(game) {
	return !!(game.phase === "action" && !COLLABORATION_STATES.has(game.state) && !game.rollback_proposal && Array.isArray(game.rollback) && game.rollback.length > 0)
}

function rollbackIndices(game) {
	return canProposeRollback(game) ? game.rollback.map((_, index) => index) : []
}

function proposeRollback(game, index) {
	if (!canProposeRollback(game) || !Number.isInteger(index) || index < 0 || index >= game.rollback.length) throw new Error(`invalid rollback point: ${index}`)
	const point = game.rollback[index]
	game.rollback_proposal = {
		proposer: game.active,
		reviewer: otherRole(game.active),
		resume_state: game.state,
		resume_active: game.active,
		action_log_length: game.action_log.length,
		index,
		name: point.name,
	}
	game.active = game.rollback_proposal.reviewer
	game.state = "review_rollback_proposal"
	return game
}

function markSkipActionLog(game) {
	Object.defineProperty(game, "__skip_action_log", {
		value: true,
		writable: true,
		configurable: true,
	})
	return game
}

function consumeSkipActionLog(game) {
	if (!game.__skip_action_log) return false
	delete game.__skip_action_log
	return true
}

function markPreserveUndo(game) {
	Object.defineProperty(game, "__preserve_undo", {
		value: true,
		writable: true,
		configurable: true,
	})
	return game
}

function consumePreserveUndo(game) {
	if (!game.__preserve_undo) return false
	delete game.__preserve_undo
	return true
}

function applyRollbackAudit(game, audit) {
	if (!audit || !Number.isInteger(audit.seed)) throw new Error("invalid rollback audit entry")
	if (audit.rollback_count !== undefined) {
		if (!Number.isInteger(audit.rollback_count) || audit.rollback_count < 0 || audit.rollback_count > MAX_ROLLBACK_POINTS) throw new Error("invalid rollback audit history")
		const states = decodeRollbackStates(game.rollback_state)
		game.rollback = audit.rollback_count ? (game.rollback || []).slice(-audit.rollback_count) : []
		game.rollback_state = encodeRollbackStates(audit.rollback_count ? states.slice(-audit.rollback_count) : [])
	}
	game.undo = []
	game.seed = audit.seed
	log(game, "core.log.rollback_accepted", { name: audit.name })
	game.action_log.push({
		player: "System",
		verb: "rollback_seed",
		noun: clone(audit),
	})
	return game
}

function acceptRollback(game, reviewer) {
	const proposal = game.rollback_proposal
	if (!proposal || reviewer !== proposal.reviewer || game.active !== proposal.reviewer) throw new Error("invalid rollback acceptance")
	const states = decodeRollbackStates(game.rollback_state)
	if (!states[proposal.index]) throw new Error(`missing rollback state: ${proposal.index}`)
	const currentSeed = game.seed
	const retainedPoints = game.rollback.slice(0, proposal.index + 1)
	const retainedStates = states.slice(0, proposal.index + 1)
	const currentLog = game.log
	const restored = clone(states[proposal.index])
	const logLength = Number(restored.log_length) || 0
	delete restored.log_length
	restored.log = currentLog.slice(0, logLength)
	restored.undo = []
	restored.rollback = retainedPoints
	restored.rollback_state = encodeRollbackStates(retainedStates)
	delete restored.rollback_proposal
	const audit = {
		seed: currentSeed,
		name: proposal.name,
		proposer: proposal.proposer,
		reviewer,
		rollback_count: retainedPoints.length,
	}
	applyRollbackAudit(restored, audit)
	return markSkipActionLog(restored)
}

function rejectRollback(game, reviewer) {
	const proposal = game.rollback_proposal
	if (!proposal || reviewer !== proposal.reviewer || game.active !== proposal.reviewer) throw new Error("invalid rollback rejection")
	game.state = proposal.resume_state
	game.active = proposal.resume_active
	game.action_log.length = proposal.action_log_length
	delete game.rollback_proposal
	return markPreserveUndo(markSkipActionLog(game))
}

function publicRollbackPoints(game) {
	return (game.rollback || []).map((point) => ({ ...point }))
}

function publicRollbackProposal(game) {
	if (!game.rollback_proposal) return null
	const { proposer, reviewer, index, name } = game.rollback_proposal
	return { proposer, reviewer, index, name }
}

function canFlagSupplyWarnings(game) {
	return !!(game.phase === "action" && !COLLABORATION_STATES.has(game.state) && !game.rollback_proposal && (game.active === ALLIED_ROLE || game.active === AXIS_ROLE))
}

function startSupplyWarnings(game) {
	if (!canFlagSupplyWarnings(game)) throw new Error("supply warnings are unavailable")
	if (game.supply_warning_owner !== game.active) game.supply_warnings = []
	game.supply_warning_owner = game.active
	game.supply_warning_resume = {
		state: game.state,
		active: game.active,
		phase: game.phase,
	}
	game.state = "flag_supply_warnings"
}

function legalWarningSpaces(data) {
	return data.spaces.filter((space) => space?.kind === "land").map((space) => space.id)
}

function toggleSupplyWarning(game, spaceId, data) {
	if (!legalWarningSpaces(data).includes(spaceId)) throw new Error(`invalid supply warning space: ${spaceId}`)
	game.supply_warnings ||= []
	const index = game.supply_warnings.indexOf(spaceId)
	if (index >= 0) game.supply_warnings.splice(index, 1)
	else game.supply_warnings.push(spaceId)
	game.supply_warnings.sort((a, b) => a - b)
}

function finishSupplyWarnings(game) {
	const resume = game.supply_warning_resume
	if (!resume) throw new Error("missing supply warning resume state")
	game.state = resume.state
	game.active = resume.active
	game.phase = resume.phase
	delete game.supply_warning_resume
	if (!game.supply_warnings?.length) {
		delete game.supply_warnings
		delete game.supply_warning_owner
	}
}

function interceptSupplyWarningReview(game) {
	if (!game.supply_warnings?.length) return false
	if (game.phase !== "action") {
		delete game.supply_warnings
		delete game.supply_warning_owner
		return false
	}
	if (game.state !== "action_select" || game.active === game.supply_warning_owner) return false
	game.supply_warning_resume = {
		state: game.state,
		active: game.active,
		phase: game.phase,
	}
	game.state = "review_supply_warnings"
	return true
}

function finishSupplyWarningReview(game) {
	const resume = game.supply_warning_resume
	if (!resume) throw new Error("missing supply warning review state")
	log(game, "core.log.supply_acknowledged", {
		side: game.active === ALLIED_ROLE ? { "zh-CN": "盟军", en: "The Allies" } : { "zh-CN": "轴心国", en: "The Axis" },
		count: game.supply_warnings.length,
	})
	game.state = resume.state
	game.active = resume.active
	game.phase = resume.phase
	delete game.supply_warning_resume
	delete game.supply_warnings
	delete game.supply_warning_owner
}

module.exports = Object.freeze({
	acceptRollback,
	applyRollbackAudit,
	canFlagSupplyWarnings,
	canProposeRollback,
	checkpointLabel,
	consumeActionBoundary,
	consumePreserveUndo,
	consumeSkipActionLog,
	decodeRollbackStates,
	finishSupplyWarningReview,
	finishSupplyWarnings,
	interceptSupplyWarningReview,
	legalWarningSpaces,
	markSkipActionLog,
	markActionBoundary,
	proposeRollback,
	publicRollbackPoints,
	publicRollbackProposal,
	rejectRollback,
	rollbackIndices,
	saveRollbackPoint,
	startSupplyWarnings,
	toggleSupplyWarning,
})
