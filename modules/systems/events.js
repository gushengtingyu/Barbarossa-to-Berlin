"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
const I18n = require("../core/i18n.js")
const Random = require("../core/random.js")
const { clearUndo, log, pieceLogRef } = require("../core/state.js")
const Locations = require("../core/unit_locations.js")
const ReinforcementManifest = require("./reinforcement_manifest.js")
const Cards = require("./cards.js")
const MapSystem = require("./map.js")
const Combat = require("./combat.js")
const Invasions = require("./invasions.js")
const Reinforcements = require("./reinforcements.js")
const Weather = require("./weather.js")

const handlers = new Map()
const FOREIGN_ARMIES_EAST_CARDS = Object.freeze([2, 3, 4, 13, 17, 24, 31, 37, 39])

function register(cardId, handler) {
	if (!Number.isInteger(cardId) || cardId < 1 || cardId > 110) throw new Error(`invalid event card id: ${cardId}`)
	if (handlers.has(cardId)) throw new Error(`duplicate event card id: ${cardId}`)
	if (!handler || typeof handler !== "object") throw new Error(`event ${cardId}: handler must be an object`)
	if (typeof handler.name !== "string" || !handler.name) throw new Error(`event ${cardId}: handler requires a name`)
	if (typeof handler.canPlay !== "function") throw new Error(`event ${cardId}: handler requires canPlay`)
	if (typeof handler.play !== "function") throw new Error(`event ${cardId}: handler requires play`)
	handlers.set(cardId, Object.freeze({ ...handler, card_id: cardId }))
}

function banzaiLocationRank(location) {
	const parsed = Locations.parse(location)
	if (parsed.kind === "map") return 0
	if (parsed.kind === "reserve" && parsed.side === ALLIED) return 1
	if (parsed.kind === "eliminated" && parsed.side === ALLIED) return 2
	return -1
}

function banzaiCorps(game, data) {
	return data.pieces.filter((piece) => piece?.nation === "cw" && piece.size === "scu" && piece.unit_type === "corps" && banzaiLocationRank(game.pieces[piece.id]) >= 0).map((piece) => piece.id)
}

function legalBanzaiCorps(game, data) {
	const selected = game.event?.banzai_pieces || []
	const remaining = banzaiCorps(game, data).filter((pieceId) => !selected.includes(pieceId))
	if (!remaining.length) return selected.slice()
	const rank = Math.min(...remaining.map((pieceId) => banzaiLocationRank(game.pieces[pieceId])))
	return [...selected, ...remaining.filter((pieceId) => banzaiLocationRank(game.pieces[pieceId]) === rank)]
}

function toggleBanzaiCorps(game, data, pieceId) {
	const selected = game.event?.banzai_pieces
	if (!Array.isArray(selected)) throw new Error("Banzai selection is not active")
	const index = selected.indexOf(pieceId)
	if (index >= 0) {
		selected.splice(index)
		return selected
	}
	if (selected.length >= 2 || !legalBanzaiCorps(game, data).includes(pieceId)) throw new Error(`illegal Banzai corps: ${pieceId}`)
	selected.push(pieceId)
	return selected
}

function completeBanzai(game, data) {
	const selected = game.event?.banzai_pieces || []
	if (selected.length < 2 && banzaiCorps(game, data).some((pieceId) => !selected.includes(pieceId))) throw new Error("Banzai requires two Commonwealth Corps when available")
	for (const pieceId of selected) {
		game.pieces[pieceId] = Locations.REMOVED
		Combat.setReduced(game, pieceId, false)
	}
	if (selected.length) log(game, "event.log.banzai_removed", { pieces: I18n.list(selected.map((pieceId) => pieceLogRef(game, pieceId))) })
	else log(game, "event.log.banzai_none")
	return selected
}

function legalLuftwaffeSupplySpaces(game, data) {
	const adjacency = MapSystem.buildAdjacency(data)
	const spaces = new Set()
	for (const piece of data.pieces) {
		if (!piece || MapSystem.pieceSide(game, data, piece.id) !== AXIS) continue
		const location = game.pieces[piece.id]
		if (!Number.isInteger(location) || location <= 0) continue
		if (MapSystem.traceSupply(game, data, adjacency, AXIS, location, piece.nation) === "oos") spaces.add(location)
	}
	return [...spaces].sort((a, b) => a - b)
}

function revealableForeignArmiesEastCards(game) {
	const hand = new Set(game.hands?.[ALLIED] || [])
	return FOREIGN_ARMIES_EAST_CARDS.filter((cardId) => hand.has(cardId))
}

function publicCardRefs(cardIds) {
	if (!cardIds.length) return I18n.message("core.none")
	return I18n.list(cardIds.map((cardId) => `c${cardId}`))
}

function revealForeignArmiesEastAtEnd(game) {
	const reveal = game.events?.foreign_armies_east
	if (!reveal || reveal.turn !== game.turn || Array.isArray(reveal.final)) return []
	reveal.final = revealableForeignArmiesEastCards(game)
	log(game, "event.foreign_armies_east.reveal_final", { cards: publicCardRefs(reveal.final) })
	return reveal.final
}

function onMap(game, pieceId) {
	return Number.isInteger(game.pieces?.[pieceId]) && game.pieces[pieceId] > 0
}

function canPlayEnigma(game, data) {
	if (Weather.isSpringThaw(game)) return false
	return !data.spaces.some((space) => space?.kind === "land" && space.nation === "ge" && game.control[space.id] === ALLIED)
}

function startExtraAttackEvent(game, data, cardId, pieceName, label, advanceLimit) {
	const piece = pieceNamed(data, pieceName)
	if (!piece) throw new Error(`${pieceName} is missing`)
	game.event = {
		card_id: cardId,
		extra_attack: {
			piece_id: piece.id,
			label,
			advance_limit: advanceLimit,
			first_attack_completed: false,
			used: false,
		},
	}
}

function canPlayExtraAttackEvent(game, data, pieceName) {
	const piece = pieceNamed(data, pieceName)
	return !!piece && onMap(game, piece.id)
}

function settleActionEvent(game) {
	if (game.event?.card_id !== 82 || game.event.zitadelle_settled) return
	game.event.zitadelle_settled = true
	const delta = game.event.zitadelle_success ? 1 : -1
	game.vp += delta
	log(game, "event.zitadelle.result", {
		outcome: delta > 0 ? { "zh-CN": "成功", en: "succeeds" } : { "zh-CN": "失败", en: "fails" },
		delta: delta > 0 ? `+${delta}` : String(delta),
		vp: game.vp,
	})
}

const REINFORCEMENT_RULES = Object.freeze({
	2: Object.freeze({
		name: "Soviet Reinforcements 2",
		card_name_zh: "苏军增援*",
		nation: "su",
	}),
	4: Object.freeze({
		name: "Soviet Tank Army Reinforcements",
		card_name_zh: "苏军增援*",
		nation: "su",
		requires_event: "industrial_evacuation",
		requires_event_turn: "industrial_evacuation_turn",
		delay: 4,
	}),
	5: Object.freeze({
		name: "British Reinforcements 5",
		card_name_zh: "英国增援*",
		nation: "br",
	}),
	13: Object.freeze({
		name: "Siberians",
		card_name_zh: "西伯利亚部队*",
		nation: "su",
		requires_event: "sorge",
		requires_event_turn: "sorge_turn",
		delay: 0,
	}),
	24: Object.freeze({
		name: "Soviet Reinforcements 24",
		card_name_zh: "苏军增援*",
		nation: "su",
	}),
	26: Object.freeze({
		name: "British Reinforcements 26",
		card_name_zh: "英国增援*",
		nation: "br",
	}),
	38: Object.freeze({
		name: "US Reinforcements 38",
		card_name_zh: "美国增援*",
		nation: "usa",
		requires_us_buildup: true,
	}),
	40: Object.freeze({
		name: "US Reinforcements 40",
		card_name_zh: "美国增援*",
		nation: "usa",
		requires_us_buildup: true,
	}),
	41: Object.freeze({
		name: "US Reinforcements 41",
		card_name_zh: "美国增援*",
		nation: "usa",
		requires_us_buildup: true,
	}),
	79: Object.freeze({
		name: "German Reinforcements 24",
		card_name_zh: "德国增援*",
		nation: "ge",
	}),
	87: Object.freeze({
		name: "German Reinforcements 32",
		card_name_zh: "德国增援*",
		nation: "ge",
	}),
	88: Object.freeze({
		name: "German Reinforcements 33",
		card_name_zh: "德国增援*",
		nation: "ge",
	}),
	89: Object.freeze({
		name: "German Reinforcements 34",
		card_name_zh: "德国增援*",
		nation: "ge",
	}),
	90: Object.freeze({
		name: "German Reinforcements 35",
		card_name_zh: "德国增援*",
		nation: "ge",
		requires_event: "speer",
		requires_event_turn: "speer_turn",
		delay: 0,
	}),
	91: Object.freeze({
		name: "German Reinforcements 36",
		card_name_zh: "德国增援*",
		nation: "ge",
		requires_event: "speer",
		requires_event_turn: "speer_turn",
		delay: 0,
	}),
	92: Object.freeze({
		name: "German Reinforcements 37",
		card_name_zh: "德国增援*",
		nation: "ge",
	}),
})

