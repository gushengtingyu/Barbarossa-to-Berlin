"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
const Locations = require("../core/unit_locations.js")
const Combat = require("./combat.js")

function hasTrait(piece, trait) {
	return String(piece?.traits || "")
		.split(";")
		.includes(trait)
}

function isWesternAlliedPiece(piece) {
	return ["br", "cw", "us", "ff"].includes(piece?.nation)
}

function beachheadSupportsNation(marker, nation) {
	if (!marker || marker.shingle) return false
	if (marker.type === "allied") return true
	if (marker.type === "br") return ["br", "cw"].includes(nation)
	if (marker.type === "us") return ["us", "ff"].includes(nation)
	return false
}

function homePlacementAllowed(game, space, piece, allowConvertedInvasionLcu = false) {
	const name = space.name
	if (hasTrait(piece, "desert_army")) return ["Basra", "Suez", "Alexandria"].includes(name)
	if (hasTrait(piece, "british_eighth_army") && !allowConvertedInvasionLcu) return false
	if (["br", "cw"].includes(piece.nation)) return ["Basra", "Suez", "Alexandria"].includes(name)
	if (["us", "ff"].includes(piece.nation)) return name === "Basra"
	if (piece.nation === "su") return space.nation === "su" && (space.urban || space.supply === "allied")
	if (piece.nation === "ge") return space.nation === "ge" && (space.urban || space.supply === "axis")
	if (piece.nation === "it") return space.nation === "it" && (space.urban || name === "Rome")
	if (piece.nation === "tu") return ["Ankara", "Istanbul"].includes(name)
	return { hu: "Budapest", ro: "Bucharest", bu: "Sofia", sw: "Stockholm", yu: "Belgrade" }[piece.nation] === name
}

function westernSpecialPlacementAllowed(game, space, piece, allowConvertedInvasionLcu = false) {
	if (!isWesternAlliedPiece(piece) || hasTrait(piece, "desert_army") || (hasTrait(piece, "british_eighth_army") && !allowConvertedInvasionLcu)) return false
	if (space.kind === "beach") return beachheadSupportsNation(game.beachheads?.[space.id], piece.nation)
	if (space.name === "Naples") return true
	if (space.name === "Antwerp") return !!game.events.clearing_the_scheldt
	return false
}

function createReinforcementSearchContext(game, data, map, adjacency) {
	if (typeof map.createSupplySearchContext !== "function") return null
	const search = map.createSupplySearchContext(game, data, adjacency, "reinforcement")
	const basePlacements = new Map()
	return Object.freeze({
		piecesInSpace(spaceId) {
			return search.piecesInSpace(spaceId)
		},
		setPieceLocation(pieceId, spaceId) {
			search.setPieceLocation(pieceId, spaceId)
		},
		supplyStatus(side, spaceId, nation) {
			return search.supplyStatus(side, spaceId, nation)
		},
		basePlacementSpaces(key, compute) {
			if (!basePlacements.has(key)) basePlacements.set(key, Object.freeze(compute().slice()))
			return basePlacements.get(key)
		},
	})
}

function legalLcuPlacementSpaces(game, data, map, adjacency, pieceId, options = {}, context = null) {
	const piece = data.pieces[pieceId]
	if (!piece || (piece.size !== "lcu" && !options.allow_scu_as_lcu)) return []
	const side = map.pieceSide(game, data, pieceId)
	const baseKey = `${side}:${piece.nation}:${piece.traits || ""}:${options.allow_scu_as_lcu ? 1 : 0}:${options.allow_converted_invasion_lcu ? 1 : 0}`
	const buildBase = () => {
		const result = []
		for (let spaceId = 1; spaceId < data.spaces.length; spaceId++) {
			const space = data.spaces[spaceId]
			const neutralHome = ["tu", "sw"].includes(piece.nation) && space?.nation === piece.nation && side !== "neutral"
			if (!space || !["land", "beach"].includes(space.kind) || (!neutralHome && game.control[spaceId] !== side)) continue
			if (!homePlacementAllowed(game, space, piece, options.allow_converted_invasion_lcu) && !westernSpecialPlacementAllowed(game, space, piece, options.allow_converted_invasion_lcu)) continue
			const supply = context?.supplyStatus ? context.supplyStatus(side, spaceId, piece.nation) : map.traceSupply(game, data, adjacency, side, spaceId, piece.nation)
			if (supply !== "full") continue
			if (piece.nation === "ge" && ["axis", "axis_limited"].includes(space.supply)) {
				const otherSource = map.traceSupplyDetails(game, data, adjacency, side, spaceId, piece.nation, { exclude_sources: [spaceId] })
				if (otherSource.status !== "full") continue
			}
			result.push(spaceId)
		}
		return result
	}
	const base = context?.basePlacementSpaces ? context.basePlacementSpaces(baseKey, buildBase) : buildBase()
	return base.filter((spaceId) => map.canStack(game, data, pieceId, spaceId, context))
}

