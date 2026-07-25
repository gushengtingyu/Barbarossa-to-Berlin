"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
const Locations = require("../core/unit_locations.js")
const { log, pieceLogRef } = require("../core/state.js")
const Combat = require("./combat.js")
const Orders = require("./orders.js")
const Reinforcements = require("./reinforcements.js")

const WESTERN_NATIONS = Object.freeze(new Set(["br", "cw", "us", "ff"]))
const NORTH_AFRICA_NATIONS = Object.freeze(new Set(["dz", "tn", "ly", "eg"]))
// 13.2 keeps Suez as the Western Allied supply source, while 14.2 names Cairo
// for Mediterranean losses. Treat both terminals as Med without adding Cairo
// to the core supply-source list.
const MEDITERRANEAN_SOURCES = Object.freeze(new Set(["Suez", "Cairo", "Alexandria", "Basra", "Naples"]))

function hasTrait(piece, trait) {
	return String(piece?.traits || "")
		.split(";")
		.includes(trait)
}

function isWesternAlliedLcu(piece) {
	return piece?.size === "lcu" && WESTERN_NATIONS.has(piece.nation)
}

function supplyStatus(game, data, map, adjacency, pieceId) {
	const piece = data.pieces[pieceId]
	const location = game.pieces[pieceId]
	if (!piece || !Number.isInteger(location) || location <= 0) return "off_map"
	return map.traceSupply(game, data, adjacency, map.pieceSide(game, data, pieceId), location, piece.nation)
}

function rpBucket(game, piece) {
	if (piece.nation === "tu") return "tu"
	if (piece.nation === "ge") return "ge"
	if (piece.side === AXIS) return "axis"
	if (["br", "cw"].includes(piece.nation)) return "br"
	if (["us", "ff"].includes(piece.nation)) return "usa"
	if (piece.nation === "su") return "su"
	return null
}

function replacementCost(piece) {
	return piece.size === "lcu" ? 1 : 0.5
}

function panzerReplacementLimit(game) {
	const eventTurn = Number(game.events?.totaler_krieg_turn) || 0
	return game.events?.totaler_krieg && eventTurn > 0 && game.turn > eventTurn ? 3 : 2
}

function panzerStepsUsed(game) {
	return game.replacement_usage?.turn === game.turn ? Number(game.replacement_usage.panzer_steps) || 0 : 0
}

function discardUnspentRp(game, side) {
	const buckets = side === AXIS ? ["ge", "axis"] : ["br", "usa", "su"]
	if (game.neutrals?.tu?.controller === side) buckets.push("tu")
	for (const bucket of buckets) game.rp[bucket] = 0
}

function replacementLocationRef(location, side) {
	if (Number.isInteger(location) && location > 0) return `s${location}`
	if (Locations.isReserve(location, side)) return side === ALLIED ? { "zh-CN": "盟军预备箱", en: "Allied Reserve Box" } : { "zh-CN": "轴心国预备箱", en: "Axis Reserve Box" }
	return String(location)
}

function replacementSide(side) {
	return side === ALLIED ? { "zh-CN": "盟军", en: "The Allies" } : { "zh-CN": "轴心国", en: "The Axis" }
}

function beachTheater(space) {
	const letter = space?.beach_letter
	if (!letter) return null
	return letter <= "I" ? "nwe" : "med"
}

function terminalTheater(data, terminal) {
	const space = data.spaces[terminal.space_id]
	if (!space) return null
	if (space.kind === "beach") return beachTheater(space)
	if (MEDITERRANEAN_SOURCES.has(space.name)) return "med"
	if (space.name === "Antwerp") return "nwe"
	return null
}

function theaterOptionsForElimination(game, data, map, adjacency, pieceId, originSpaceId) {
	const piece = data.pieces[pieceId]
	if (!isWesternAlliedLcu(piece)) return []
	const details = map.traceSupplyDetails(game, data, adjacency, ALLIED, originSpaceId, piece.nation)
	const options = [
		...new Set(
			details.terminals
				.filter((terminal) => terminal.status === "full" || terminal.status === "limited")
				.map((terminal) => terminalTheater(data, terminal))
				.filter(Boolean),
		),
	].sort()
	return options.length ? options : ["med", "nwe"]
}

