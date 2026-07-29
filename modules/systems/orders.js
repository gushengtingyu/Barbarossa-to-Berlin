"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
const Random = require("../core/random.js")
const Neutrals = require("./neutrals.js")

const MANDATED_OFFENSIVES = Object.freeze(["okw_mo", "allied_mo", "soviet_mo"])
const RULE_83_THEATER_MOS = Object.freeze(new Set(["okw_mo", "allied_mo"]))
const NORTH_AFRICA_NATIONS = Object.freeze(new Set(["dz", "tn", "ly", "eg"]))
// Rule 8.3 treats the Soviet Union, North Africa, and the Middle East as outside Europe.
const NON_EUROPE_NATIONS = Object.freeze(new Set(["su", "dz", "tn", "ly", "eg", "ir", "sy", "lb", "jo", "iq", "ps"]))

function isCombatUnit(piece) {
	return ["scu", "lcu"].includes(piece?.size)
}

function onMapPieces(game, data, predicate) {
	const result = []
	for (let pieceId = 1; pieceId < game.pieces.length; pieceId++) {
		const location = game.pieces[pieceId]
		const piece = data.pieces[pieceId]
		if (Number.isInteger(location) && location > 0 && isCombatUnit(piece) && predicate(piece)) result.push({ piece, location })
	}
	return result
}

function spaceHasSide(game, data, spaceId, side) {
	for (let pieceId = 1; pieceId < game.pieces.length; pieceId++) {
		if (game.pieces[pieceId] !== spaceId || !isCombatUnit(data.pieces[pieceId])) continue
		if (Neutrals.effectivePieceSide(game, data.pieces[pieceId]) === side) return true
	}
	return false
}

// Rule 8.3 targets are theater-local: Sea SR links alone do not make a land offensive possible.
function connectedLandSpaces(game, data, adjacency, origin) {
	const connected = new Set([origin])
	const queue = [origin]
	for (let cursor = 0; cursor < queue.length; cursor++) {
		for (const edge of adjacency[queue[cursor]] || []) {
			const space = data.spaces[edge.to]
			if (edge.type === "sr" || space?.kind !== "land" || connected.has(edge.to) || !Neutrals.mayEnterSpace(game, space)) continue
			connected.add(edge.to)
			queue.push(edge.to)
		}
	}
	return connected
}

function mandatedOffensivePieces(game, data, result) {
	if (result === "okw_mo") return onMapPieces(game, data, (piece) => piece.nation === "ge" && Neutrals.effectivePieceSide(game, piece) === AXIS)
	if (result === "allied_mo") return onMapPieces(game, data, (piece) => ["br", "us"].includes(piece.nation) && Neutrals.effectivePieceSide(game, piece) === ALLIED)
	if (result === "soviet_mo") return onMapPieces(game, data, (piece) => piece.nation === "su" && Neutrals.effectivePieceSide(game, piece) === ALLIED)
	return []
}

function isNorthAfricaSpace(space) {
	return space?.kind === "land" && NORTH_AFRICA_NATIONS.has(space.nation)
}

function isEuropeLandSpace(space) {
	return space?.kind === "land" && typeof space.nation === "string" && !NON_EUROPE_NATIONS.has(space.nation)
}

function isEuropeLocation(data, adjacency, location) {
	const space = data.spaces[location]
	if (isEuropeLandSpace(space)) return true
	if (space?.kind !== "beach") return false
	return (adjacency[location] || []).some((edge) => edge.type !== "sr" && isEuropeLandSpace(data.spaces[edge.to]))
}

// Rule 8.3: ignore Axis and Allied MOs when the Axis has no units in
// North Africa and the Allies have none in Europe.
function rule83TheaterVacuum(game, data, adjacency) {
	if (!Array.isArray(game?.pieces) || !data?.spaces || !data?.pieces || !adjacency) return false
	const pieces = onMapPieces(game, data, () => true)
	const axisInNorthAfrica = pieces.some(({ piece, location }) => Neutrals.effectivePieceSide(game, piece) === AXIS && isNorthAfricaSpace(data.spaces[location]))
	const alliesInEurope = pieces.some(({ piece, location }) => Neutrals.effectivePieceSide(game, piece) === ALLIED && isEuropeLocation(data, adjacency, location))
	return !axisInNorthAfrica && !alliesInEurope
}

function mandatedOffensivePossible(game, data, adjacency, result) {
	if (!MANDATED_OFFENSIVES.includes(result) || !data?.spaces || !data?.pieces || !adjacency) return true
	const attackingSide = result === "okw_mo" ? AXIS : ALLIED
	const defendingSide = attackingSide === AXIS ? ALLIED : AXIS
	for (const { piece, location } of mandatedOffensivePieces(game, data, result)) {
		for (const spaceId of connectedLandSpaces(game, data, adjacency, location)) {
			if (spaceId === location) continue
			const space = data.spaces[spaceId]
			if (result === "okw_mo" && space?.nation === "su") continue
			const canOccupy = game.control?.[spaceId] === defendingSide
			const canAttack = spaceHasSide(game, data, spaceId, defendingSide) && (result !== "soviet_mo" || piece.size === "lcu")
			if (canOccupy || canAttack) return true
		}
	}
	return false
}

function normalizeMandatedOffensive(game, data, adjacency, order) {
	if (!MANDATED_OFFENSIVES.includes(order.result)) return order
	const theaterVacuum = RULE_83_THEATER_MOS.has(order.result) && rule83TheaterVacuum(game, data, adjacency)
	if (!theaterVacuum && mandatedOffensivePossible(game, data, adjacency, order.result)) return order
	order.rolled_result = order.result
	order.result = "none"
	order.fulfilled = true
	order.ignored = true
	return order
}

function rollAxis(game, data = null, adjacency = null) {
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
	return normalizeMandatedOffensive(game, data, adjacency, game.orders.axis)
}

function rollAllied(game, data = null, adjacency = null) {
	const die = Random.random(game, 6) + 1
	const result = die <= 2 ? "allied_mo" : die === 3 ? "soviet_mo" : "stalin_orders"
	game.orders.allied = { die, result, fulfilled: result === "stalin_orders" }
	return normalizeMandatedOffensive(game, data, adjacency, game.orders.allied)
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
		const piece = data.pieces[pieceId]
		if (game.pieces[pieceId] === Number(spaceId) && ["scu", "lcu"].includes(piece?.size) && Neutrals.effectivePieceSide(game, piece) === side) units.push(pieceId)
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
		if (combat.attackers.some((pieceId) => ["br", "us"].includes(data.pieces[pieceId]?.nation))) game.orders.allied.fulfilled = true
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
		penalties.push(AXIS)
	}
	if (game.orders?.allied && !game.orders.allied.fulfilled) {
		game.vp++
		penalties.push(ALLIED)
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