const MECHANIZED_FRONT_RULES = Object.freeze({
	31: Object.freeze({
		name: "Ukrainian Front Reinforcements",
		card_name_zh: "苏军增援*",
	}),
	37: Object.freeze({
		name: "Baltic Front Reinforcements",
		card_name_zh: "苏军增援*",
	}),
	39: Object.freeze({
		name: "Belorussian Front Reinforcements",
		card_name_zh: "苏军增援*",
	}),
})

function piecesNamed(data, names) {
	return names.map((name) => data.pieces.find((piece) => piece?.name === name)?.id || 0)
}

function availableScus(game, data, reserve, side, excluded = new Set(), cardId = null) {
	return ReinforcementManifest.piecesForCard(
		data,
		cardId,
		(piece) =>
			piece.side === side &&
			piece.nation === reserve.nation &&
			piece.size === "scu" &&
			(!reserve.selector_name || piece.name === reserve.selector_name) &&
			(!reserve.selector_names || reserve.selector_names.includes(piece.name)),
	)
		.filter(
			(piece) =>
				Locations.isAvailable(game.pieces[piece.id]) &&
				!excluded.has(piece.id),
		)
		.map((piece) => piece.id)
		.sort((a, b) => a - b)
		.slice(0, reserve.count)
}

function reserveScusForSpec(game, data, spec, side) {
	const result = []
	const excluded = new Set()
	for (const reserve of spec.reserves || []) {
		const selected = availableScus(game, data, reserve, side, excluded, spec.card_id)
		if (selected.length !== reserve.count) return null
		for (const pieceId of selected) {
			result.push(pieceId)
			excluded.add(pieceId)
		}
	}
	return result
}

function eventOccurredBeforeTurn(game, flag, turnFlag) {
	if (!game.events?.[flag]) return false
	const eventTurn = Number(game.events?.[turnFlag]) || 0
	return !eventTurn || game.turn > eventTurn
}

function stalinInMoscow(game, data) {
	const moscow = data.spaces.find((space) => space?.name === "Moscow")?.id
	return !!moscow && game.stalin_location === moscow
}

function eventOpsValue(game, data, cardId) {
	const card = data.cards[cardId]
	if (!card) return 0
	if (card.dual) return card.ops
	if (Weather.isSpringThaw(game)) return 0
	if (card.dual_condition === "stalin_in_moscow" && stalinInMoscow(game, data)) return card.ops
	if (cardId === 6 && Number(game.events?.wolfpacks_turn) > 0) return card.ops
	if (cardId === 46 && !game.events?.overlord) return card.ops
	if (cardId === 52 && game.events?.overlord && game.event?.invasion) return card.ops
	if (cardId === 53 && !game.events?.overlord) return card.ops
	if (cardId === 43 && !game.events?.overlord) return card.ops
	return 0
}

function reinforcementPlacementSpaces(game, data, pieceId, placement) {
	const adjacency = MapSystem.buildAdjacency(data)
	if (placement === "desert") return Reinforcements.legalDesertArmyReinforcementSpaces(game, data, MapSystem, adjacency, pieceId)
	if (placement === "lcu_style") return Reinforcements.legalLcuStyleReinforcementSpaces(game, data, MapSystem, adjacency, pieceId)
	return Reinforcements.legalLcuReinforcementSpaces(game, data, MapSystem, adjacency, pieceId)
}

function canPlaceAllUnits(game, data, units) {
	return Reinforcements.canPlaceAllUnits(game, units, (sandbox, unit) => reinforcementPlacementSpaces(sandbox, data, unit.piece_id, unit.placement))
}

function reinforcementSpec(data, cardId) {
	const authored = data.reinforcements?.[cardId]
	const rules = REINFORCEMENT_RULES[cardId]
	return authored && rules ? { ...authored, ...rules } : null
}

function mechanizedFrontSpec(data, cardId) {
	const authored = data.reinforcements?.[cardId]
	const rules = MECHANIZED_FRONT_RULES[cardId]
	if (!authored || !rules || !authored.units?.length || authored.units.some((unit) => unit.kind !== "replace")) return null
	return { ...authored, ...rules, nation: "su" }
}

function legalFrontReplacementPieces(game, data) {
	const adjacency = MapSystem.buildAdjacency(data)
	return data.pieces
		.filter((piece) => {
			if (
				!piece ||
				piece.side !== ALLIED ||
				piece.nation !== "su" ||
				piece.size !== "lcu" ||
				!piece.name.endsWith("Front") ||
				piece.cf !== 3 ||
				piece.lf !== 3 ||
				piece.mf !== 3 ||
				!piece.rcf ||
				!piece.rlf ||
				!piece.rmf ||
				Combat.isReduced(game, piece.id)
			)
				return false
			const location = game.pieces[piece.id]
			return Number.isInteger(location) && location > 0 && MapSystem.traceSupply(game, data, adjacency, ALLIED, location, "su") === "full"
		})
		.map((piece) => piece.id)
		.sort((a, b) => a - b)
}

function canPlayMechanizedFronts(game, data, cardId) {
	const spec = mechanizedFrontSpec(data, cardId)
	if (!spec || game.turn === 1 || Weather.isSpringThaw(game) || Reinforcements.reinforcementUsed(game, ALLIED, "su") || !eventOccurredBeforeTurn(game, "lend_lease", "lend_lease_turn")) return false
	if (spec.units.some((unit) => !Locations.isAvailable(game.pieces[unit.piece_id]))) return false
	return legalFrontReplacementPieces(game, data).length >= spec.units.length
}

function canPlayReinforcement(game, data, cardId) {
	const spec = reinforcementSpec(data, cardId)
	if (!spec) return false
	const side = data.cards[cardId]?.side
	if (![ALLIED, AXIS].includes(side) || game.turn === 1 || Reinforcements.reinforcementUsed(game, side, spec.nation)) return false
	if (spec.requires_us_buildup && !eventOccurredBeforeTurn(game, "us_buildup", "us_buildup_turn")) return false
	if (spec.requires_event) {
		const eventTurn = Number(game.events?.[spec.requires_event_turn]) || 0
		if (!game.events?.[spec.requires_event] || !eventTurn || game.turn < eventTurn + spec.delay) return false
	}
	if (spec.units.some((unit) => !Locations.isAvailable(game.pieces[unit.piece_id]))) return false
	if (reserveScusForSpec(game, data, spec, side) === null) return false
	return canPlaceAllUnits(game, data, spec.units)
}

function legalReinforcementSpaces(game, data) {
	const reinforcement = game.reinforcement
	const pieceId = reinforcement?.lcus?.[reinforcement.index]
	if (!pieceId) return []
	const adjacency = MapSystem.buildAdjacency(data)
	if (reinforcement.type === "converted_invasion") return Invasions.legalConvertedLcuSpaces(game, data, MapSystem, adjacency, pieceId)
	let candidates
	if (reinforcement.placement_type === "desert") candidates = Reinforcements.legalDesertArmyReinforcementSpaces(game, data, MapSystem, adjacency, pieceId)
	else if (reinforcement.placement_type === "lcu_style") candidates = Reinforcements.legalLcuStyleReinforcementSpaces(game, data, MapSystem, adjacency, pieceId)
	else candidates = Reinforcements.legalLcuReinforcementSpaces(game, data, MapSystem, adjacency, pieceId)
	const remaining = reinforcement.units.slice(reinforcement.index + 1)
	if (!remaining.length) return candidates
	return candidates.filter((spaceId) => {
		const sandbox = {
			...game,
			pieces: game.pieces.slice(),
			reduced: game.reduced.slice(),
		}
		sandbox.pieces[pieceId] = spaceId
		return canPlaceAllUnits(sandbox, data, remaining)
	})
}

function placeReinforcementLcu(game, data, pieceId, spaceId) {
	const adjacency = MapSystem.buildAdjacency(data)
	let placed
	if (game.reinforcement?.type === "converted_invasion") placed = Invasions.placeConvertedReinforcementLcu(game, data, MapSystem, adjacency, pieceId, spaceId)
	else if (game.reinforcement?.placement_type === "desert") placed = Reinforcements.placeDesertArmyReinforcement(game, data, MapSystem, adjacency, pieceId, spaceId)
	else if (game.reinforcement?.placement_type === "lcu_style") placed = Reinforcements.placeLcuStyleReinforcement(game, data, MapSystem, adjacency, pieceId, spaceId)
	else placed = Reinforcements.placeReinforcementLcu(game, data, MapSystem, adjacency, pieceId, spaceId)
	const unit = game.reinforcement?.units?.[game.reinforcement.index]
	Combat.setReduced(game, pieceId, unit?.reduced === true)
	return {
		...placed,
		activation_eligible: Reinforcements.reinforcementActivationEligible(game, data, pieceId, spaceId),
		yellow_event_eligible: Reinforcements.reinforcementYellowEventEligible(game, data, pieceId, spaceId),
	}
}

function legalSorgeMarkerSpaces(game, data) {
	const used = new Set([...(game.action?.move_spaces || []), ...(game.action?.attack_spaces || [])])
	return MapSystem.legalActivationSpaces(game, data, ALLIED).filter((spaceId) => !used.has(spaceId) && MapSystem.friendlyPiecesInSpace(game, data, ALLIED, spaceId).some((pieceId) => data.pieces[pieceId]?.nation === "su"))
}

