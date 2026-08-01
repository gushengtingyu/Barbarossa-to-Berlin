"use strict"

const { ALLIED, AXIS, otherSide } = require("../core/constants.js")
const Locations = require("../core/unit_locations.js")
const Combat = require("./combat.js")
const Neutrals = require("./neutrals.js")
const Orders = require("./orders.js")
const Reinforcements = require("./reinforcements.js")
const Replacements = require("./replacements.js")
const Stalin = require("./stalin.js")

function supplyStatus(game, data, map, adjacency, pieceId, context = null) {
	const piece = data.pieces[pieceId]
	const location = game.pieces[pieceId]
	if (!piece || !Number.isInteger(location) || location <= 0) return "off_map"
	if (typeof map.pieceSupplyStatus === "function") return map.pieceSupplyStatus(game, data, adjacency, pieceId, context, location)
	const side = map.pieceSide(game, data, pieceId)
	return map.traceSupply(game, data, adjacency, side, location, piece.nation)
}

function eliminateForAttrition(game, data, pieceId, map = null) {
	const piece = data.pieces[pieceId]
	const location = game.pieces[pieceId]
	const side = map?.pieceSide ? map.pieceSide(game, data, pieceId) : Neutrals.effectivePieceSide(game, piece)
	Orders.ensureStandFastUnits(game, data, location)
	Combat.setReduced(game, pieceId, false)
	if (game.eliminated_theater) delete game.eliminated_theater[pieceId]
	if (piece.size === "scu") {
		game.pieces[pieceId] = Locations.eliminated(side)
		Orders.releaseStandFastIfVacated(game, data, location)
		return
	}
	const replacement = Combat.findLcuReplacement(game, data, pieceId)
	if (!replacement) {
		game.pieces[pieceId] = Locations.REMOVED
		Orders.releaseStandFastIfVacated(game, data, location)
		return
	}
	Combat.recordLcuReplacementIdentity(game, data, pieceId, replacement)
	const southwestReplacement = Combat.replaceEliminatedSouthwestFront(game, data, pieceId)
	Combat.setReduced(game, replacement, false)
	game.pieces[replacement] = Locations.eliminated(side)
	if (!southwestReplacement) game.pieces[pieceId] = piece.nation === "su" ? Locations.eliminated(side) : Locations.turnTrack(game.turn + 3)
	Orders.releaseStandFastIfVacated(game, data, location)
}

function releaseTurnTrackLcus(game, data, side, map = null) {
	const released = []
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		const pieceSide = map?.pieceSide ? map.pieceSide(game, data, pieceId) : data.pieces[pieceId]?.side
		if (pieceSide !== side || !Locations.isTurnTrack(game.pieces[pieceId], game.turn)) continue
		game.pieces[pieceId] = Locations.eliminated(side)
		released.push(pieceId)
	}
	return released
}

function resolveAttrition(game, data, map, adjacency, side) {
	const released = releaseTurnTrackLcus(game, data, side, map)
	const context = typeof map.createSupplySearchContext === "function" ? map.createSupplySearchContext(game, data, adjacency, "attrition") : "attrition"
	const eliminated = []
	const eliminatedReduced = []
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		if (map.pieceSide(game, data, pieceId) !== side || supplyStatus(game, data, map, adjacency, pieceId, context) !== "oos") continue
		if (Combat.isReduced(game, pieceId)) eliminatedReduced.push(pieceId)
		eliminateForAttrition(game, data, pieceId, map)
		context?.setPieceLocation?.(pieceId, game.pieces[pieceId])
		eliminated.push(pieceId)
	}
	const changedControl = []
	for (let spaceId = 1; spaceId < data.spaces.length; spaceId++) {
		const space = data.spaces[spaceId]
		if (!space || space.kind !== "land" || game.control[spaceId] !== side) continue
		if (space.name === "Malta") continue
		if (side === ALLIED && game.events?.tito && space.nation === "yu") continue
		const occupants = map.friendlyPiecesInSpace(game, data, side, spaceId, typeof context === "object" ? context : null)
		if (occupants.some((pieceId) => supplyStatus(game, data, map, adjacency, pieceId, context) !== "oos")) continue
		const controller = typeof map.controlNation === "function" ? map.controlNation(game, data, spaceId) : null
		const nation = side === AXIS ? "ge" : ["su", "br", "cw", "us", "ff"].includes(controller) ? controller : space.nation === "su" ? "su" : "us"
		const spaceSupply = typeof context === "object" ? context.supplyStatus(side, spaceId, nation) : map.traceSupply(game, data, adjacency, side, spaceId, nation)
		if (spaceSupply !== "oos") continue
		if (side === ALLIED && game.stalin_location === spaceId && !map.friendlyPiecesInSpace(game, data, ALLIED, spaceId, typeof context === "object" ? context : null).length) Stalin.eliminate(game, "attrition")
		map.setControl(game, data, spaceId, otherSide(side))
		context?.invalidateSupply?.()
		changedControl.push(spaceId)
	}
	return { eliminated, eliminatedReduced, changedControl, released }
}

// Compatibility facade only; reinforcement and replacement rules are owned by
// their dedicated systems and are forwarded below for older consumers.

module.exports = {
	discardUnspentRp: Replacements.discardUnspentRp,
	eliminateForAttrition,
	canRebuildLcuInAlliedReserve: Replacements.canRebuildLcuInAlliedReserve,
	legalDesertArmyReinforcementSpaces: Reinforcements.legalDesertArmyReinforcementSpaces,
	legalConvertedInvasionLcuSpaces: Reinforcements.legalConvertedInvasionLcuSpaces,
	legalLcuStyleReinforcementSpaces: Reinforcements.legalLcuStyleReinforcementSpaces,
	legalReplacementPieces: Replacements.legalReplacementPieces,
	legalLcuReplacementSpaces: Replacements.legalLcuReplacementSpaces,
	legalLcuReinforcementSpaces: Reinforcements.legalLcuReinforcementSpaces,
	panzerReplacementLimit: Replacements.panzerReplacementLimit,
	panzerStepsUsed: Replacements.panzerStepsUsed,
	placeRebuiltLcu: Replacements.placeRebuiltLcu,
	placeRebuiltLcuInAlliedReserve: Replacements.placeRebuiltLcuInAlliedReserve,
	placeDesertArmyReinforcement: Reinforcements.placeDesertArmyReinforcement,
	placeLcuStyleReinforcement: Reinforcements.placeLcuStyleReinforcement,
	placeReinforcementLcu: Reinforcements.placeReinforcementLcu,
	reinforcementActivationEligible: Reinforcements.reinforcementActivationEligible,
	releaseTurnTrackLcus,
	replaceStep: Replacements.replaceStep,
	replacementCost: Replacements.replacementCost,
	resolveAttrition,
	rpBucket: Replacements.rpBucket,
	supplyStatus,
}