function legalDesertArmyReinforcementSpaces(game, data, map, adjacency, pieceId, context = null) {
	const piece = data.pieces[pieceId]
	if (!hasTrait(piece, "desert_army") || !Locations.isAvailable(game.pieces[pieceId])) return []
	return data.spaces
		.filter((space) => ["Alexandria", "Cairo", "Basra"].includes(space?.name))
		.filter(
			(space) =>
				game.control[space.id] === ALLIED &&
				map.canStack(game, data, pieceId, space.id, context) &&
				(context?.supplyStatus ? context.supplyStatus(ALLIED, space.id, piece.nation) : map.traceSupply(game, data, adjacency, ALLIED, space.id, piece.nation)) === "full",
		)
		.map((space) => space.id)
}

function reinforcementActivationEligible(game, data, pieceId, spaceId) {
	const piece = data.pieces[pieceId]
	const space = data.spaces[spaceId]
	if (!isWesternAlliedPiece(piece) || hasTrait(piece, "desert_army") || hasTrait(piece, "british_eighth_army") || !space) return false
	if (["Naples", "Antwerp"].includes(space.name)) return true
	return space.kind === "beach" && game.beachheads?.[spaceId]?.card_id === 33
}

function reinforcementYellowEventEligible(game, data, pieceId, spaceId) {
	const piece = data.pieces[pieceId]
	const space = data.spaces[spaceId]
	return game.turn >= 16 && game.turn <= 18 && isWesternAlliedPiece(piece) && !hasTrait(piece, "desert_army") && !hasTrait(piece, "british_eighth_army") && space?.name === "Antwerp"
}

function legalLcuReinforcementSpaces(game, data, map, adjacency, pieceId, context = null) {
	if (!Locations.isAvailable(game.pieces[pieceId])) return []
	return legalLcuPlacementSpaces(game, data, map, adjacency, pieceId, {}, context)
}

function legalLcuStyleReinforcementSpaces(game, data, map, adjacency, pieceId, context = null) {
	if (!Locations.isAvailable(game.pieces[pieceId])) return []
	return legalLcuPlacementSpaces(game, data, map, adjacency, pieceId, { allow_scu_as_lcu: true }, context)
}

function legalConvertedInvasionLcuSpaces(game, data, map, adjacency, pieceId, context = null) {
	if (!Locations.isAvailable(game.pieces[pieceId])) return []
	return legalLcuPlacementSpaces(game, data, map, adjacency, pieceId, { allow_converted_invasion_lcu: true }, context)
}

function placeUsing(game, data, map, adjacency, pieceId, spaceId, legalSpaces, message, options = {}) {
	const candidates = options.legal_spaces || legalSpaces(game, data, map, adjacency, pieceId, options.context)
	if (!candidates.includes(spaceId)) throw new Error(message)
	game.pieces[pieceId] = spaceId
	Combat.setReduced(game, pieceId, false)
	return { piece_id: pieceId, space_id: spaceId }
}

function placeReinforcementLcu(game, data, map, adjacency, pieceId, spaceId, options = {}) {
	return placeUsing(game, data, map, adjacency, pieceId, spaceId, legalLcuReinforcementSpaces, `LCU ${pieceId} cannot enter as a reinforcement at ${spaceId}`, options)
}

function placeLcuStyleReinforcement(game, data, map, adjacency, pieceId, spaceId, options = {}) {
	return placeUsing(game, data, map, adjacency, pieceId, spaceId, legalLcuStyleReinforcementSpaces, `piece ${pieceId} cannot enter using LCU reinforcement rules at ${spaceId}`, options)
}

function placeDesertArmyReinforcement(game, data, map, adjacency, pieceId, spaceId, options = {}) {
	return placeUsing(game, data, map, adjacency, pieceId, spaceId, legalDesertArmyReinforcementSpaces, `Desert Army ${pieceId} cannot enter at ${spaceId}`, options)
}