function playReinforcement(game, data, cardId) {
	const spec = reinforcementSpec(data, cardId)
	const side = data.cards[cardId].side
	const pieceIds = spec.units.map((unit) => unit.piece_id)
	const reserveScus = reserveScusForSpec(game, data, spec, side) || []
	Reinforcements.markReinforcementUsed(game, side, spec.nation)
	Reinforcements.recordReinforcementOrigin(game, cardId, pieceIds.concat(reserveScus))
	for (const pieceId of reserveScus) {
		game.pieces[pieceId] = Locations.reserve(side)
		const reduced = game.reduced.indexOf(pieceId)
		if (reduced >= 0) game.reduced.splice(reduced, 1)
	}
	if (cardId === 5) {
		game.events.british_desert_reinforcements = true
		game.events.british_desert_reinforcements_turn = game.turn
	}
	if (!pieceIds.length) {
		game.reinforcement = null
		game.event = { card_id: cardId, reinforcement_reserve_only: true }
		log(game, "event.log.reinforcement_reserve", { card: `c${cardId}`, side: side === ALLIED ? { "zh-CN": "盟军", en: "Allied" } : { "zh-CN": "轴心国", en: "Axis" } })
		return
	}
	game.reinforcement = {
		type: side === AXIS ? "axis" : ["western", "desert"].includes(spec.units[0]?.placement) ? "western" : "soviet",
		placement_type: spec.units[0]?.placement || "standard",
		side,
		nation: spec.nation,
		card_id: cardId,
		lcus: pieceIds,
		units: spec.units,
		labels_zh: spec.units.map((entry) => entry.label_zh),
		index: 0,
		reserve_scus: reserveScus,
		activation_spaces: [],
		activation_index: 0,
	}
	game.event = { card_id: cardId, reinforcement: true }
}

function panzerAfrikaArmy(data) {
	return data.pieces.find((piece) => piece?.name === "GE Panzer Armee Afrika")
}

function tripoli(data) {
	return data.spaces.find((space) => space?.name === "Tripoli")
}

function legalPanzerAfrikaTransferPieces(game, data) {
	const adjacency = MapSystem.buildAdjacency(data)
	return data.pieces
		.filter((piece) => {
			if (!piece || piece.nation !== "ge" || piece.name !== "GE Armor SCU" || piece.size !== "scu") return false
			const location = game.pieces[piece.id]
			const space = data.spaces[location]
			return Number.isInteger(location) && ["ly", "eg"].includes(space?.nation) && MapSystem.traceSupply(game, data, adjacency, AXIS, location, "ge") !== "oos"
		})
		.map((piece) => piece.id)
		.sort((a, b) => a - b)
}

function canPlayPanzerAfrikaReinforcement(game, data) {
	const army = panzerAfrikaArmy(data)
	const entry = tripoli(data)
	return (
		game.turn !== 1 &&
		!Reinforcements.reinforcementUsed(game, AXIS, "ge") &&
		!!army &&
		Locations.isAvailable(game.pieces[army.id]) &&
		!!entry &&
		game.control[entry.id] === AXIS &&
		MapSystem.canStack(game, data, army.id, entry.id) &&
		legalPanzerAfrikaTransferPieces(game, data).length > 0
	)
}

function playPanzerAfrikaReinforcement(game, data, cardId) {
	const army = panzerAfrikaArmy(data)
	const entry = tripoli(data)
	Reinforcements.markReinforcementUsed(game, AXIS, "ge")
	game.pieces[army.id] = entry.id
	Combat.setReduced(game, army.id, false)
	game.event = { card_id: cardId, panzer_afrika_transfer: true }
	log(game, "event.log.axis_deploy", { piece: pieceLogRef(game, army.id), space: `s${entry.id}` })
}

function transferPanzerAfrikaCorps(game, data, pieceId) {
	if (!legalPanzerAfrikaTransferPieces(game, data).includes(pieceId)) throw new Error(`illegal Panzer Afrika transfer: ${pieceId}`)
	const location = game.pieces[pieceId]
	const pieceRef = pieceLogRef(game, pieceId)
	game.pieces[pieceId] = Locations.reserve(AXIS)
	log(game, "event.log.axis_transfer_reserve", { piece: pieceRef, space: `s${location}` })
}

function playMechanizedFronts(game, data, cardId) {
	const spec = mechanizedFrontSpec(data, cardId)
	Reinforcements.markReinforcementUsed(game, ALLIED, "su")
	game.reinforcement = {
		type: "front_upgrade",
		side: ALLIED,
		nation: "su",
		card_id: cardId,
		lcus: spec.units.map((unit) => unit.piece_id),
		units: spec.units,
		labels_zh: spec.units.map((unit) => unit.label_zh),
		index: 0,
		replaced: [],
	}
	game.event = { card_id: cardId, front_replacement: true }
}

function replaceMechanizedFront(game, data, oldPieceId) {
	const reinforcement = game.reinforcement
	const newPieceId = reinforcement?.lcus?.[reinforcement.index]
	if (reinforcement?.type !== "front_upgrade" || !newPieceId || !legalFrontReplacementPieces(game, data).includes(oldPieceId)) throw new Error(`illegal front replacement: ${oldPieceId}`)
	const location = game.pieces[oldPieceId]
	const oldRef = pieceLogRef(game, oldPieceId)
	game.pieces[oldPieceId] = Locations.REMOVED
	Combat.setReduced(game, oldPieceId, false)
	game.pieces[newPieceId] = location
	Combat.setReduced(game, newPieceId, false)
	const newRef = pieceLogRef(game, newPieceId)
	reinforcement.replaced.push({
		old_piece_id: oldPieceId,
		new_piece_id: newPieceId,
		space_id: location,
	})
	reinforcement.index++
	log(game, "event.log.allied_replace_removed", { space: `s${location}`, new_piece: newRef, old_piece: oldRef })
	return {
		old_piece_id: oldPieceId,
		new_piece_id: newPieceId,
		space_id: location,
	}
}

// Axis Card 16: SPEER*. The printed card bars play after TOTALER KRIEG!.
register(71, {
	name: "Speer",
	canPlay: (game) => !game.events.speer && !game.events.totaler_krieg,
	play(game) {
		game.events.speer = true
		game.events.speer_turn = game.turn
		game.event = { card_id: 71 }
		log(game, "event.log.speer")
	},
})

register(72, {
	name: "Banzai!",
	canPlay: (game) => game.turn > 3,
	play(game, data, cardId) {
		game.event = { card_id: cardId, banzai_pieces: [] }
		game.active = "Allied"
		clearUndo(game)
		log(game, "event.log.banzai_select")
	},
})

register(74, {
	name: "Luftwaffe Supply",
	canPlay: (game, data) => legalLuftwaffeSupplySpaces(game, data).length > 0,
	play(game, data, cardId) {
		game.event = { card_id: cardId, luftwaffe_supply: true }
		log(game, "event.log.luftwaffe_supply")
	},
})

// Rule 7.62 and Axis Card 22: Pz Army Afrika enters at Tripoli and a supplied
// German Panzer corps in Libya/Egypt must be transferred to the Axis Reserve.
register(77, {
	name: "German Reinforcements 22",
	canPlay: canPlayPanzerAfrikaReinforcement,
	play: playPanzerAfrikaReinforcement,
})

for (const [cardIdText, spec] of Object.entries(REINFORCEMENT_RULES)) {
	const cardId = Number(cardIdText)
	register(cardId, {
		name: spec.name,
		canPlay: (game, data) => canPlayReinforcement(game, data, cardId),
		play: (game, data) => playReinforcement(game, data, cardId),
	})
}

for (const [cardIdText, spec] of Object.entries(MECHANIZED_FRONT_RULES)) {
	const cardId = Number(cardIdText)
	register(cardId, {
		name: spec.name,
		canPlay: (game, data) => canPlayMechanizedFronts(game, data, cardId),
		play: (game, data) => playMechanizedFronts(game, data, cardId),
	})
}

const DEFECTION_EVENTS = Object.freeze({
	27: Object.freeze({
		nation: "it",
		flag: "italy_defects",
		name_zh: "意大利倒戈",
		controller: "br",
	}),
	29: Object.freeze({
		nation: "ro",
		flag: "romania_defects",
		name_zh: "罗马尼亚倒戈",
		controller: "su",
		reserve: true,
	}),
	30: Object.freeze({
		nation: "bu",
		flag: "bulgaria_defects",
		name_zh: "保加利亚倒戈",
		controller: "su",
		reserve: true,
	}),
})

function spacesNamed(data, names) {
	const wanted = new Set(names)
	return data.spaces.filter((space) => space && wanted.has(space.name))
}

// Allied cards 44, 47, 48, 51 and 54. Regional definitions and the Hitler
// Orders interaction follow the 2006 v1.3 Clarifications (Rules 5.5 and 8.3).
const BIG_THREE_NATIONS = new Set(["dz", "tn", "ly", "eg", "sy", "ir", "iq"])

function randomlyDiscardCard(game, data, side) {
	const hand = game.hands?.[side]
	if (!hand?.length) throw new Error(`${side} has no card to discard`)
	const cardId = hand[Random.random(game, hand.length)]
	Cards.discard(game, data, side, cardId)
	clearUndo(game)
	log(game, "event.log.card_discarded", { side: side === AXIS ? { "zh-CN": "轴心国", en: "The Axis" } : { "zh-CN": "盟军", en: "The Allies" }, card: `c${cardId}` })
	return cardId
}

function canPlayBigThree(game, data) {
	if (!game.events?.casablanca || game.events?.big_three) return false
	return !data.spaces.some((space) => space?.kind === "land" && BIG_THREE_NATIONS.has(space.nation) && game.control[space.id] === AXIS)
}

