"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
const Random = require("../core/random.js")
const Neutrals = require("./neutrals.js")

function rollAxis(game) {
	const die = Random.random(game, 6) + 1
	const modifier = game.events?.hitler_takes_command ? 2 : 0
	const modifiedDie = Math.min(6, die + modifier)
	const result = modifiedDie <= 4 ? "none" : modifiedDie === 5 ? "okw_mo" : "hitler_orders"
	game.orders.axis = {
		die,
		modifier,
		modified_die: modifiedDie,
		result,
		fulfilled: result === "none" || result === "hitler_orders",
	}
	return game.orders.axis
}

function rollAllied(game) {
	const die = Random.random(game, 6) + 1
	const result = die <= 2 ? "allied_mo" : die === 3 ? "soviet_mo" : "stalin_orders"
	game.orders.allied = { die, result, fulfilled: result === "stalin_orders" }
	return game.orders.allied
}

function adjacentSuppliedEnemy(game, data, map, logistics, adjacency, side, spaceId, nation = null) {
	for (const edge of adjacency[spaceId] || []) {
		if (edge.type === "sr") continue
		for (const pieceId of map.friendlyPiecesInSpace(game, data, side, edge.to)) {
			if (nation && data.pieces[pieceId]?.nation !== nation) continue
			if (logistics.supplyStatus(game, data, map, adjacency, pieceId) !== "oos") return true
		}
	}
	return false
}

function eligibleStandFast(game, data, map, logistics, adjacency, kind) {
	const targetSide = kind === "hitler" ? AXIS : ALLIED
	const enemy = targetSide === AXIS ? ALLIED : AXIS
	const targetNation = kind === "stalin" ? "su" : null
	const result = []
	for (let spaceId = 1; spaceId < data.spaces.length; spaceId++) {
		if (game.stand_fast[spaceId]) continue
		const targets = map.friendlyPiecesInSpace(game, data, targetSide, spaceId)
		if (!targets.length || (targetNation && !targets.some((pieceId) => data.pieces[pieceId]?.nation === targetNation))) continue
		if (adjacentSuppliedEnemy(game, data, map, logistics, adjacency, enemy, spaceId)) result.push(spaceId)
	}
	return result
}

function standFastSide(marker) {
	return marker === "hitler" ? AXIS : marker === "stalin" ? ALLIED : null
}

function standFastUnitsInSpace(game, data, spaceId) {
	const side = standFastSide(game.stand_fast?.[spaceId])
	if (!side) return []
	const units = []
	for (let pieceId = 1; pieceId < game.pieces.length; pieceId++) {
		if (game.pieces[pieceId] === Number(spaceId) && Neutrals.effectivePieceSide(game, data.pieces[pieceId]) === side) units.push(pieceId)
	}
	return units
}

function recordStandFastUnits(game, data) {
	game.stand_fast_round_units = {}
	for (const spaceId of Object.keys(game.stand_fast || {})) game.stand_fast_round_units[spaceId] = standFastUnitsInSpace(game, data, spaceId)
	return game.stand_fast_round_units
}

function ensureStandFastUnits(game, data, spaceId) {
	if (!game.stand_fast?.[spaceId]) return []
	game.stand_fast_round_units ||= {}
	game.stand_fast_round_units[spaceId] ||= standFastUnitsInSpace(game, data, spaceId)
	return game.stand_fast_round_units[spaceId]
}

function removeStandFast(game, spaceId) {
	if (!game.stand_fast?.[spaceId]) return false
	delete game.stand_fast[spaceId]
	if (game.stand_fast_round_units) delete game.stand_fast_round_units[spaceId]
	return true
}

function releaseStandFastIfVacated(game, data, spaceId) {
	const units = ensureStandFastUnits(game, data, spaceId)
	if (units.some((pieceId) => game.pieces[pieceId] === Number(spaceId))) return false
	return removeStandFast(game, spaceId)
}

function fulfillForCombat(game, data, combat) {
	if (combat.attacker_side === AXIS && game.orders?.axis?.result === "okw_mo") {
		if (combat.attackers.some((pieceId) => data.pieces[pieceId]?.nation === "ge") && data.spaces[combat.defender_space]?.nation !== "su") game.orders.axis.fulfilled = true
	}
	if (combat.attacker_side === ALLIED && game.orders?.allied?.result === "allied_mo") {
		if (combat.attackers.some((pieceId) => ["br", "cw", "us", "ff"].includes(data.pieces[pieceId]?.nation))) game.orders.allied.fulfilled = true
	}
	if (combat.attacker_side === ALLIED && game.orders?.allied?.result === "soviet_mo") {
		if (combat.attackers.some((pieceId) => data.pieces[pieceId]?.nation === "su" && data.pieces[pieceId]?.size === "lcu")) game.orders.allied.fulfilled = true
	}
}

function fulfillForOccupation(game, data, pieceId, spaceId, previousControl) {
	const piece = data.pieces[pieceId]
	const side = Neutrals.effectivePieceSide(game, piece)
	if (!piece || previousControl !== (side === AXIS ? ALLIED : AXIS)) return false
	if (side === AXIS && game.orders?.axis?.result === "okw_mo" && piece.nation === "ge" && data.spaces[spaceId]?.nation !== "su") {
		game.orders.axis.fulfilled = true
		return true
	}
	if (side === ALLIED && game.orders?.allied?.result === "allied_mo" && ["br", "us"].includes(piece.nation)) {
		game.orders.allied.fulfilled = true
		return true
	}
	if (side === ALLIED && game.orders?.allied?.result === "soviet_mo" && piece.nation === "su") {
		game.orders.allied.fulfilled = true
		return true
	}
	return false
}

function applyPenalties(game) {
	const penalties = []
	if (game.orders?.axis && !game.orders.axis.fulfilled) {
		game.vp--
		penalties.push("Axis")
	}
	if (game.orders?.allied && !game.orders.allied.fulfilled) {
		game.vp++
		penalties.push("Allied")
	}
	return penalties
}

module.exports = {
	applyPenalties,
	eligibleStandFast,
	ensureStandFastUnits,
	fulfillForCombat,
	fulfillForOccupation,
	recordStandFastUnits,
	releaseStandFastIfVacated,
	removeStandFast,
	rollAllied,
	rollAxis,
}
