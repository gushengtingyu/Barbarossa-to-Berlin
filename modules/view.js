"use strict"

const Runtime = require("./runtime.js")
const GameStates = require("./states/index.js")
const Locations = require("./core/unit_locations.js")
const I18n = require("./core/i18n.js")

const Engine = Object.freeze({
	constants: require("./core/constants.js"),
	state: require("./core/state.js"),
	collaboration: require("./systems/collaboration.js"),
	events: require("./systems/events.js"),
	map: require("./systems/map.js"),
	adjacency: Runtime.adjacency,
	turn: Runtime.turn,
})
const { data } = Runtime
const supplyViewCache = new WeakMap()
const INVALID_STRUCTURED_LOG = "invalid structured game log"
const REPLAY_DEBUG_LOG_KEY = "core.replay.debug"

function offMapUnits(game) {
	const result = []
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		const piece = data.pieces[pieceId]
		if (!piece || piece.size === "marker") continue
		const location = game.pieces[pieceId]
		const parsed = Locations.parse(location)
		if (!["available", "reserve", "eliminated", "turn_track", "removed", "setup_choice"].includes(parsed.kind)) continue
		result.push({
			piece_id: pieceId,
			side: Engine.map.pieceSide(game, data, pieceId),
			nation: piece.nation,
			size: piece.size,
			location: parsed.kind,
			...(parsed.side ? { pool_side: parsed.side } : {}),
			...(parsed.turn ? { turn: parsed.turn, turns_remaining: Math.max(0, parsed.turn - game.turn) } : {}),
			...(game.eliminated_theater?.[pieceId] ? { theater: game.eliminated_theater[pieceId] } : {}),
			...(game.reinforcement_origin?.[pieceId] ? { reinforcement_card_id: game.reinforcement_origin[pieceId] } : {}),
			reduced: game.reduced.includes(pieceId),
		})
	}
	return result
}

function readNormalizedState(game) {
	if (!game || typeof game !== "object") throw new Error("game state must be an object")
	const sourceLog = game.log
	const logCursor = Number.isSafeInteger(sourceLog) && sourceLog >= 0 ? sourceLog : undefined
	if (sourceLog !== undefined && sourceLog !== null && !Array.isArray(sourceLog) && logCursor === undefined) throw new Error(INVALID_STRUCTURED_LOG)
	const cloned = Engine.state.clone(game)
	if (logCursor !== undefined) cloned.log = []
	const normalized = Engine.state.normalizeGame(cloned)
	Engine.map.normalizeControlNations(normalized, data)
	Engine.map.syncPartisanVp(normalized, data)
	return { game: normalized, logCursor }
}

function readNormalized(game) {
	return readNormalizedState(game).game
}

function replayDebugTuple(entry) {
	const params = entry.params
	if (!params || typeof params !== "object" || Array.isArray(params) || Object.keys(params).length !== 1 || typeof params.entry !== "string") throw new Error("invalid replay debug log entry")
	let tuple
	try {
		tuple = JSON.parse(params.entry)
	} catch {
		throw new Error("invalid replay debug log entry")
	}
	if (!Array.isArray(tuple)) throw new Error("invalid replay debug log entry")
	const actionTuple = tuple.length === 4 && Number.isSafeInteger(tuple[0]) && tuple[0] >= 0 && typeof tuple[1] === "string" && tuple[1].length === 2 && typeof tuple[2] === "string" && tuple[2].length > 0
	const pieTuple = tuple.length === 3 && Number.isSafeInteger(tuple[0]) && tuple[0] >= 0 && tuple[1] === "invoked pie" && typeof tuple[2] === "string"
	if (!actionTuple && !pieTuple) throw new Error("invalid replay debug log entry")
	return tuple
}

function renderLog(locale, log, isReplay) {
	return log.map((entry) => (isReplay && entry.key === REPLAY_DEBUG_LOG_KEY ? replayDebugTuple(entry) : I18n.render(locale, entry)))
}

function staticView(game) {
	game = readNormalized(game)
	return {
		schema_version: game.schema_version,
		data_version: game.data_version,
		ruleset_version: game.ruleset_version,
		map: data.meta.map,
		scenario: game.scenario,
		options: game.options,
		reinforcement_catalog: data.reinforcement_catalog,
	}
}