function canPlayYalta(game, data) {
	if (game.events?.yalta) return false
	const sovietVpSpaces = data.spaces.filter((space) => space?.kind === "land" && space.nation === "su" && Number(space.vp) > 0)
	const greaterGermanyVpSpaces = data.spaces.filter((space) => space?.kind === "land" && space.nation === "ge" && Number(space.vp) > 0)
	return sovietVpSpaces.length > 0 && sovietVpSpaces.every((space) => game.control[space.id] === ALLIED) && greaterGermanyVpSpaces.some((space) => game.control[space.id] === ALLIED)
}

function canPlayFinlandWithdraws(game, data) {
	if (game.events?.finland_withdraws) return false
	const required = spacesNamed(data, ["Leningrad", "Tallinn", "Riga"])
	if (required.length !== 3) return false
	const adjacency = MapSystem.buildAdjacency(data)
	return required.every((space) => game.control[space.id] === ALLIED && MapSystem.controlNation(game, data, space.id) === "su" && MapSystem.traceSupply(game, data, adjacency, ALLIED, space.id, "su") === "full")
}

function canPlayStavka(game) {
	const order = game.orders?.allied
	return !!order && ["soviet_mo", "stalin_orders"].includes(order.result) && !order.cancelled
}

function playStavka(game, cardId) {
	const order = game.orders.allied
	order.cancelled = true
	order.fulfilled = true
	let removed = 0
	for (const [spaceId, marker] of Object.entries(game.stand_fast || {})) {
		if (marker !== "stalin") continue
		delete game.stand_fast[spaceId]
		if (game.stand_fast_round_units) delete game.stand_fast_round_units[spaceId]
		removed++
	}
	game.events.stavka = true
	game.event = { card_id: cardId }
	log(game, "event.log.soviet_orders_cancelled", {
		removed: removed ? { "zh-CN": `，移除${removed}个斯大林坚守标记`, en: ` and remove ${removed} Stalin Stand Fast markers` } : "",
	})
}

function canPlayCasablanca(game, data) {
	if (game.events.casablanca) return false
	const named = Object.fromEntries(spacesNamed(data, ["Oran", "Algiers", "Syracuse"]).map((space) => [space.name, space.id]))
	const entry = (game.control[named.Oran] === ALLIED && game.control[named.Algiers] === ALLIED) || game.control[named.Syracuse] === ALLIED
	const axisInAfrica = data.spaces.some((space) => space?.kind === "land" && ["ly", "eg"].includes(space.nation) && game.control[space.id] === AXIS)
	return entry && !axisInAfrica
}

function playCasablanca(game, data, cardId) {
	const neutralVp = data.spaces.filter((space) => space?.kind === "land" && game.control[space.id] === "neutral").reduce((sum, space) => sum + (Number(space.vp) || 0), 0)
	game.events.casablanca = true
	game.events.casablanca_vp = neutralVp
	game.vp -= neutralVp
	game.event = { card_id: cardId }
	log(game, "event.log.neutral_vp", { penalty: neutralVp, vp: game.vp })
}

function canPlayDefection(game, data, cardId) {
	const spec = DEFECTION_EVENTS[cardId]
	if (!spec || game.events[spec.flag]) return false
	if (cardId === 27) {
		if (data.spaces.filter((space) => space?.nation === "it" && game.control[space.id] === ALLIED).length < 4) return false
	} else if (cardId === 29) {
		if (!data.spaces.some((space) => space?.nation === "ro" && game.control[space.id] === ALLIED && MapSystem.controlNation(game, data, space.id) === "su")) return false
	} else if (!game.events.romania_defects) return false
	if (!spec.reserve) return true
	const reserve = data.reinforcements?.[cardId]?.reserves?.[0]
	return !!reserve && availableScus(game, data, reserve, ALLIED).length === reserve.count
}

function removeNationUnits(game, data, nation) {
	const removed = []
	for (const piece of data.pieces) {
		if (!piece || piece.nation !== nation) continue
		if (!Locations.isRemoved(game.pieces[piece.id])) removed.push(piece.id)
		game.pieces[piece.id] = Locations.REMOVED
		Combat.setReduced(game, piece.id, false)
	}
	return removed
}

function playDefection(game, data, cardId) {
	const spec = DEFECTION_EVENTS[cardId]
	const reserve = spec.reserve ? data.reinforcements[cardId].reserves[0] : null
	const reserveScus = reserve ? availableScus(game, data, reserve, ALLIED) : []
	const removed = removeNationUnits(game, data, spec.nation)
	const flipped = []
	for (const space of data.spaces) {
		if (space?.kind !== "land" || space.nation !== spec.nation) continue
		if (MapSystem.friendlyPiecesInSpace(game, data, AXIS, space.id).length) continue
		if (MapSystem.setControl(game, data, space.id, ALLIED, spec.controller)) flipped.push(space.id)
	}
	for (const pieceId of reserveScus) {
		game.pieces[pieceId] = Locations.reserve(ALLIED)
		Combat.setReduced(game, pieceId, false)
	}
	game.events[spec.flag] = true
	game.event = { card_id: cardId }
	log(game, "event.log.removed_and_flipped", {
		pieces: removed.length,
		spaces: flipped.length,
		reserve: reserveScus.length ? { "zh-CN": "，并将1个满编苏军小单位置入预备箱", en: "; place one full-strength Soviet SCU in the Reserve Box" } : "",
	})
}

function partisanNations(game, includeMaquis = false) {
	const nations = new Set(["su", "yu", "gr", "tu"])
	if (includeMaquis || game.events?.maquis) {
		for (const nation of ["fr", "no", "sw"]) nations.add(nation)
		if (game.events?.italy_defects) nations.add("it")
	}
	return nations
}

function legalPartisanSpaces(game, data, includeMaquis = false) {
	const nations = partisanNations(game, includeMaquis)
	return data.spaces
		.filter((space) => space?.kind === "land" && nations.has(space.nation) && game.control[space.id] === AXIS && !game.partisans.includes(space.id) && !MapSystem.friendlyPiecesInSpace(game, data, AXIS, space.id).length)
		.map((space) => space.id)
}

function titoPiece(data) {
	return data.pieces.find((piece) => piece?.name === "YU YPA Army")
}

function legalTitoSpaces(game, data) {
	const piece = titoPiece(data)
	if (!piece) return []
	return data.spaces
		.filter((space) => space?.kind === "land" && space.nation === "yu" && game.partisans.includes(space.id) && !MapSystem.friendlyPiecesInSpace(game, data, AXIS, space.id).length && MapSystem.canStack(game, data, piece.id, space.id))
		.map((space) => space.id)
}

function placeTito(game, data, spaceId) {
	spaceId = Number(spaceId)
	const piece = titoPiece(data)
	if (!piece || !legalTitoSpaces(game, data).includes(spaceId)) throw new Error(`illegal Tito space: ${spaceId}`)
	game.pieces[piece.id] = spaceId
	MapSystem.setControl(game, data, spaceId, ALLIED, "yu")
	Combat.setReduced(game, piece.id, false)
	log(game, "event.log.allied_deploy", { piece: pieceLogRef(game, piece.id), space: `s${spaceId}` })
	return piece.id
}

function legalPartisanRemovalSpaces(game) {
	return game.partisans.slice().sort((a, b) => a - b)
}

function legalPanzerRefitPieces(game, data) {
	const adjacency = MapSystem.buildAdjacency(data)
	return data.pieces
		.filter((piece) => {
			if (!piece || piece.nation !== "ge" || piece.unit_type !== "mechanized") return false
			if (!game.reduced.includes(piece.id) || !Number.isInteger(game.pieces[piece.id]) || game.pieces[piece.id] <= 0) return false
			return MapSystem.traceSupply(game, data, adjacency, AXIS, game.pieces[piece.id], piece.nation) !== "oos"
		})
		.map((piece) => piece.id)
}

function togglePanzerRefitPiece(game, data, pieceId) {
	pieceId = Number(pieceId)
	const selected = game.event?.panzer_refit_pieces
	if (!Array.isArray(selected)) throw new Error("Panzer Refit is not active")
	const index = selected.indexOf(pieceId)
	if (index >= 0) {
		selected.splice(index, 1)
		return false
	}
	if (selected.length >= 3 || !legalPanzerRefitPieces(game, data).includes(pieceId)) throw new Error(`illegal Panzer Refit piece: ${pieceId}`)
	selected.push(pieceId)
	return true
}

function completePanzerRefit(game, data) {
	const selected = game.event?.panzer_refit_pieces
	if (!Array.isArray(selected) || selected.length < 1 || selected.length > 3 || selected.some((pieceId) => !legalPanzerRefitPieces(game, data).includes(pieceId))) throw new Error("Panzer Refit requires one to three legal pieces")
	const spaces = [...new Set(selected.map((pieceId) => game.pieces[pieceId]))]
	for (const pieceId of selected) Combat.setReduced(game, pieceId, false)
	game.event.blocked_activation_spaces = spaces
	log(game, "event.log.panzer_refit_complete", { pieces: I18n.list(selected.map((pieceId) => pieceLogRef(game, pieceId))) })
	return selected.slice()
}

function legalHedgehogSpaces(game, data) {
	const adjacency = MapSystem.buildAdjacency(data)
	return data.spaces
		.filter((space) => {
			if (!space || space.kind !== "land" || space.nation !== "su" || game.trench?.[space.id]) return false
			const germanArmies = MapSystem.friendlyPiecesInSpace(game, data, AXIS, space.id).filter((pieceId) => data.pieces[pieceId]?.nation === "ge" && data.pieces[pieceId]?.size === "lcu")
			return germanArmies.some((pieceId) => MapSystem.traceSupply(game, data, adjacency, AXIS, space.id, data.pieces[pieceId].nation) === "full")
		})
		.map((space) => space.id)
}