function recordEliminatedTheater(game, pieceId, theater) {
	if (!["med", "nwe"].includes(theater)) throw new Error(`invalid eliminated theater: ${theater}`)
	game.eliminated_theater ||= {}
	game.eliminated_theater[pieceId] = theater
}

function clearEliminatedTheater(game, pieceId) {
	if (game.eliminated_theater) delete game.eliminated_theater[pieceId]
}

function classifyEliminatedLcu(game, data, map, adjacency, pieceId, originSpaceId) {
	const piece = data.pieces[pieceId]
	if (!isWesternAlliedLcu(piece)) return { classified: false, options: [] }
	const options = theaterOptionsForElimination(game, data, map, adjacency, pieceId, originSpaceId)
	if (options.length === 1) {
		recordEliminatedTheater(game, pieceId, options[0])
		return { classified: true, theater: options[0], options }
	}
	return { classified: false, options }
}

function unclassifiedWesternLcus(game, data) {
	const result = []
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		const piece = data.pieces[pieceId]
		if (!isWesternAlliedLcu(piece) || ["desert_army", "british_eighth_army", "us_seventh_army"].some((trait) => hasTrait(piece, trait)) || game.eliminated_theater?.[pieceId]) continue
		if (Locations.isEliminated(game.pieces[pieceId], ALLIED)) result.push(pieceId)
	}
	return result
}

function legalLcuReplacementSpaces(game, data, map, adjacency, pieceId) {
	const piece = data.pieces[pieceId]
	if (!piece || !Locations.isEliminated(game.pieces[pieceId], map.pieceSide(game, data, pieceId))) return []
	if (hasTrait(piece, "panzer_armee_afrika")) {
		return data.spaces
			.filter((space) => ["Tripoli", "Alexandria"].includes(space?.name))
			.filter((space) => game.control[space.id] === AXIS && map.canStack(game, data, pieceId, space.id))
			.filter((space) => map.traceSupply(game, data, adjacency, AXIS, space.id, piece.nation) !== "oos")
			.map((space) => space.id)
	}
	let spaces = Reinforcements.legalLcuPlacementSpaces(game, data, map, adjacency, pieceId)
	if (hasTrait(piece, "desert_army")) return spaces
	if (hasTrait(piece, "british_eighth_army") || hasTrait(piece, "us_seventh_army")) return []
	if (!isWesternAlliedLcu(piece)) return spaces
	const theater = game.eliminated_theater?.[pieceId]
	if (!theater) return []
	spaces = spaces.filter((spaceId) => {
		const space = data.spaces[spaceId]
		if (theater === "nwe") return beachTheater(space) === "nwe" || space?.name === "Antwerp"
		return beachTheater(space) === "med" || MEDITERRANEAN_SOURCES.has(space?.name)
	})
	return spaces
}

function canRebuildLcuInAlliedReserve(game, data, pieceId) {
	const piece = data.pieces[pieceId]
	if (!piece || !Locations.isEliminated(game.pieces[pieceId], ALLIED)) return false
	if (hasTrait(piece, "us_seventh_army")) return true
	if (!hasTrait(piece, "british_eighth_army")) return false
	return !data.spaces.some((space) => space?.kind === "land" && NORTH_AFRICA_NATIONS.has(space.nation) && game.control[space.id] === AXIS)
}

function replacementUsage(game) {
	if (game.replacement_usage?.turn !== game.turn) {
		game.replacement_usage = { turn: game.turn, panzer_steps: 0, wehrkreis_applied: false, wehrkreis_count: 0, wehrkreis_deducted: 0 }
	}
	return game.replacement_usage
}