function playerView(game, player, isReplay = false) {
	const sourceGame = game
	const normalized = readNormalizedState(game)
	game = normalized.game
	const locale = game.options.ui_locale
	const side = Engine.constants.sideForRole(player)
	const state = GameStates.stateView(game, player, {
		includeActions: !isReplay,
	})
	const supply = supplyView(game, sourceGame)
	const result = {
		schema_version: game.schema_version,
		data_version: game.data_version,
		ruleset_version: game.ruleset_version,
		active: game.active,
		state: game.state,
		phase: game.phase,
		turn: game.turn,
		action_round: game.action_round,
		vp: game.vp,
		stalin_location: game.stalin_location,
		hand_limit: {
			allied: Engine.turn.handLimit(game, Engine.constants.ALLIED),
			axis: Engine.turn.handLimit(game, Engine.constants.AXIS),
		},
		prompt: state.prompt,
		log: normalized.logCursor === undefined ? renderLog(locale, game.log, isReplay) : normalized.logCursor,
		pieces: game.pieces,
		reduced: game.reduced,
		control: game.control,
		control_nation: game.control_nation,
		trench: game.trench,
		trench_owner: game.trench_owner,
		trench_kind: game.trench_kind,
		destroyed_forts: game.destroyed_forts,
		beachheads: game.beachheads,
		stand_fast: game.stand_fast,
		partisans: game.partisans,
		oos: supply.oos.slice(),
		limited_supply: supply.limited.slice(),
		discard_count: {
			allied: game.discards.allied.length,
			axis: game.discards.axis.length,
		},
		removed: game.removed,
		combat_cards: game.combat_cards,
		hand_count: {
			allied: game.hands.allied.length,
			axis: game.hands.axis.length,
		},
		deck_count: {
			allied: game.decks.allied.length,
			axis: game.decks.axis.length,
		},
		rp: game.rp,
		events: game.events,
		active_event_card_id: game.event?.card_id ?? null,
		event_selection: {
			banzai_pieces: game.event?.banzai_pieces || [],
			extra_attack_piece: game.event?.extra_attack?.piece_id ?? null,
			panzer_refit_pieces: game.event?.panzer_refit_pieces || [],
			hedgehog_spaces: game.event?.hedgehog_spaces || [],
			atlantic_wall_spaces: game.event?.atlantic_wall_spaces || [],
			east_wall_spaces: game.event?.east_wall_spaces || [],
			final_production_surge_pieces: game.event?.final_production_surge_pieces || [],
		},
		invasion: game.invasion,
		invasion_usage: game.invasion_usage,
		neutrals: game.neutrals,
		neutral_deployment: game.neutral_deployment,
		orders: game.orders,
		action_track: game.action_track,
		action: game.action,
		combat: game.combat,
		last_combat: game.last_combat,
		reinforcement: game.reinforcement,
		replacement: game.replacement,
		eliminated_theater: game.eliminated_theater,
		theater_choice: game.theater_choice,
		off_map_units: offMapUnits(game),
		supply_warnings: game.supply_warnings || [],
		supply_warning_owner: game.supply_warning_owner || null,
		rollback: Engine.collaboration.publicRollbackPoints(game).map((point) => ({ ...point, name: I18n.render(locale, point.name) })),
		rollback_proposal: (() => {
			const proposal = Engine.collaboration.publicRollbackProposal(game)
			return proposal ? { ...proposal, name: I18n.render(locale, proposal.name) } : null
		})(),
	}
	if (side) {
		result.hand = game.hands[side]
		result.discard = game.discards[side]
	}
	if (state.actions) result.actions = state.actions
	if (!isReplay && player === game.active && game.state !== "game_over") {
		result.actions ||= {}
		if (!("undo" in result.actions)) result.actions.undo = 0
	}
	if (game.result) result.result = game.result
	return result
}