function toggleHedgehogSpace(game, data, spaceId) {
	spaceId = Number(spaceId)
	const selected = game.event?.hedgehog_spaces
	if (!Array.isArray(selected)) throw new Error("Hedgehogs is not active")
	const index = selected.indexOf(spaceId)
	if (index >= 0) {
		selected.splice(index, 1)
		return false
	}
	if (selected.length >= 3 || !legalHedgehogSpaces(game, data).includes(spaceId)) throw new Error(`illegal Hedgehogs space: ${spaceId}`)
	selected.push(spaceId)
	return true
}

function completeHedgehogs(game, data) {
	const selected = game.event?.hedgehog_spaces
	if (!Array.isArray(selected) || selected.length !== 3 || selected.some((spaceId) => !legalHedgehogSpaces(game, data).includes(spaceId))) throw new Error("Hedgehogs requires three legal spaces")
	for (const spaceId of selected) {
		game.trench[spaceId] = 1
		game.trench_owner[spaceId] = AXIS
	}
	game.events.hedgehogs = true
	game.events.hedgehogs_turn = game.turn
	log(game, "event.log.hedgehogs_complete", { spaces: I18n.list(selected.map((spaceId) => `s${spaceId}`)) })
	return selected.slice()
}

function connectedAtlanticWallSpaces(data) {
	const beachIds = new Set(data.spaces.filter((space) => space?.kind === "beach" && /^[A-I]$/.test(space.beach_letter || "")).map((space) => space.id))
	const result = new Set()
	for (const edge of data.edges) {
		if (beachIds.has(edge.a) && data.spaces[edge.b]?.kind === "land") result.add(edge.b)
		if (beachIds.has(edge.b) && data.spaces[edge.a]?.kind === "land") result.add(edge.a)
	}
	return [...result].sort((a, b) => a - b)
}

function legalAtlanticWallSpaces(game, data) {
	return connectedAtlanticWallSpaces(data).filter((spaceId) => !game.trench?.[spaceId] && game.control?.[spaceId] === AXIS)
}

function legalEastWallSpaces(game, data) {
	return legalHedgehogSpaces(game, data)
}

function legalFinalProductionSurgePieces(game, data) {
	return data.pieces
		.filter((piece) => {
			if (!piece || piece.nation !== "ge" || piece.size !== "lcu" || piece.unit_type !== "mechanized" || !game.reduced.includes(piece.id)) return false
			const location = game.pieces[piece.id]
			return (Number.isInteger(location) && location > 0) || Locations.isReserve(location, AXIS)
		})
		.map((piece) => piece.id)
}

function toggleEventSelection(game, field, value, legal, limit, label) {
	const selected = game.event?.[field]
	if (!Array.isArray(selected)) throw new Error(`${label} is not active`)
	const index = selected.indexOf(value)
	if (index >= 0) {
		selected.splice(index, 1)
		return false
	}
	if (selected.length >= limit || !legal.includes(value)) throw new Error(`illegal ${label} selection: ${value}`)
	selected.push(value)
	return true
}

function toggleAtlanticWallSpace(game, data, spaceId) {
	spaceId = Number(spaceId)
	return toggleEventSelection(game, "atlantic_wall_spaces", spaceId, legalAtlanticWallSpaces(game, data), 2, "Atlantic Wall")
}

function toggleEastWallSpace(game, data, spaceId) {
	spaceId = Number(spaceId)
	return toggleEventSelection(game, "east_wall_spaces", spaceId, legalEastWallSpaces(game, data), 3, "East Wall")
}

function toggleFinalProductionSurgePiece(game, data, pieceId) {
	pieceId = Number(pieceId)
	return toggleEventSelection(game, "final_production_surge_pieces", pieceId, legalFinalProductionSurgePieces(game, data), 3, "Final Production Surge")
}

function completeAtlanticWall(game, data) {
	const selected = game.event?.atlantic_wall_spaces
	if (!Array.isArray(selected) || selected.length !== 2 || selected.some((spaceId) => !legalAtlanticWallSpaces(game, data).includes(spaceId))) throw new Error("Atlantic Wall requires two legal spaces")
	game.trench_kind ||= {}
	for (const spaceId of selected) {
		game.trench[spaceId] = 1
		game.trench_owner[spaceId] = AXIS
		game.trench_kind[spaceId] = "atlantic_wall"
	}
	game.events.atlantic_wall = true
	game.events.atlantic_wall_turn = game.turn
	log(game, "event.log.atlantic_wall_complete", { spaces: I18n.list(selected.map((spaceId) => `s${spaceId}`)) })
	return selected.slice()
}

function completeEastWall(game, data) {
	const selected = game.event?.east_wall_spaces
	if (!Array.isArray(selected) || selected.length !== 3 || selected.some((spaceId) => !legalEastWallSpaces(game, data).includes(spaceId))) throw new Error("East Wall requires three legal spaces")
	for (const spaceId of selected) {
		game.trench[spaceId] = 1
		game.trench_owner[spaceId] = AXIS
	}
	game.events.east_wall = true
	game.events.east_wall_turn = game.turn
	log(game, "event.log.east_wall_complete", { spaces: I18n.list(selected.map((spaceId) => `s${spaceId}`)) })
	return selected.slice()
}

function completeFinalProductionSurge(game, data) {
	const selected = game.event?.final_production_surge_pieces
	if (!Array.isArray(selected) || selected.length !== 3 || selected.some((pieceId) => !legalFinalProductionSurgePieces(game, data).includes(pieceId))) throw new Error("Final Production Surge requires three legal Panzer Armies")
	for (const pieceId of selected) Combat.setReduced(game, pieceId, false)
	game.events.final_production_surge = true
	game.events.final_production_surge_turn = game.turn
	game.events.final_production_surge_draw_pending = true
	log(game, "event.log.final_production_complete", { pieces: I18n.list(selected.map((pieceId) => pieceLogRef(game, pieceId))) })
	return selected.slice()
}

function spaceNamed(data, name) {
	return data.spaces.find((space) => space?.name === name) || null
}

function pieceNamed(data, name) {
	return data.pieces.find((piece) => piece?.name === name) || null
}

function alliedInvasionAtAchseBeach(game, data) {
	const letters = new Set(["M", "O", "R", "T"])
	return Object.keys(game.beachheads || {}).some((spaceId) => letters.has(data.spaces[Number(spaceId)]?.beach_letter) && game.beachheads[spaceId])
}

function canPlayAxisSatellites(game, data) {
	const adjacency = MapSystem.buildAdjacency(data)
	const deployments = [
		[pieceNamed(data, "IT 8 Army"), spaceNamed(data, "Odessa")],
		[pieceNamed(data, "HU 2 Army"), spaceNamed(data, "Kiev")],
	]
	return deployments.every(
		([piece, space]) =>
			piece &&
			space &&
			Locations.isAvailable(game.pieces[piece.id]) &&
			game.control[space.id] === AXIS &&
			MapSystem.traceSupply(game, data, adjacency, AXIS, space.id, piece.nation) !== "oos" &&
			MapSystem.canStack(game, data, piece.id, space.id),
	)
}

function deployAxisSatellites(game, data) {
	if (!canPlayAxisSatellites(game, data)) throw new Error("Axis Satellites requirements are not met")
	const deployments = [
		[pieceNamed(data, "IT 8 Army"), spaceNamed(data, "Odessa")],
		[pieceNamed(data, "HU 2 Army"), spaceNamed(data, "Kiev")],
	]
	for (const [piece, space] of deployments) {
		game.pieces[piece.id] = space.id
		Combat.setReduced(game, piece.id, false)
	}
	log(game, "event.log.axis_satellites", {
		piece1: pieceLogRef(game, deployments[0][0].id),
		space1: `s${deployments[0][1].id}`,
		piece2: pieceLogRef(game, deployments[1][0].id),
		space2: `s${deployments[1][1].id}`,
	})
}

function removePartisan(game, data, spaceId) {
	spaceId = Number(spaceId)
	const index = game.partisans.indexOf(spaceId)
	if (index < 0) throw new Error(`illegal partisan removal: ${spaceId}`)
	game.partisans.splice(index, 1)
	MapSystem.syncPartisanVp(game, data)
	log(game, "event.log.partisan_remove", { space: `s${spaceId}` })
}

function bomberCommandTimingAllows(game) {
	return game.turn !== 1 && (game.turn >= 15 || game.action_round <= 5)
}

function eighthAirForceTimingAllows(game) {
	return !!game.events?.p51_mustang || game.action_round <= 5
}

register(12, {
	name: "Bomber Command",
	canPlay: (game) => !game.events?.bomber_command_pending && bomberCommandTimingAllows(game),
	play(game, data, cardId) {
		game.events.bomber_command_pending = true
		game.events.bomber_command_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.bomber_command")
	},
})

register(28, {
	name: "US 8th Air Force",
	canPlay: (game) => !!game.events?.us_buildup && !game.events?.eighth_air_force_pending && eighthAirForceTimingAllows(game),
	play(game, data, cardId) {
		game.events.eighth_air_force_pending = true
		game.events.eighth_air_force_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.eighth_air_force")
	},
})