function applyWehrkreisPenalty(game, data, map, adjacency) {
	const usage = replacementUsage(game)
	if (usage.wehrkreis_applied) return { count: usage.wehrkreis_count, deducted: usage.wehrkreis_deducted }
	const districts = new Map()
	for (const space of data.spaces.filter((candidate) => candidate?.wehrkreis)) {
		if (!districts.has(space.wehrkreis)) districts.set(space.wehrkreis, [])
		districts.get(space.wehrkreis).push(space)
	}
	const failedDistricts = [...districts.entries()].filter(([, spaces]) => spaces.some((space) => game.control[space.id] !== AXIS || map.traceSupply(game, data, adjacency, AXIS, space.id, "ge") !== "full"))
	const failed = failedDistricts.flatMap(([, spaces]) => spaces.map((space) => space.id))
	const count = failedDistricts.length
	const deducted = Math.min(Number(game.rp.ge) || 0, count)
	game.rp.ge = Math.max(0, (Number(game.rp.ge) || 0) - deducted)
	Object.assign(usage, { wehrkreis_applied: true, wehrkreis_count: count, wehrkreis_deducted: deducted, wehrkreis_spaces: failed, wehrkreis_districts: failedDistricts.map(([district]) => district) })
	if (count) log(game, "replacements.log.wehrkreis", { count, points: deducted })
	return { count, deducted, spaces: usage.wehrkreis_spaces.slice() }
}

function legalReplacementPieces(game, data, map, adjacency, side) {
	const result = []
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		const piece = data.pieces[pieceId]
		if (!piece || map.pieceSide(game, data, pieceId) !== side || piece.nation === "sw" || hasTrait(piece, "non_replaceable")) continue
		if (piece.nation === "ge" && piece.unit_type === "mechanized" && panzerStepsUsed(game) >= panzerReplacementLimit(game)) continue
		const bucket = rpBucket(game, piece)
		if (!bucket || game.rp[bucket] < replacementCost(piece)) continue
		const location = game.pieces[pieceId]
		if (game.reduced.includes(pieceId)) {
			if (Locations.isReserve(location) || supplyStatus(game, data, map, adjacency, pieceId) !== "oos") result.push(pieceId)
			continue
		}
		if (!Locations.isEliminated(location, side)) continue
		const surgeTurn = Number(game.events?.final_production_surge_turn) || 0
		if (piece.nation === "ge" && piece.unit_type === "mechanized" && game.events?.final_production_surge && surgeTurn > 0 && game.turn > surgeTurn) continue
		if (piece.size === "scu" || legalLcuReplacementSpaces(game, data, map, adjacency, pieceId).length || canRebuildLcuInAlliedReserve(game, data, pieceId)) result.push(pieceId)
	}
	return result
}

function charge(game, piece) {
	const bucket = rpBucket(game, piece)
	const cost = replacementCost(piece)
	game.rp[bucket] -= cost
	if (game.replacement_usage?.turn !== game.turn) replacementUsage(game)
	if (piece.nation === "ge" && piece.unit_type === "mechanized") game.replacement_usage.panzer_steps++
	return { bucket, cost }
}

function replaceStep(game, data, map, adjacency, side, pieceId) {
	if (!legalReplacementPieces(game, data, map, adjacency, side).includes(pieceId)) throw new Error(`piece ${pieceId} cannot receive a replacement`)
	const piece = data.pieces[pieceId]
	const location = game.pieces[pieceId]
	if (Locations.isEliminated(location, side) && piece.size === "lcu") return { placement_required: true, spaces: legalLcuReplacementSpaces(game, data, map, adjacency, pieceId) }
	if (Locations.isEliminated(location, side)) {
		game.pieces[pieceId] = Locations.reserve(side)
		Combat.setReduced(game, pieceId, true)
		clearEliminatedTheater(game, pieceId)
		log(game, "replacements.log.rebuild", { side: replacementSide(side), piece: pieceLogRef(game, pieceId), location: replacementLocationRef(game.pieces[pieceId], side) })
	} else {
		Combat.setReduced(game, pieceId, false)
		log(game, "replacements.log.restore", { side: replacementSide(side), piece: pieceLogRef(game, pieceId, true), location: replacementLocationRef(location, side) })
	}
	return { placement_required: false, piece_id: pieceId, ...charge(game, piece) }
}