function supplyStatuses(game, side, statuses = new Map()) {
	const pieces = {}
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		const location = game.pieces[pieceId]
		if (!Number.isInteger(location) || location <= 0) continue
		if (Engine.map.pieceSide(game, data, pieceId) !== side) continue
		const piece = data.pieces[pieceId]
		const key = `${side}:${location}:${piece.nation}`
		if (!statuses.has(key)) statuses.set(key, Engine.map.traceSupply(game, data, Engine.adjacency, side, location, piece.nation))
		pieces[pieceId] = statuses.get(key)
	}
	return pieces
}

function supplySpaceProjection(game, side) {
	const nations = side === Engine.constants.ALLIED ? { western: ["br", "us"], soviet: ["su"] } : { axis: ["ge"] }
	const projection = {}
	const rank = { oos: 0, limited: 1, full: 2 }
	for (const [group, groupNations] of Object.entries(nations)) {
		const spaces = {}
		for (const space of data.spaces) {
			if (!space || space.kind === "sr") continue
			if (space.kind === "land" && game.control[space.id] !== side) {
				spaces[space.id] = "oos"
				continue
			}
			spaces[space.id] = groupNations.map((nation) => Engine.map.traceSupply(game, data, Engine.adjacency, side, space.id, nation)).reduce((best, status) => (rank[status] > rank[best] ? status : best), "oos")
		}
		projection[group] = spaces
	}
	return projection
}

function supplyDependencySignature(game) {
	return [
		game.turn,
		game.pieces?.join(","),
		game.control?.join(","),
		game.partisans?.join(","),
		game.destroyed_forts?.join(","),
		JSON.stringify(game.beachheads || {}),
		JSON.stringify(game.events || {}),
		JSON.stringify(game.options || {}),
		JSON.stringify(game.neutrals || {}),
	].join("#")
}

function supplyView(game, cacheKey = null) {
	const signature = cacheKey && supplyDependencySignature(cacheKey)
	const cached = cacheKey && supplyViewCache.get(cacheKey)
	if (cached?.signature === signature) return cached.value
	const statuses = new Map()
	const pieces = {
		...supplyStatuses(game, Engine.constants.ALLIED, statuses),
		...supplyStatuses(game, Engine.constants.AXIS, statuses),
	}
	const oos = []
	const limited = []
	for (const [pieceId, status] of Object.entries(pieces)) {
		if (status === "oos") oos.push(Number(pieceId))
		else if (status === "limited") limited.push(Number(pieceId))
	}
	const value = { oos, limited }
	if (cacheKey) supplyViewCache.set(cacheKey, { signature, value })
	return value
}

function supplyQuery(game, side) {
	const pieces = supplyStatuses(game, side)
	const spaces = supplySpaceProjection(game, side)
	return { side, pieces, spaces }
}

function cardsQuery(game, viewerSide, cardSide) {
	const maySeePrivateCards = viewerSide === cardSide
	const discard = game.discards[cardSide]
	const removed = game.removed[cardSide]
	const handOrDeck = [...game.decks[cardSide], ...game.hands[cardSide]]
	const sortedCopy = (cards) => cards.slice().sort((a, b) => a - b)
	return {
		side: cardSide,
		discard: {
			count: discard.length,
			cards: maySeePrivateCards ? sortedCopy(discard) : null,
		},
		removed: {
			count: removed.length,
			cards: sortedCopy(removed),
		},
		hand_or_deck: {
			count: handOrDeck.length,
			cards: maySeePrivateCards ? sortedCopy(handOrDeck) : null,
		},
	}
}

function query(game, player, what) {
	game = readNormalized(game)
	const side = Engine.constants.sideForRole(player)
	if (what === "allied_cards") return cardsQuery(game, side, Engine.constants.ALLIED)
	if (what === "axis_cards") return cardsQuery(game, side, Engine.constants.AXIS)
	if (what === "discard" && side) return game.discards[side]
	if (what === "removed") return game.removed
	if (what === "hand" && side) return game.hands[side]
	if (what === "allied_supply") return supplyQuery(game, Engine.constants.ALLIED)
	if (what === "axis_supply") return supplyQuery(game, Engine.constants.AXIS)
	return null
}

module.exports = { playerView, query, readNormalized, staticView }