register(36, {
	name: "ASW Victory",
	canPlay: (game) => !game.events?.asw_victory,
	play(game, data, cardId) {
		game.events.asw_victory = true
		game.vp -= 1
		game.event = { card_id: cardId }
		log(game, "event.log.asw_victory", { vp: game.vp })
	},
})

register(53, {
	name: "P-51 Mustang",
	canPlay: (game) => !game.events?.p51_mustang,
	play(game, data, cardId) {
		game.events.p51_mustang = true
		game.event = { card_id: cardId }
		log(game, "event.log.p51")
	},
})

register(25, {
	name: "Enigma",
	canPlay: canPlayEnigma,
	play(game, data, cardId) {
		game.event = { card_id: cardId }
		log(game, "event.enigma.play", { cards: publicCardRefs(game.hands[AXIS] || []) })
	},
})

register(55, {
	name: "Patton",
	canPlay: (game, data) => canPlayExtraAttackEvent(game, data, "US 3 Army"),
	play(game, data, cardId) {
		startExtraAttackEvent(game, data, cardId, "US 3 Army", { "zh-CN": "巴顿", en: "Patton" }, 2)
		log(game, "event.patton.play")
	},
})

register(43, {
	name: "Operation Strangle",
	canPlay: (game) => !!game.events?.p51_mustang && !game.events?.operation_strangle,
	play(game, data, cardId) {
		game.events.operation_strangle = true
		game.event = { card_id: cardId }
		log(game, "event.log.strangle")
	},
})

register(32, {
	name: "IX Tac-Air",
	canPlay: (game) => !!game.events?.p51_mustang && (Weather.isSpringTurn(game.turn) || Weather.isSummerTurn(game.turn)),
	play(game, data, cardId) {
		game.event = {
			card_id: cardId,
			attack_modifier: {
				attacker_side: ALLIED,
				nations: ["br", "us"],
				drm: 1,
				no_retreat: false,
			},
		}
		log(game, "event.log.ix_tac_air")
	},
})

register(70, {
	name: "Wolfpacks",
	canPlay: (game) => !game.events?.asw_victory && !game.events?.wolfpacks_pending,
	play(game, data, cardId) {
		game.events.wolfpacks_pending = true
		game.events.wolfpacks_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.wolfpacks")
	},
})

register(75, {
	name: "Kammhuber Line",
	canPlay: (game) => game.turn <= 14 && game.events?.bomber_command_turn === game.turn && !!game.events?.bomber_command_pending,
	play(game, data, cardId) {
		delete game.events.bomber_command_pending
		game.event = { card_id: cardId }
		log(game, "event.log.kammhuber")
	},
})

register(84, {
	name: "FW-190",
	canPlay: (game) => !game.events?.p51_mustang && game.events?.eighth_air_force_turn === game.turn && !!game.events?.eighth_air_force_pending,
	play(game, data, cardId) {
		delete game.events.eighth_air_force_pending
		game.vp += 1
		game.event = { card_id: cardId }
		log(game, "event.log.fw190", { vp: game.vp })
	},
})

register(3, {
	name: "STAVKA",
	canPlay: canPlayStavka,
	play: (game, data, cardId) => playStavka(game, cardId),
})

register(15, {
	name: "Casablanca",
	canPlay: canPlayCasablanca,
	play: playCasablanca,
})

register(44, {
	name: "Thunderclap",
	canPlay: (game) => !!game.events?.yalta && !game.events?.thunderclap && game.hands?.[AXIS]?.length > 0,
	play(game, data, cardId) {
		const discarded = randomlyDiscardCard(game, data, AXIS)
		game.events.thunderclap = true
		game.event = { card_id: cardId, random_discard: discarded }
	},
})

register(47, {
	name: "The Big Three",
	canPlay: canPlayBigThree,
	play(game, data, cardId) {
		game.events.big_three = true
		game.vp -= 1
		game.event = { card_id: cardId }
		log(game, "event.log.three_power_conference", { vp: game.vp })
	},
})

register(48, {
	name: "Bomb Plot",
	canPlay: (game) => !game.events?.bomb_plot && game.hands?.[AXIS]?.length > 0,
	play(game, data, cardId) {
		const discarded = randomlyDiscardCard(game, data, AXIS)
		game.events.bomb_plot = true
		game.event = { card_id: cardId, random_discard: discarded }
		log(game, "event.log.bomb_plot")
	},
})

register(51, {
	name: "Yalta",
	canPlay: canPlayYalta,
	play(game, data, cardId) {
		game.events.yalta = true
		game.vp -= 1
		game.event = {
			card_id: cardId,
			attack_modifier: {
				attacker_side: ALLIED,
				any_attacker_nations: ["us"],
				drm: 0,
				no_retreat: true,
			},
		}
		log(game, "event.log.yalta", { vp: game.vp })
	},
})

register(54, {
	name: "Finland Withdraws",
	canPlay: canPlayFinlandWithdraws,
	play(game, data, cardId) {
		game.events.finland_withdraws = true
		game.vp -= 1
		game.event = { card_id: cardId }
		log(game, "event.log.finland_withdraws", { vp: game.vp })
	},
})

for (const cardId of [22, 35]) {
	register(cardId, {
		name: cardId === 22 ? "Operation Uranus" : "Bagration",
		canPlay: (game) => !Weather.isSpringThaw(game),
		play(game) {
			game.event = {
				card_id: cardId,
				attack_modifier: {
					attacker_side: ALLIED,
					nations: ["su"],
					drm: 1,
					no_retreat: cardId === 35,
				},
			}
			log(game, cardId === 22 ? "event.log.soviet_attack" : "event.log.soviet_attack_no_retreat")
		},
	})
}

for (const cardId of [27, 29, 30]) {
	register(cardId, {
		name: DEFECTION_EVENTS[cardId].name_zh,
		canPlay: (game, data) => canPlayDefection(game, data, cardId),
		play: (game, data) => playDefection(game, data, cardId),
	})
}

register(42, {
	name: "Tito",
	canPlay(game, data) {
		const piece = titoPiece(data)
		return !!piece && Locations.isAvailable(game.pieces[piece.id]) && legalTitoSpaces(game, data).length > 0
	},
	play(game, data, cardId) {
		game.events.tito = true
		game.event = { card_id: cardId, tito: true }
		log(game, "event.log.people_army")
	},
})

register(49, {
	name: "Maquis",
	canPlay: (game, data) => !game.events.maquis && legalPartisanSpaces(game, data, true).length > 0,
	play(game, data, cardId) {
		game.events.maquis = true
		game.event = { card_id: cardId, partisan_placements: 1 }
		log(game, "event.log.partisan_expanded")
	},
})

for (const cardId of [95, 106]) {
	register(cardId, {
		name: "Anti-Partisan Sweep",
		canPlay: (game) => game.partisans.length > 0,
		play(game) {
			game.event = {
				card_id: cardId,
				remove_partisans: Math.min(2, game.partisans.length),
				removed_partisans: [],
			}
			log(game, "event.log.partisan_remove_up_to_two")
		},
	})
}

register(7, {
	name: "Industrial Evacuation",
	canPlay(game) {
		return !game.events.industrial_evacuation && !game.events.axis_occupied_moscow
	},
	play(game, data, cardId) {
		game.events.industrial_evacuation = true
		game.events.industrial_evacuation_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.soviet_tank_delay")
	},
})

register(14, {
	name: "Lend-Lease",
	canPlay(game) {
		return !game.events.lend_lease
	},
	play(game, data, cardId) {
		game.events.lend_lease = true
		game.events.lend_lease_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.mechanized_fronts")
	},
})

register(11, {
	name: "Sorge",
	canPlay(game) {
		return !game.events.sorge
	},
	play(game, data, cardId) {
		game.events.sorge = true
		game.events.sorge_turn = game.turn
		game.event = { card_id: cardId, sorge_markers: 2, marker_spaces: [] }
		log(game, "event.log.sorge_markers")
	},
})

register(21, {
	name: "British 8th Army Reinforcement",
	canPlay(game, data) {
		if (
			game.turn === 1 ||
			Reinforcements.reinforcementUsed(game, ALLIED, "br") ||
			!eventOccurredBeforeTurn(game, "us_buildup", "us_buildup_turn") ||
			!eventOccurredBeforeTurn(game, "british_desert_reinforcements", "british_desert_reinforcements_turn")
		)
			return false
		const desert = piecesNamed(data, ["BR Desert Army"])[0]
		const eighth = piecesNamed(data, ["BR 8 Army"])[0]
		const location = game.pieces[desert]
		if (!desert || !eighth || !Locations.isAvailable(game.pieces[eighth]) || !Number.isInteger(location) || location <= 0) return false
		const adjacency = MapSystem.buildAdjacency(data)
		return MapSystem.traceSupply(game, data, adjacency, ALLIED, location, "br") === "full"
	},
	play(game, data, cardId) {
		const desert = piecesNamed(data, ["BR Desert Army"])[0]
		const eighth = piecesNamed(data, ["BR 8 Army"])[0]
		const location = game.pieces[desert]
		const desertRef = pieceLogRef(game, desert)
		Reinforcements.markReinforcementUsed(game, ALLIED, "br")
		game.pieces[desert] = Locations.REMOVED
		game.pieces[eighth] = location
		const reduced = game.reduced.indexOf(eighth)
		if (reduced >= 0) game.reduced.splice(reduced, 1)
		game.events.british_eighth_army = true
		game.event = { card_id: cardId }
		log(game, "event.log.allied_replace", { space: `s${location}`, new_piece: pieceLogRef(game, eighth), old_piece: desertRef })
	},
})