function placeRebuiltLcu(game, data, map, adjacency, side, pieceId, spaceId) {
	if (!legalReplacementPieces(game, data, map, adjacency, side).includes(pieceId) || !legalLcuReplacementSpaces(game, data, map, adjacency, pieceId).includes(spaceId)) throw new Error(`LCU ${pieceId} cannot be rebuilt at ${spaceId}`)
	const piece = data.pieces[pieceId]
	game.pieces[pieceId] = spaceId
	Combat.setReduced(game, pieceId, true)
	clearEliminatedTheater(game, pieceId)
	log(game, "replacements.log.rebuild", { side: replacementSide(side), piece: pieceLogRef(game, pieceId), location: `s${spaceId}` })
	return { piece_id: pieceId, space_id: spaceId, ...charge(game, piece) }
}

function placeRebuiltLcuInAlliedReserve(game, data, map, adjacency, pieceId) {
	if (!legalReplacementPieces(game, data, map, adjacency, ALLIED).includes(pieceId) || !canRebuildLcuInAlliedReserve(game, data, pieceId)) throw new Error(`LCU ${pieceId} cannot be rebuilt in Allied Reserve`)
	const piece = data.pieces[pieceId]
	game.pieces[pieceId] = Locations.reserve(ALLIED)
	Combat.setReduced(game, pieceId, true)
	clearEliminatedTheater(game, pieceId)
	log(game, "replacements.log.rebuild", {
		side: { "zh-CN": "盟军", en: "The Allies" },
		piece: pieceLogRef(game, pieceId),
		location: { "zh-CN": "盟军预备箱", en: "Allied Reserve Box" },
	})
	return { piece_id: pieceId, ...charge(game, piece) }
}

function voluntaryEliminationCandidates(game, data, map, adjacency) {
	const result = []
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		const piece = data.pieces[pieceId]
		const location = game.pieces[pieceId]
		if (!isWesternAlliedLcu(piece) || !Number.isInteger(location) || location <= 0) continue
		if (map.pieceSide(game, data, pieceId) === ALLIED && map.traceSupply(game, data, adjacency, ALLIED, location, piece.nation) === "full") result.push(pieceId)
	}
	return result
}

function voluntarilyEliminate(game, data, map, adjacency, pieceId) {
	if (!voluntaryEliminationCandidates(game, data, map, adjacency).includes(pieceId)) throw new Error(`piece ${pieceId} cannot be voluntarily eliminated`)
	const location = game.pieces[pieceId]
	Orders.ensureStandFastUnits(game, data, location)
	Combat.setReduced(game, pieceId, false)
	game.pieces[pieceId] = Locations.turnTrack(game.turn + 3)
	clearEliminatedTheater(game, pieceId)
	Orders.releaseStandFastIfVacated(game, data, location)
	log(game, "replacements.log.voluntary_elimination", { piece: pieceLogRef(game, pieceId), turn: game.turn + 3 })
	return { piece_id: pieceId, release_turn: game.turn + 3 }
}

module.exports = Object.freeze({
	applyWehrkreisPenalty,
	canRebuildLcuInAlliedReserve,
	classifyEliminatedLcu,
	clearEliminatedTheater,
	discardUnspentRp,
	isWesternAlliedLcu,
	legalLcuReplacementSpaces,
	legalReplacementPieces,
	panzerReplacementLimit,
	panzerStepsUsed,
	placeRebuiltLcu,
	placeRebuiltLcuInAlliedReserve,
	recordEliminatedTheater,
	replacementCost,
	replaceStep,
	rpBucket,
	supplyStatus,
	theaterOptionsForElimination,
	unclassifiedWesternLcus,
	voluntarilyEliminate,
	voluntaryEliminationCandidates,
})