function currentUsage(game) {
	if (game.reinforcement_usage?.turn === game.turn) return game.reinforcement_usage
	return { turn: game.turn, [ALLIED]: {}, [AXIS]: {} }
}

function reinforcementUsed(game, side, nation) {
	return currentUsage(game)?.[side]?.[nation] === true
}

function markReinforcementUsed(game, side, nation) {
	if (![ALLIED, AXIS].includes(side)) throw new Error(`invalid reinforcement side: ${side}`)
	if (typeof nation !== "string" || !nation) throw new Error("reinforcement nation is required")
	if (game.reinforcement_usage?.turn !== game.turn) game.reinforcement_usage = currentUsage(game)
	game.reinforcement_usage[side] ||= {}
	game.reinforcement_usage[side][nation] = true
}

function markReinforcementsUsed(game, side, nations) {
	for (const nation of [...new Set(nations || [])].sort()) markReinforcementUsed(game, side, nation)
}

function recordReinforcementOrigin(game, cardId, pieceIds) {
	if (!Number.isInteger(cardId) || cardId < 1 || cardId > 110) throw new Error(`invalid reinforcement card id: ${cardId}`)
	game.reinforcement_origin ||= {}
	for (const pieceId of [...new Set(pieceIds || [])].sort((a, b) => a - b)) game.reinforcement_origin[pieceId] ??= cardId
}

// Memoized states live only for this legality query, so the optimization remains
// deterministic and cannot retain hidden information between actions.
function searchUnitPlacements(game, units, placementSpaces, context = null, collectFirst = false) {
	const sandbox = { ...game, pieces: game.pieces.slice(), reduced: game.reduced.slice() }
	const ordered = (units || []).slice()
	const memo = new Map()
	function stateKey(index) {
		return `${index}|${ordered.map((unit) => `${unit.piece_id}:${sandbox.pieces[unit.piece_id]}`).join(",")}`
	}
	function place(index) {
		if (index >= ordered.length) return true
		const key = stateKey(index)
		if (memo.has(key)) return memo.get(key)
		const unit = ordered[index]
		const original = sandbox.pieces[unit.piece_id]
		const spaces = [...new Set(placementSpaces(sandbox, unit, context).map(Number))].sort((a, b) => a - b)
		for (const spaceId of spaces) {
			sandbox.pieces[unit.piece_id] = spaceId
			context?.setPieceLocation?.(unit.piece_id, spaceId)
			if (place(index + 1)) {
				sandbox.pieces[unit.piece_id] = original
				context?.setPieceLocation?.(unit.piece_id, original)
				memo.set(key, true)
				return true
			}
			sandbox.pieces[unit.piece_id] = original
			context?.setPieceLocation?.(unit.piece_id, original)
		}
		memo.set(key, false)
		return false
	}
	if (!collectFirst) return place(0)
	if (!ordered.length) return []
	const first = ordered[0]
	const original = sandbox.pieces[first.piece_id]
	const spaces = [...new Set(placementSpaces(sandbox, first, context).map(Number))].sort((a, b) => a - b)
	const result = []
	for (const spaceId of spaces) {
		sandbox.pieces[first.piece_id] = spaceId
		context?.setPieceLocation?.(first.piece_id, spaceId)
		if (place(1)) result.push(spaceId)
		sandbox.pieces[first.piece_id] = original
		context?.setPieceLocation?.(first.piece_id, original)
	}
	return result
}

function canPlaceAllUnits(game, units, placementSpaces, context = null) {
	return searchUnitPlacements(game, units, placementSpaces, context, false)
}

function legalFirstUnitPlacements(game, units, placementSpaces, context = null) {
	return searchUnitPlacements(game, units, placementSpaces, context, true)
}

module.exports = Object.freeze({
	canPlaceAllUnits,
	createReinforcementSearchContext,
	legalFirstUnitPlacements,
	legalConvertedInvasionLcuSpaces,
	legalDesertArmyReinforcementSpaces,
	legalLcuPlacementSpaces,
	legalLcuReinforcementSpaces,
	legalLcuStyleReinforcementSpaces,
	markReinforcementUsed,
	markReinforcementsUsed,
	placeDesertArmyReinforcement,
	placeLcuStyleReinforcement,
	placeReinforcementLcu,
	recordReinforcementOrigin,
	reinforcementActivationEligible,
	reinforcementUsed,
	reinforcementYellowEventEligible,
})