register(23, {
	name: "Clearing the Scheldt",
	canPlay(game, data) {
		const antwerp = data.spaces.find((space) => space?.name === "Antwerp")
		return !!antwerp && game.control[antwerp.id] === ALLIED && !game.events.clearing_the_scheldt
	},
	play(game, data, cardId) {
		game.events.clearing_the_scheldt = true
		game.event = { card_id: cardId }
		log(game, "event.log.antwerp")
	},
})

register(56, {
	name: "Barbarossa",
	canPlay: (game) => game.turn === 1 && !game.events.von_paulus_pause,
	play(game) {
		game.events.barbarossa = true
		game.event = {
			card_id: 56,
			combat_markers: 5,
			attack_modifier: {
				attacker_side: AXIS,
				nations: ["ge"],
				defender_nations: ["su"],
				drm: 1,
				no_retreat: false,
			},
		}
		log(game, "event.log.combat_markers_five")
	},
})

// Axis Cards 3, 4 and 9. Taifun's combat modifier lasts for the current
// Action Round through game.event; the strategy unlocks persist in game.events.
register(58, {
	name: "OKH Conference",
	canPlay: (game) => !game.events.okh_conference && !game.events.taifun,
	play(game, data, cardId) {
		game.events.okh_conference = true
		game.events.okh_conference_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.okh_conference")
	},
})

register(59, {
	name: "Taifun",
	canPlay: (game) => !game.events.taifun,
	play(game, data, cardId) {
		game.events.taifun = true
		game.events.taifun_turn = game.turn
		if (!game.events.okh_conference) game.vp -= 1
		game.event = {
			card_id: cardId,
			combat_markers: 4,
			attack_modifier: {
				attacker_side: AXIS,
				defender_nations: ["su"],
				drm: 1,
				no_retreat: false,
			},
		}
		log(game, "event.log.taifun", {
			penalty: game.events.okh_conference ? { "zh-CN": "。", en: "." } : { "zh-CN": `；VP-1，当前 ${game.vp}。`, en: `; VP -1, now ${game.vp}.` },
		})
	},
})

register(61, {
	name: "Panzer Refit",
	canPlay: (game, data) => !Weather.isSpringThaw(game) && legalPanzerRefitPieces(game, data).length >= 1,
	play(game, data, cardId) {
		game.event = { card_id: cardId, panzer_refit_pieces: [] }
		log(game, "event.log.panzer_refit_select")
	},
})

register(62, {
	name: "Hedgehogs",
	canPlay: (game, data) => legalHedgehogSpaces(game, data).length >= 3,
	play(game, data, cardId) {
		game.event = { card_id: cardId, hedgehog_spaces: [] }
		log(game, "event.log.hedgehogs_select")
	},
})

register(64, {
	name: "Hitler Takes Command",
	canPlay: (game) => !game.events.hitler_takes_command,
	play(game, data, cardId) {
		game.events.hitler_takes_command = true
		game.events.hitler_takes_command_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.hitler_command")
	},
})

register(60, {
	name: "Panzergruppe Guderian",
	canPlay: (game, data) => !game.events.hitler_takes_command && !Weather.isSpringThaw(game) && canPlayExtraAttackEvent(game, data, "GE 2 Panzer Army"),
	play(game, data, cardId) {
		startExtraAttackEvent(game, data, cardId, "GE 2 Panzer Army", { "zh-CN": "古德里安装甲集群", en: "Panzergruppe Guderian" }, 1)
		log(game, "event.panzergruppe_guderian.play")
	},
})

register(66, {
	name: "Italian Naval Sortie",
	canPlay: () => true,
	play(game, data, cardId) {
		game.events.italian_naval_sortie = true
		game.events.italian_naval_sortie_turn = game.turn
		game.event = { card_id: cardId, optional_axis_marker: true }
		log(game, "event.log.italian_navy")
	},
})

register(67, {
	name: "Nordlicht",
	canPlay: (game) => !game.events.nordlicht && !Weather.isSpringThaw(game),
	play(game, data, cardId) {
		game.events.nordlicht = true
		game.events.nordlicht_turn = game.turn
		game.events.nordlicht_round = { turn: game.turn, round: game.action_round }
		game.event = { card_id: cardId }
		log(game, "event.log.nordlicht")
	},
})

register(68, {
	name: "Krim",
	canPlay(game, data) {
		const sevastopol = spaceNamed(data, "Sevastopol")
		return !!sevastopol && !game.destroyed_forts?.includes(sevastopol.id) && game.control[sevastopol.id] === ALLIED
	},
	play(game, data, cardId) {
		const sevastopol = spaceNamed(data, "Sevastopol")
		game.event = { card_id: cardId, krim_space: sevastopol.id }
		log(game, "event.krim.play")
	},
})

register(69, {
	name: "Fall Blau",
	canPlay: (game) => !!game.events.hitler_takes_command && !game.events.fall_blau,
	play(game, data, cardId) {
		game.events.fall_blau = true
		game.events.fall_blau_turn = game.turn
		game.event = {
			card_id: cardId,
			combat_markers: 5,
			attack_modifier: {
				attacker_side: AXIS,
				defender_nations: ["su"],
				drm: 1,
				no_retreat: false,
			},
		}
		log(game, "event.log.fall_blau")
	},
})

register(76, {
	name: "Herkules",
	canPlay(game, data) {
		const benghazi = spaceNamed(data, "Benghazi")
		const algiers = spaceNamed(data, "Algiers")
		return !game.events.herkules && benghazi && algiers && game.control[benghazi.id] !== ALLIED && game.control[algiers.id] !== ALLIED
	},
	play(game, data, cardId) {
		const malta = spaceNamed(data, "Malta")
		if (!malta) throw new Error("Malta space is missing")
		const eliminated = MapSystem.friendlyPiecesInSpace(game, data, ALLIED, malta.id)
		for (const pieceId of eliminated) {
			game.pieces[pieceId] = Locations.eliminated(ALLIED)
			Combat.setReduced(game, pieceId, false)
			if (data.pieces[pieceId]?.size === "lcu") {
				game.eliminated_theater ||= {}
				game.eliminated_theater[pieceId] = "med"
			}
		}
		MapSystem.setControl(game, data, malta.id, AXIS, "it")
		game.events.herkules = true
		game.events.herkules_turn = game.turn
		game.events.herkules_space = malta.id
		game.event = { card_id: cardId }
		log(game, "event.log.herkules", {
			space: `s${malta.id}`,
			losses: eliminated.length ? I18n.message("event.log.herkules_losses", { pieces: I18n.list(eliminated.map((pieceId) => pieceLogRef(game, pieceId))) }) : "",
		})
	},
})

register(78, {
	name: "Axis Satellites",
	canPlay: (game, data) => !game.events.axis_satellites && canPlayAxisSatellites(game, data),
	play(game, data, cardId) {
		deployAxisSatellites(game, data)
		game.events.axis_satellites = true
		game.events.axis_satellites_turn = game.turn
		game.event = { card_id: cardId }
	},
})

register(81, {
	name: "Totaler Krieg!",
	canPlay: (game) => !!game.events.hitler_takes_command && !game.events.totaler_krieg,
	play(game, data, cardId) {
		const bonus = game.vp >= 11 ? 20 : 0
		game.vp += bonus
		game.events.totaler_krieg = true
		game.events.totaler_krieg_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.totaler_krieg", {
			bonus: bonus ? { "zh-CN": `；VP+20，当前 ${game.vp}`, en: `; VP +20, now ${game.vp}` } : "",
		})
	},
})

register(82, {
	name: "Fall Zitadelle",
	canPlay: (game) => !!game.events.hitler_takes_command && !game.events.fall_zitadelle,
	play(game, data, cardId) {
		game.events.fall_zitadelle = true
		game.events.fall_zitadelle_turn = game.turn
		game.event = {
			card_id: cardId,
			combat_markers: 2,
			zitadelle_success: false,
			defender_modifier: {
				defender_side: ALLIED,
				nations: ["su"],
				drm: 2,
			},
		}
		log(game, "event.zitadelle.play")
	},
})

register(80, {
	name: "Stuka",
	canPlay: (game) => [2, 3, 6, 7, 10, 11].includes(game.turn),
	play(game, data, cardId) {
		game.event = {
			card_id: cardId,
			attack_modifier: {
				attacker_side: AXIS,
				nations: ["ge"],
				defender_nations: ["su"],
				drm: 1,
				no_retreat: false,
			},
		}
		log(game, "event.log.stuka")
	},
})

register(83, {
	name: "Skorzeny",
	canPlay(game, data) {
		const rome = data.spaces.find((space) => space?.name === "Rome")?.id
		return !!game.events.achse || (!!rome && game.control[rome] === ALLIED)
	},
	play(game, data, cardId) {
		game.events.skorzeny = true
		game.vp += 1
		game.event = { card_id: cardId }
		log(game, "event.log.skorzeny", { vp: game.vp })
	},
})

register(86, {
	name: "Achse",
	canPlay(game, data) {
		const messina = spaceNamed(data, "Messina")
		return !game.events.achse && ((messina && game.control[messina.id] === ALLIED) || alliedInvasionAtAchseBeach(game, data))
	},
	play(game, data, cardId) {
		game.events.achse = true
		game.events.achse_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.axis_action")
	},
})

register(100, {
	name: "Vergeltungs-Waffe",
	canPlay: () => true,
	play(game, data, cardId) {
		game.events.vergeltungs_waffe = true
		game.vp += 1
		game.event = { card_id: cardId }
		log(game, "event.log.revenge_weapon", { vp: game.vp })
	},
})

register(101, {
	name: "Manstein",
	canPlay: () => true,
	play(game, data, cardId) {
		const order = game.orders?.axis
		if (order) {
			order.cancelled = true
			order.fulfilled = true
		}
		let removed = 0
		for (const [spaceId, marker] of Object.entries(game.stand_fast || {})) {
			if (marker !== "hitler") continue
			delete game.stand_fast[spaceId]
			if (game.stand_fast_round_units) delete game.stand_fast_round_units[spaceId]
			removed++
		}
		game.events.manstein_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.log.manstein", {
			removed: removed ? { "zh-CN": `，移除${removed}个希特勒坚守标记`, en: ` and removes ${removed} Hitler Stand Fast markers` } : "",
		})
	},
})

register(105, {
	name: "Foreign Armies East",
	canPlay: (game) => !Weather.isSpringThaw(game),
	play(game, data, cardId) {
		const initial = revealableForeignArmiesEastCards(game)
		game.events.foreign_armies_east = { turn: game.turn, initial, final: null }
		game.events.foreign_armies_east_turn = game.turn
		game.event = { card_id: cardId }
		log(game, "event.foreign_armies_east.reveal", { cards: publicCardRefs(initial) })
	},
})

register(93, {
	name: "Atlantic Wall",
	canPlay: (game, data) => !game.events.round_up && !game.events.overlord && legalAtlanticWallSpaces(game, data).length >= 2,
	play(game, data, cardId) {
		game.event = { card_id: cardId, atlantic_wall_spaces: [] }
		log(game, "event.log.atlantic_wall_select")
	},
})

register(94, {
	name: "East Wall",
	canPlay: (game, data) => legalEastWallSpaces(game, data).length >= 3,
	play(game, data, cardId) {
		game.event = { card_id: cardId, east_wall_spaces: [] }
		log(game, "event.log.east_wall_select")
	},
})

register(107, {
	name: "Final Production Surge",
	canPlay: (game, data) => !!game.events.speer && game.turn < 15 && !game.events.final_production_surge && legalFinalProductionSurgePieces(game, data).length >= 3,
	play(game, data, cardId) {
		game.event = { card_id: cardId, final_production_surge_pieces: [] }
		log(game, "event.log.final_production_select")
	},
})

register(108, {
	name: "Wacht am Rhein",
	canPlay: (game) => !!game.events.hitler_takes_command && !game.events.wacht_am_rhein && [3, 4, 7, 8, 11, 12, 15, 16].includes(game.turn),
	play(game, data, cardId) {
		const armies = ["GE 5 Panzer Army", "GE 6SS Panzer Army"].map((name) => pieceNamed(data, name)?.id).filter(Number.isInteger)
		game.events.wacht_am_rhein = true
		game.events.wacht_am_rhein_turn = game.turn
		game.event = {
			card_id: cardId,
			combat_markers: 4,
			attack_modifier: {
				attacker_side: AXIS,
				any_attacker_piece_ids: armies,
				excluded_defender_nations: ["su"],
				drm: 2,
				no_retreat: false,
			},
		}
		log(game, "event.wacht_am_rhein.play")
	},
})

register(109, {
	name: "The Bunker",
	canPlay: (game) => !game.events.national_redoubt && !game.events.the_bunker,
	play(game, data, cardId) {
		const berlin = data.spaces.find((space) => space?.name === "Berlin")?.id
		if (!berlin) throw new Error("Berlin space is missing")
		game.events.the_bunker = true
		game.events.the_bunker_turn = game.turn
		game.trench[berlin] = Math.max(1, Number(game.trench[berlin]) || 0)
		game.trench_owner[berlin] = AXIS
		game.event = { card_id: cardId }
		log(game, "event.log.bunker", { space: `s${berlin}` })
	},
})

register(110, {
	name: "National Redoubt",
	canPlay: (game) => !game.events.the_bunker && !game.events.national_redoubt,
	play(game, data, cardId) {
		const munich = data.spaces.find((space) => space?.name === "Munich")?.id
		if (!munich) throw new Error("Munich space is missing")
		game.events.national_redoubt = true
		game.events.national_redoubt_turn = game.turn
		game.events.national_redoubt_space = munich
		game.event = { card_id: cardId }
		log(game, "event.log.fortress", { space: `s${munich}` })
	},
})

register(57, {
	name: "Von Paulus Pause",
	canPlay: (game) => game.turn === 1 && !game.events.barbarossa,
	play(game) {
		game.events.von_paulus_pause = true
		game.events.cancel_winter_42 = true
		game.events.axis_forced_auto_ops = 2
		game.event = { card_id: 57, combat_markers: 4 }
		log(game, "event.log.combat_markers_four_auto_ops")
	},
})

register(19, {
	name: "Partisans",
	canPlay: () => true,
	play(game) {
		game.events.partisans = true
		game.event = { card_id: 19 }
		log(game, "event.log.partisan_nations")
	},
})

function enterUnitedStates(game, source) {
	game.events.us_entry = true
	game.events.us_entry_turn = game.turn
	game.events.us_entry_source = source
	game.event = { card_id: source }
	log(game, "event.log.us_entry", { turn: game.turn })
}

register(6, {
	name: "FDR Declares War",
	canPlay: (game) => game.turn >= 3 && !game.events.us_entry,
	play(game) {
		enterUnitedStates(game, 6)
	},
})

register(63, {
	name: "Hitler Declares War",
	canPlay: (game) => game.turn >= 3 && !game.events.us_entry,
	play(game) {
		game.vp += 1
		enterUnitedStates(game, 63)
		log(game, "event.log.vp_plus_one", { vp: game.vp })
	},
})

register(9, {
	name: "US Build-Up",
	canPlay: (game) => !!game.events.us_entry && game.turn > game.events.us_entry_turn && !game.events.us_buildup,
	play(game) {
		game.events.us_buildup = true
		game.events.us_buildup_turn = game.turn
		game.event = { card_id: 9 }
		log(game, "event.log.us_events_enabled")
	},
})

for (const cardId of Object.keys(Invasions.SPECS).map(Number)) {
	const spec = Invasions.SPECS[cardId]
	register(cardId, {
		name: spec.name,
		canPlay: (game, data) => {
			const adjacency = MapSystem.buildAdjacency(data)
			return Invasions.canPlay(game, data, cardId) || Invasions.canPlayAsReinforcement(game, data, MapSystem, adjacency, cardId)
		},
		play: (game, data) => {
			const adjacency = MapSystem.buildAdjacency(data)
			if (Invasions.canPlay(game, data, cardId)) Invasions.begin(game, data, cardId)
			else Invasions.beginReinforcement(game, data, MapSystem, adjacency, cardId)
		},
	})
}

function handlerFor(data, cardId) {
	return data.cards[cardId] ? handlers.get(cardId) : null
}

function isAllied1941ExclusiveCard(data, cardId) {
	const card = data.cards[cardId]
	return card?.side === ALLIED && (card.num === 2 || card.num === 24)
}

function allowedByOptionalRules(game, data, cardId) {
	if (!game.options?.allied_2_24_exclusive_1941) return true
	if (game.turn < 1 || game.turn > 3) return true
	if (!isAllied1941ExclusiveCard(data, cardId)) return true
	return !game.events.allied_2_24_played
}

function canPlayEvent(game, data, cardId) {
	const handler = handlerFor(data, cardId)
	return !!handler && allowedByOptionalRules(game, data, cardId) && handler.canPlay(game, data, cardId)
}

function playEvent(game, data, cardId) {
	const handler = handlerFor(data, cardId)
	if (!handler || !allowedByOptionalRules(game, data, cardId) || !handler.canPlay(game, data, cardId)) throw new Error(`event is not playable: ${cardId}`)
	handler.play(game, data, cardId)
	if (game.options?.allied_2_24_exclusive_1941 && game.turn >= 1 && game.turn <= 3 && isAllied1941ExclusiveCard(data, cardId)) game.events.allied_2_24_played = cardId
}

module.exports = {
	allowedByOptionalRules,
	canPlayEvent,
	eventOpsValue,
	handlerFor,
	handlers,
	legalAtlanticWallSpaces,
	legalBanzaiCorps,
	legalEastWallSpaces,
	legalFinalProductionSurgePieces,
	legalFrontReplacementPieces,
	legalHedgehogSpaces,
	legalLuftwaffeSupplySpaces,
	legalPartisanRemovalSpaces,
	legalPartisanSpaces,
	legalPanzerAfrikaTransferPieces,
	legalPanzerRefitPieces,
	legalReinforcementSpaces,
	legalSorgeMarkerSpaces,
	legalTitoSpaces,
	placeReinforcementLcu,
	placeTito,
	playEvent,
	revealForeignArmiesEastAtEnd,
	register,
	removePartisan,
	replaceMechanizedFront,
	settleActionEvent,
	completeAtlanticWall,
	completeEastWall,
	completeFinalProductionSurge,
	completeHedgehogs,
	completePanzerRefit,
	toggleAtlanticWallSpace,
	toggleBanzaiCorps,
	toggleEastWallSpace,
	toggleFinalProductionSurgePiece,
	toggleHedgehogSpace,
	togglePanzerRefitPiece,
	transferPanzerAfrikaCorps,
	completeBanzai,
}
