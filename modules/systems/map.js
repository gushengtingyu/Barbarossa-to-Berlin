"use strict"

const { ALLIED, AXIS, otherSide } = require("../core/constants.js")
const Locations = require("../core/unit_locations.js")
const Random = require("../core/random.js")
const { log } = require("../core/state.js")
const Invasions = require("./invasions.js")
const Neutrals = require("./neutrals.js")
const Restrictions = require("./restrictions.js")
const Weather = require("./weather.js")
const Orders = require("./orders.js")
const Stalin = require("./stalin.js")

const SOVIET_TRENCH_LIMIT = 5
const adjacencyCache = new WeakMap()
const supplyDataCache = new WeakMap()

function buildAdjacency(data) {
	if (!data || typeof data !== "object") throw new Error("map data must be an object")
	const cached = adjacencyCache.get(data)
	if (cached) return cached
	const adjacency = Array.from({ length: data.spaces.length }, () => [])
	for (const edge of data.edges) {
		adjacency[edge.a] ||= []
		adjacency[edge.b] ||= []
		adjacency[edge.a].push(Object.freeze({ to: edge.b, type: edge.type }))
		adjacency[edge.b].push(Object.freeze({ to: edge.a, type: edge.type }))
	}
	for (const edges of adjacency) Object.freeze(edges)
	Object.freeze(adjacency)
	adjacencyCache.set(data, adjacency)
	return adjacency
}

function supplyData(data) {
	const cached = supplyDataCache.get(data)
	if (cached) return cached
	const index = {
		axisSources: [],
		alliedSources: [],
		malta: 0,
		munich: 0,
		axisSeaGateways: new Set(),
	}
	for (const space of data.spaces) {
		if (!space) continue
		if (["axis", "axis_limited"].includes(space.supply)) index.axisSources.push(space.id)
		if (["allied", "allied_scheldt"].includes(space.supply)) index.alliedSources.push(space)
		if (space.name === "Malta") index.malta = space.id
		if (space.name === "Munich") index.munich = space.id
		if (["Tripoli", "Tunis"].includes(space.name)) index.axisSeaGateways.add(space.id)
	}
	Object.freeze(index.axisSources)
	Object.freeze(index.alliedSources)
	Object.freeze(index.axisSeaGateways)
	Object.freeze(index)
	supplyDataCache.set(data, index)
	return index
}

function piecesInSpace(game, spaceId) {
	const result = []
	for (let pieceId = 1; pieceId < game.pieces.length; pieceId++) if (game.pieces[pieceId] === spaceId) result.push(pieceId)
	return result
}

function pieceSide(game, data, pieceId) {
	return Neutrals.effectivePieceSide(game, data.pieces[pieceId])
}

function friendlyPiecesInSpace(game, data, side, spaceId) {
	return piecesInSpace(game, spaceId).filter((pieceId) => pieceSide(game, data, pieceId) === side)
}

function enemyPiecesInSpace(game, data, side, spaceId) {
	return piecesInSpace(game, spaceId).filter((pieceId) => {
		const effectiveSide = pieceSide(game, data, pieceId)
		return effectiveSide && effectiveSide !== "neutral" && effectiveSide !== side
	})
}

function controlledBy(game, spaceId, side) {
	return game.control[spaceId] === side
}

function inferredControlNation(game, data, spaceId) {
	const space = data.spaces[spaceId]
	if (!space || space.kind !== "land") return null
	const side = game.control?.[spaceId]
	const occupier = piecesInSpace(game, spaceId)
		.map((pieceId) => data.pieces[pieceId])
		.find((piece) => piece && Neutrals.effectivePieceSide(game, piece) === side)
	if (occupier) return occupier.nation
	if (side === space.side) return space.nation || null
	if (side === ALLIED && space.nation === "ro") return "su"
	return null
}

function controlNation(game, data, spaceId) {
	return game.control_nation?.[spaceId] || inferredControlNation(game, data, spaceId)
}

function normalizeControlNations(game, data) {
	game.control_nation ||= []
	game.control_nation[0] ??= null
	for (let spaceId = 1; spaceId < data.spaces.length; spaceId++) {
		if (game.control_nation[spaceId]) continue
		game.control_nation[spaceId] = inferredControlNation(game, data, spaceId)
	}
	return game.control_nation
}

function originalFortOwner(data, spaceId) {
	return data.spaces[spaceId]?.side || null
}

function isFortIntactForSide(game, data, spaceId, side) {
	return !!data.spaces[spaceId]?.fort && originalFortOwner(data, spaceId) === side && !game.destroyed_forts?.includes(spaceId)
}

function removeTrench(game, spaceId) {
	if (!game.trench?.[spaceId]) return false
	delete game.trench[spaceId]
	if (game.trench_owner) delete game.trench_owner[spaceId]
	if (game.trench_kind) delete game.trench_kind[spaceId]
	return true
}

function isVichyVpSpace(space) {
	return space?.side === "neutral" && space?.vp && ["fr", "tn"].includes(space.nation)
}

function partisanVpAdjustment(game, data) {
	let adjustment = 0
	for (const spaceId of new Set(game.partisans || [])) {
		const space = data.spaces[spaceId]
		if (!space?.vp || game.control?.[spaceId] !== AXIS) continue
		if (friendlyPiecesInSpace(game, data, AXIS, spaceId).length) continue
		adjustment -= Number(space.vp) || 0
	}
	return adjustment
}

function syncPartisanVp(game, data) {
	const previous = Number(game.partisan_vp_adjustment) || 0
	const next = partisanVpAdjustment(game, data)
	const delta = next - previous
	if (delta) game.vp += delta
	game.partisan_vp_adjustment = next
	return delta
}

function effectiveControl(game, spaceId, control = game.control?.[spaceId], space = null) {
	const neutralAtWar = space?.nation && game.neutrals?.[space.nation]?.at_war
	if (control === "neutral" && game.events?.casablanca && !neutralAtWar) return ALLIED
	return control
}

function adjustVpForControl(game, space, previousControl, side, writeLog = true) {
	const value = Number(space?.vp) || 0
	if (!value || previousControl === side || (isVichyVpSpace(space) && !game.events?.casablanca)) return 0
	const previousEffective = effectiveControl(game, space.id, previousControl, space)
	const nextEffective = effectiveControl(game, space.id, side, space)
	if (previousEffective === nextEffective) return 0
	let change = 0
	if (previousEffective === AXIS && nextEffective !== AXIS) change = -value
	else if (previousEffective !== AXIS && nextEffective === AXIS) change = value
	if (!change) return 0
	game.vp += change
	if (writeLog) log(game, "map.log.control_vp", { space: `s${space.id}`, delta: `${change > 0 ? "+" : ""}${change}`, vp: game.vp })
	return change
}

function removePartisanAfterControlLoss(game, spaceId, side) {
	if (side === AXIS || !game.partisans?.includes(spaceId)) return false
	game.partisans = game.partisans.filter((candidate) => candidate !== spaceId)
	return true
}

function setControl(game, data, spaceId, side, nation = null) {
	syncPartisanVp(game, data)
	const space = data.spaces[spaceId]
	if (!space || space.kind !== "land" || !side) return false
	const previousControl = game.control[spaceId]
	const changed = previousControl !== side
	if (!changed) {
		if (removePartisanAfterControlLoss(game, spaceId, side)) {
			syncPartisanVp(game, data)
			log(game, "event.log.partisan_remove", { space: `s${spaceId}` })
		}
		return false
	}
	game.control[spaceId] = side
	game.control_nation ||= []
	game.control_nation[spaceId] = nation || inferredControlNation(game, data, spaceId)
	const controlVpChange = adjustVpForControl(game, space, previousControl, side, false)
	if (game.trench?.[spaceId] && game.trench_owner?.[spaceId] !== side) removeTrench(game, spaceId)
	if (space.fort && originalFortOwner(data, spaceId) && originalFortOwner(data, spaceId) !== side) {
		game.destroyed_forts ||= []
		if (!game.destroyed_forts.includes(spaceId)) game.destroyed_forts.push(spaceId)
	}
	if (side === ALLIED && space.name === "Benghazi") {
		const tobruk = data.spaces.find((candidate) => candidate?.name === "Tobruk")
		if (tobruk) removeTrench(game, tobruk.id)
	}
	const removedPartisan = removePartisanAfterControlLoss(game, spaceId, side)
	const partisanVpChange = syncPartisanVp(game, data)
	if (removedPartisan) log(game, "event.log.partisan_remove", { space: `s${spaceId}` })
	const vpChange = controlVpChange + partisanVpChange
	if (vpChange) log(game, "map.log.control_vp", { space: `s${space.id}`, delta: `${vpChange > 0 ? "+" : ""}${vpChange}`, vp: game.vp })
	return changed
}

function enterSpace(game, data, pieceId, destination) {
	syncPartisanVp(game, data)
	const piece = data.pieces[pieceId]
	if (!piece) throw new Error(`unknown piece ${pieceId}`)
	game.pieces[pieceId] = destination
	const side = pieceSide(game, data, pieceId)
	if (side === AXIS && data.spaces[destination]?.name === "Moscow") {
		game.events ||= {}
		game.events.axis_occupied_moscow = true
	}
	if (side === AXIS) Stalin.captureAt(game, destination)
	if (data.spaces[destination]?.kind === "land" && side !== "neutral") {
		const previousControl = game.control[destination]
		if (setControl(game, data, destination, side, piece.nation)) Orders.fulfillForOccupation(game, data, pieceId, destination, previousControl)
	}
	syncPartisanVp(game, data)
}

function activationGroup(nation) {
	if (["br", "cw"].includes(nation)) return "br_cw"
	if (["us", "ff"].includes(nation)) return "us_ff"
	return nation
}

function hasTrait(piece, trait) {
	return String(piece?.traits || "")
		.split(";")
		.includes(trait)
}

function axisLcuUsesCaucasusSupply(game, data, adjacency, pieceId) {
	const piece = data.pieces[pieceId]
	const start = game.pieces[pieceId]
	if (!piece || pieceSide(game, data, pieceId) !== AXIS || piece.size !== "lcu" || !Number.isInteger(start) || start <= 0) return false
	const gateways = new Set(data.spaces.filter((space) => ["Maikop", "Armavir", "SeaSR Baku", "SeaSR Batumi"].includes(space?.name)).map((space) => space.id))
	if (!gateways.size) return false
	const sources = new Set(supplySources(game, data, AXIS, piece.nation))
	const queue = [{ spaceId: start, usesGateway: gateways.has(start) }]
	const visited = new Set([`${start}:${gateways.has(start)}`])
	let suppliedThroughGateway = false
	for (let cursor = 0; cursor < queue.length; cursor++) {
		const current = queue[cursor]
		if (sources.has(current.spaceId)) {
			if (!current.usesGateway) return false
			suppliedThroughGateway = true
			continue
		}
		for (const edge of adjacency[current.spaceId] || []) {
			const next = data.spaces[edge.to]
			if (!next || (next.kind !== "sr" && !controlledBy(game, edge.to, AXIS))) continue
			const usesGateway = current.usesGateway || gateways.has(edge.to)
			const key = `${edge.to}:${usesGateway}`
			if (visited.has(key)) continue
			visited.add(key)
			queue.push({ spaceId: edge.to, usesGateway })
		}
	}
	return suppliedThroughGateway
}

function activationCost(game, data, side, spaceId, adjacency = null) {
	const pieceIds = friendlyPiecesInSpace(game, data, side, spaceId)
	if (!pieceIds.length) return 0
	let cost
	if (adjacency) {
		const statusByNation = new Map()
		const statuses = new Map(
			pieceIds.map((pieceId) => {
				const piece = data.pieces[pieceId]
				if (!statusByNation.has(piece.nation)) statusByNation.set(piece.nation, traceSupply(game, data, adjacency, side, spaceId, piece.nation))
				return [pieceId, statusByNation.get(piece.nation)]
			}),
		)
		const normallySupplied = pieceIds.filter((pieceId) => statuses.get(pieceId) === "full")
		const individuallyCharged = pieceIds.length - normallySupplied.length
		const groups = data.spaces[spaceId]?.kind === "beach" ? new Set(normallySupplied.length ? ["beachhead"] : []) : new Set(normallySupplied.map((pieceId) => activationGroup(data.pieces[pieceId].nation)))
		cost = groups.size + individuallyCharged
		for (const pieceId of pieceIds) {
			const piece = data.pieces[pieceId]
			if (hasTrait(piece, "panzer_armee_afrika") && data.spaces[spaceId]?.nation !== "ly" && statuses.get(pieceId) !== "full") cost++
			if (side === AXIS && statuses.get(pieceId) !== "oos" && axisLcuUsesCaucasusSupply(game, data, adjacency, pieceId)) cost++
		}
	}
	if (cost === null || cost === undefined) {
		const groups = data.spaces[spaceId]?.kind === "beach" ? new Set(["beachhead"]) : new Set(pieceIds.map((pieceId) => activationGroup(data.pieces[pieceId].nation)))
		cost = groups.size
	}
	return Math.min(5, Math.max(1, cost))
}

function activationSupplyStatus(game, data, adjacency, pieceId) {
	const recorded = game.action?.activation_supply?.[pieceId]
	if (recorded) return recorded
	return pieceSupplyStatus(game, data, adjacency, pieceId)
}

function recordActivationSupply(game, data, adjacency, side, spaceId) {
	game.action ||= {}
	game.action.activation_supply ||= {}
	const statusByNation = new Map()
	for (const pieceId of friendlyPiecesInSpace(game, data, side, spaceId)) {
		const piece = data.pieces[pieceId]
		if (!statusByNation.has(piece.nation)) statusByNation.set(piece.nation, traceSupply(game, data, adjacency, side, spaceId, piece.nation))
		game.action.activation_supply[pieceId] = statusByNation.get(piece.nation)
	}
	return game.action.activation_supply
}

function legalActivationSpaces(game, data, side) {
	const result = []
	const blocked = new Set(game.event?.blocked_activation_spaces || [])
	for (let spaceId = 1; spaceId < data.spaces.length; spaceId++) if (!blocked.has(spaceId) && friendlyPiecesInSpace(game, data, side, spaceId).length) result.push(spaceId)
	return result
}

function canStackFormation(game, data, pieceIds, destination) {
	const movingIds = [...new Set(pieceIds)].filter((pieceId) => data.pieces[pieceId])
	const moving = new Set(movingIds)
	const occupants = piecesInSpace(game, destination).filter((pieceId) => !moving.has(pieceId))
	return isLegalStack(data, occupants.concat(movingIds))
}

function isLegalStack(data, pieceIds) {
	if (pieceIds.length > 3) return false
	const pieces = pieceIds.map((pieceId) => data.pieces[pieceId]).filter(Boolean)
	if (pieces.some((piece) => piece.nation === "yu") && pieces.length > 1) return false
	if (pieces.some((piece) => piece.nation === "su") && pieces.some((piece) => piece.nation !== "su")) return false
	if (pieces.some((piece) => piece.nation === "hu") && pieces.some((piece) => piece.nation === "ro")) return false
	return true
}

function canStackAfterFormationLeaves(game, data, stoppingIds, leavingIds, destination) {
	const formation = new Set([...stoppingIds, ...leavingIds])
	const occupants = piecesInSpace(game, destination).filter((pieceId) => !formation.has(pieceId))
	return isLegalStack(data, occupants.concat(stoppingIds))
}

function canStack(game, data, pieceId, destination) {
	return canStackFormation(game, data, [pieceId], destination)
}

function isMechanizedInSupply(game, data, adjacency, pieceId, destination = game.pieces[pieceId]) {
	const piece = data.pieces[pieceId]
	const allowance = Number(game.reduced.includes(pieceId) ? piece?.rmf : piece?.mf) || 0
	const winter42German = Weather.isWinter42(game) && piece?.nation === "ge" && data.spaces[destination]?.nation === "su"
	return allowance >= 4 && activationSupplyStatus(game, data, adjacency, pieceId) !== "oos" && !winter42German
}

function mayEndMovement(game, data, adjacency, pieceId, destination) {
	const piece = data.pieces[pieceId]
	if (piece?.nation === "su" && game.events?.tito && data.spaces[destination]?.nation === "yu") return false
	if (!game.action?.attack_spaces?.includes(destination)) return true
	return isMechanizedInSupply(game, data, adjacency, pieceId, destination)
}

function sovietTrenchCount(game, data) {
	return Object.keys(game.trench || {})
		.map(Number)
		.filter((spaceId) => {
			if (game.trench_owner?.[spaceId] !== ALLIED) return false
			if (game.trench_kind?.[spaceId]) return game.trench_kind[spaceId] === "soviet"
			return data.spaces[spaceId]?.name !== "Tobruk"
		}).length
}

function canEntrenchAtActivation(game, data, adjacency, pieceId, activationSpaceId = null) {
	const piece = data.pieces[pieceId]
	const spaceId = game.pieces[pieceId]
	const space = data.spaces[spaceId]
	if (!piece || piece.nation !== "su" || piece.size !== "lcu" || !space) return false
	const activated = game.action?.move_spaces?.includes(spaceId) || activationSpaceId === spaceId
	if (game.turn <= 2 || game.action?.moved?.includes(pieceId) || !activated) return false
	if (activationSupplyStatus(game, data, adjacency, pieceId) === "oos") return false
	if (game.action?.entrenching?.some((attempt) => attempt.space_id === spaceId)) return false
	const level = Number(game.trench?.[spaceId]) || 0
	if (level >= 2 || (level === 1 && game.turn < 8)) return false
	if (game.turn <= 7 && (space.nation !== "su" || !space.urban)) return false
	return level > 0 || sovietTrenchCount(game, data) < SOVIET_TRENCH_LIMIT
}

function canEntrench(game, data, adjacency, pieceId) {
	return canEntrenchAtActivation(game, data, adjacency, pieceId)
}

function canEntrenchAfterActivation(game, data, adjacency, pieceId, spaceId) {
	return game.pieces[pieceId] === spaceId && canEntrenchAtActivation(game, data, adjacency, pieceId, spaceId)
}

function legalEntrenchingPieces(game, data, adjacency) {
	if (!game.action) return []
	return game.action.move_spaces.flatMap((spaceId) => friendlyPiecesInSpace(game, data, ALLIED, spaceId)).filter((pieceId, index, list) => list.indexOf(pieceId) === index && canEntrench(game, data, adjacency, pieceId))
}

function resolveEntrenchAttempt(game, data, attempt) {
	const spaceId = attempt.space_id
	const raw = Random.random(game, 6) + 1
	const stalinInMoscow = data.spaces[spaceId]?.name === "Moscow" && game.stalin_location === spaceId
	const modified = raw - (stalinInMoscow ? 1 : 0)
	let success = modified <= 3
	const level = Number(game.trench?.[spaceId]) || 0
	if (level === 0 && sovietTrenchCount(game, data) >= SOVIET_TRENCH_LIMIT) success = false
	if (level === 1 && game.turn < 8) success = false
	if (success) {
		game.trench[spaceId] = Math.min(2, level + 1)
		game.trench_owner[spaceId] = ALLIED
		game.trench_kind ||= {}
		game.trench_kind[spaceId] = "soviet"
	}
	return {
		space_id: spaceId,
		piece_id: attempt.piece_id,
		raw,
		modified,
		success,
		level: Number(game.trench?.[spaceId]) || level,
	}
}

function movementAllowance(game, data, adjacency, pieceId) {
	const piece = data.pieces[pieceId]
	let value = Number(game.reduced.includes(pieceId) ? piece?.rmf : piece?.mf) || 0
	if (activationSupplyStatus(game, data, adjacency, pieceId) === "oos" && value >= 3) value = 2
	if (game.options.time_of_mud && game.turn === 3 && [2, 3].includes(game.action_round) && piece.nation === "ge" && piece.unit_type === "mechanized" && data.spaces[game.pieces[pieceId]]?.nation === "su") value = Math.min(value, 3)
	return value
}

function legalMovePaths(game, data, adjacency, pieceId) {
	const piece = data.pieces[pieceId]
	const side = pieceSide(game, data, pieceId)
	const from = game.pieces[pieceId]
	if (!piece || !side || side === "neutral" || !Number.isInteger(from) || from <= 0) return new Map()
	const allowance = movementAllowance(game, data, adjacency, pieceId)
	const paths = new Map()
	const queue = [{ space: from, path: [], spent: 0 }]
	const visited = new Map([[from, 0]])
	for (let cursor = 0; cursor < queue.length; ++cursor) {
		const current = queue[cursor]
		for (const edge of adjacency[current.space] || []) {
			if (edge.type === "sr" || data.spaces[edge.to]?.kind !== "land") continue
			const spent = current.spent + 1
			if (spent > allowance || enemyPiecesInSpace(game, data, side, edge.to).length) continue
			if (!Restrictions.mayEnter(game, data, adjacency, pieceId, edge.to)) continue
			const path = current.path.concat(edge.to)
			if (edge.to !== from && !paths.has(edge.to) && canStack(game, data, pieceId, edge.to) && mayEndMovement(game, data, adjacency, pieceId, edge.to)) paths.set(edge.to, path)
			if (visited.has(edge.to) && visited.get(edge.to) <= spent) continue
			visited.set(edge.to, spent)
			queue.push({ space: edge.to, path, spent })
		}
	}
	return paths
}

function legalMoveDestinations(game, data, adjacency, pieceId) {
	return [...legalMovePaths(game, data, adjacency, pieceId).keys()]
}

function canEndFormationMovement(game, data, adjacency, stoppingIds, destination, leavingIds = []) {
	const pieces = [...new Set(stoppingIds)].filter((pieceId) => data.pieces[pieceId])
	if (!pieces.length || pieces.some((pieceId) => game.pieces[pieceId] !== destination)) return false
	if (pieces.some((pieceId) => !mayEndMovement(game, data, adjacency, pieceId, destination))) return false
	return canStackAfterFormationLeaves(game, data, pieces, leavingIds, destination)
}

function legalMoveFormationSteps(game, data, adjacency, pieceIds, path = []) {
	const pieces = [...new Set(pieceIds)].filter((pieceId) => data.pieces[pieceId])
	if (!pieces.length) return []
	const current = game.pieces[pieces[0]]
	if (!Number.isInteger(current) || current <= 0 || pieces.some((pieceId) => game.pieces[pieceId] !== current)) return []
	const side = pieceSide(game, data, pieces[0])
	if (!side || side === "neutral" || pieces.some((pieceId) => pieceSide(game, data, pieceId) !== side)) return []
	const route = path.length ? path : [current]
	if (route[route.length - 1] !== current) return []
	const spent = route.length - 1
	const result = []
	for (const edge of adjacency[current] || []) {
		if (edge.type === "sr" || data.spaces[edge.to]?.kind !== "land") continue
		if (enemyPiecesInSpace(game, data, side, edge.to).length) continue
		if (pieces.some((pieceId) => movementAllowance(game, data, adjacency, pieceId) <= spent || !Restrictions.mayEnter(game, data, adjacency, pieceId, edge.to))) continue
		const exhausted = pieces.filter((pieceId) => movementAllowance(game, data, adjacency, pieceId) === spent + 1)
		const continuing = pieces.filter((pieceId) => !exhausted.includes(pieceId))
		if (exhausted.length && !canEndFormationMovementAt(game, data, adjacency, exhausted, edge.to, continuing)) continue
		result.push(edge.to)
	}
	return result
}

function canEndFormationMovementAt(game, data, adjacency, stoppingIds, destination, leavingIds = []) {
	if (stoppingIds.some((pieceId) => !mayEndMovement(game, data, adjacency, pieceId, destination))) return false
	return canStackAfterFormationLeaves(game, data, stoppingIds, leavingIds, destination)
}

function moveFormationStep(game, data, adjacency, pieceIds, path, destination) {
	const pieces = [...new Set(pieceIds)]
	if (!legalMoveFormationSteps(game, data, adjacency, pieces, path).includes(destination)) throw new Error("illegal formation movement step")
	const origin = path[0]
	if (path.length === 1) for (const pieceId of pieces) applyStandFastExit(game, data, data.pieces[pieceId], origin, destination)
	for (const pieceId of pieces) enterSpace(game, data, pieceId, destination)
	if (path.length === 1) Orders.releaseStandFastIfVacated(game, data, origin)
}

function applyStandFastExit(game, data, piece, origin, firstDestination) {
	const marker = game.stand_fast?.[origin]
	if (!marker || !piece || firstDestination === undefined) return false
	const side = Neutrals.effectivePieceSide(game, piece)
	if ((marker === "stalin" && side !== ALLIED) || (marker === "hitler" && side !== AXIS)) return false
	Orders.ensureStandFastUnits(game, data, origin)
	const entersEnemyControl = game.control[firstDestination] === otherSide(side)
	if (entersEnemyControl) return true
	if (marker === "stalin") game.vp += 1
	else {
		// Rule 8.3: Bomb Plot replaces the per-space payment with one VP for
		// every German unit that remains subject to and beneath this marker.
		const cost = game.events?.bomb_plot ? (game.stand_fast_round_units?.[origin] || []).filter((pieceId) => game.pieces[pieceId] === Number(origin) && data.pieces[pieceId]?.nation === "ge").length : 1
		game.vp -= cost
	}
	Orders.removeStandFast(game, origin)
	return true
}

function movePieceAlongPath(game, data, pieceId, path, options = {}) {
	const piece = data.pieces[pieceId]
	if (!piece) throw new Error(`unknown piece ${pieceId}`)
	if (!Array.isArray(path) || !path.length) throw new Error(`invalid movement path for piece ${pieceId}`)
	const origin = game.pieces[pieceId]
	if (options.freeStandFastExit) Orders.ensureStandFastUnits(game, data, origin)
	else applyStandFastExit(game, data, piece, origin, path[0])
	for (const destination of path) enterSpace(game, data, pieceId, destination)
	Orders.releaseStandFastIfVacated(game, data, origin)
}

function isReserveLocation(location, side = null) {
	return Locations.isReserve(location, side)
}

function reserveEntrySpace(game, data, piece, space) {
	const name = space.name
	if (space.kind === "beach") return Invasions.usableBeachhead(game, space.id, piece.nation)
	if (["br", "cw"].includes(piece.nation)) return space.nation !== "su" && ["allied", "allied_scheldt"].includes(space.supply) && (name !== "Antwerp" || game.events.clearing_the_scheldt)
	if (["us", "ff"].includes(piece.nation)) return name === "Naples" || (name === "Antwerp" && game.events.clearing_the_scheldt)
	if (piece.nation === "su") return space.nation === "su" && (space.urban || space.supply === "allied" || name === "Moscow")
	if (piece.nation === "ge") return !!space.wehrkreis || (space.nation === "ge" && (space.urban || space.supply === "axis" || name === "Berlin"))
	if (piece.nation === "it") return space.nation === "it" && (space.urban || name === "Rome")
	const capitals = {
		hu: "Budapest",
		ro: "Bucharest",
		bu: "Sofia",
		tu: "Ankara",
		sw: "Stockholm",
		yu: "Belgrade",
	}
	return capitals[piece.nation] === name
}

function limitedGermanWehrkreisEntry(piece, space) {
	return piece?.nation === "ge" && piece.size === "scu" && !!space?.wehrkreis && !space.urban && !space.supply
}

function reserveEntryAvailable(game, piece, space) {
	if (!limitedGermanWehrkreisEntry(piece, space)) return true
	return !game.action?.sr_reserve_entries?.[space.id]
}

function recordSrReserveEntry(game, data, pieceId, origin, destination) {
	const piece = data.pieces[pieceId]
	const space = data.spaces[destination]
	if (!isReserveLocation(origin, pieceSide(game, data, pieceId)) || !limitedGermanWehrkreisEntry(piece, space)) return false
	game.action.sr_reserve_entries ||= {}
	game.action.sr_reserve_entries[destination] = (game.action.sr_reserve_entries[destination] || 0) + 1
	return true
}

function legalReserveEntrySpaces(game, data, adjacency, pieceId) {
	const piece = data.pieces[pieceId]
	const side = pieceSide(game, data, pieceId)
	if (!piece || piece.size !== "scu" || !isReserveLocation(game.pieces[pieceId], side)) return []
	const result = []
	for (let spaceId = 1; spaceId < data.spaces.length; spaceId++) {
		const space = data.spaces[spaceId]
		const neutralHome = ["tu", "sw"].includes(piece.nation) && space?.nation === piece.nation && Neutrals.controller(game, piece.nation) === side
		const activeBeach = space?.kind === "beach" && Invasions.usableBeachhead(game, spaceId, piece.nation)
		if (!space || (!activeBeach && space.kind !== "land") || (!neutralHome && game.control[spaceId] !== side) || !reserveEntrySpace(game, data, piece, space) || !reserveEntryAvailable(game, piece, space)) continue
		if (!canStack(game, data, pieceId, spaceId)) continue
		if (traceSupply(game, data, adjacency, side, spaceId, piece.nation) === "full") result.push(spaceId)
	}
	return result
}

function axisPanzerScusInNorthAfrica(game, data) {
	const nations = new Set(["dz", "tn", "ly", "eg"])
	let count = 0
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		const piece = data.pieces[pieceId]
		const location = game.pieces[pieceId]
		if (piece?.nation === "ge" && piece.size === "scu" && piece.unit_type === "mechanized" && Number.isInteger(location) && nations.has(data.spaces[location]?.nation)) count++
	}
	return count
}

function axisVichySrAccess(game, space, side) {
	if (side !== AXIS || !game.events?.vichy_war || !Neutrals.isVichySpace(space)) return null
	if (space.name === "Marseille" || space.name === "Tunis") return "destination"
	if (space.nation === "fr") return "transit"
	return null
}

function createSrSearchContext(game, data, adjacency) {
	const supply = new Map()
	const partisans = new Set(game.partisans || [])
	const moscow = data.spaces.find((space) => space?.name === "Moscow")?.id
	let northAfricaPanzerScus = null
	return Object.freeze({
		moscow,
		partisans,
		supplyStatus(side, spaceId, nation) {
			const key = `${side}:${nation || ""}:${spaceId}`
			if (!supply.has(key)) supply.set(key, traceSupply(game, data, adjacency, side, spaceId, nation))
			return supply.get(key)
		},
		axisPanzerScusInNorthAfrica() {
			if (northAfricaPanzerScus === null) northAfricaPanzerScus = axisPanzerScusInNorthAfrica(game, data)
			return northAfricaPanzerScus
		},
	})
}

function searchSrPaths(game, data, adjacency, pieceId, context, stopAfterFirst) {
	const piece = data.pieces[pieceId]
	const from = game.pieces[pieceId]
	if (!piece) return new Map()
	const side = pieceSide(game, data, pieceId)
	if (!["allied", "axis"].includes(side)) return new Map()
	if (side === AXIS && game.events?.operation_strangle && Number.isInteger(from) && data.spaces[from]?.nation === "fr") return new Map()
	if (isReserveLocation(from, side)) {
		const entries = legalReserveEntrySpaces(game, data, adjacency, pieceId)
		return new Map((stopAfterFirst ? entries.slice(0, 1) : entries).map((spaceId) => [spaceId, [spaceId]]))
	}
	if (!Number.isInteger(from) || from <= 0) return new Map()
	context ||= createSrSearchContext(game, data, adjacency)
	const originSupply = context.supplyStatus(side, from, piece.nation)
	if (originSupply === "oos") return new Map()
	if (side === AXIS && game.turn <= 4 && data.spaces[from]?.nation === "su") return new Map()
	if (piece.nation === "su" && piece.size === "lcu" && game.control[context.moscow] === AXIS) return new Map()
	if (stopAfterFirst && piece.size === "scu" && originSupply === "full") {
		const reserve = Locations.reserve(side)
		return new Map([[reserve, [reserve]]])
	}
	const paths = new Map()
	const queue = [{ space: from, path: [], usedSea: false, inSea: false }]
	const visited = new Set([`${from}:false:false`])
	for (let cursor = 0; cursor < queue.length; ++cursor) {
		const current = queue[cursor]
		for (const edge of adjacency[current.space] || []) {
			const next = data.spaces[edge.to]
			if (!next) continue
			if (side === AXIS && game.events?.operation_strangle && (data.spaces[current.space]?.nation === "fr" || next.nation === "fr")) continue
			if (side === AXIS && game.turn <= 4 && (data.spaces[current.space]?.nation === "su" || next.nation === "su")) continue
			if (data.spaces[current.space]?.kind === "land" && next.kind === "land" && (data.spaces[current.space]?.nation === "tu" || next.nation === "tu")) continue
			if (side === AXIS && (context.partisans.has(current.space) || context.partisans.has(edge.to))) continue
			const directSea = edge.type === "sr" && data.spaces[current.space]?.kind === "land" && next.kind === "land"
			const enteringSea = next.kind === "sr"
			const leavingSea = current.inSea && next.kind === "land"
			if ((enteringSea || current.inSea || directSea) && piece.size === "lcu") continue
			if (current.usedSea && (enteringSea || directSea)) continue
			const neutralHome = ["tu", "sw"].includes(piece.nation) && next.nation === piece.nation && Neutrals.controller(game, piece.nation) === side
			const vichyAccess = axisVichySrAccess(game, next, side)
			if (next.kind === "land" && !neutralHome && !vichyAccess && game.control[edge.to] !== side) continue
			if (next.kind === "land" && !Restrictions.mayEnter(game, data, adjacency, pieceId, edge.to)) continue
			if (leavingSea && !canStack(game, data, pieceId, edge.to)) continue
			const path = current.path.concat(edge.to)
			const usedSea = current.usedSea || leavingSea || directSea
			const legalVichyDestination = vichyAccess === "destination"
			if (next.kind === "land" && edge.to !== from && canStack(game, data, pieceId, edge.to) && (legalVichyDestination || (vichyAccess !== "transit" && context.supplyStatus(side, edge.to, piece.nation) !== "oos"))) {
				const seaPanzerBlocked = usedSea && piece.nation === "ge" && piece.size === "scu" && piece.unit_type === "mechanized" && ["dz", "tn", "ly", "eg"].includes(next.nation) && context.axisPanzerScusInNorthAfrica() >= 2
				if (!seaPanzerBlocked && !paths.has(edge.to)) {
					paths.set(edge.to, path)
					if (stopAfterFirst) return paths
				}
			}
			if (leavingSea || directSea || (next.terrain === "desert" && edge.to !== from)) continue
			const key = `${edge.to}:${usedSea}:${enteringSea}`
			if (visited.has(key)) continue
			visited.add(key)
			queue.push({ space: edge.to, path, usedSea, inSea: enteringSea })
		}
	}
	if (piece.size === "scu" && originSupply === "full") {
		const reserve = Locations.reserve(side)
		paths.set(reserve, [reserve])
	}
	return paths
}

function legalSrPaths(game, data, adjacency, pieceId, context = null) {
	return searchSrPaths(game, data, adjacency, pieceId, context, false)
}

function hasLegalSrDestination(game, data, adjacency, pieceId, context = null) {
	return searchSrPaths(game, data, adjacency, pieceId, context, true).size > 0
}

function movePiece(game, data, pieceId, destination) {
	enterSpace(game, data, pieceId, destination)
}

function supplySources(game, data, side, nation = null) {
	const index = supplyData(data)
	if (side === AXIS) {
		if (game.events?.national_redoubt && index.munich && !index.axisSources.includes(index.munich)) return index.axisSources.concat(index.munich)
		return index.axisSources
	}
	return index.alliedSources
		.filter((space) => {
			if (space.supply === "allied_scheldt") return game.events.clearing_the_scheldt && game.control[space.id] === ALLIED
			if (space.name === "Naples") return game.control[space.id] === ALLIED && nation !== "su"
			if (nation === "su") return ["Sverdlovsk", "Chelyabiinsk", "Basra"].includes(space.name)
			return ["Suez", "Alexandria", "Basra"].includes(space.name)
		})
		.map((space) => space.id)
}

function traceSupplyDetails(game, data, adjacency, side, start, nation = null, options = {}) {
	if (nation === "yu") return { status: "full", terminals: [{ space_id: start, kind: "special", status: "full", distance: 0, path_type: "local" }] }
	if (side === AXIS && game.events?.operation_strangle && data.spaces[start]?.nation === "fr") return { status: "limited", terminals: [{ space_id: start, kind: "event", status: "limited", distance: 0, path_type: "operation_strangle" }] }
	if (["tu", "sw"].includes(nation) && Neutrals.isAtWar(game, nation) && data.spaces[start]?.nation === nation)
		return { status: "full", terminals: [{ space_id: start, kind: "national_home", status: "full", distance: 0, path_type: "regular" }] }
	const sources = new Set(supplySources(game, data, side, nation))
	const beachSources = side === ALLIED ? new Set(Invasions.supplyBeachheads(game, nation)) : new Set()
	const excludedSources = new Set(options.exclude_sources || [])
	const index = supplyData(data)
	const axisNorthAfricaSeaSupply = side === AXIS && (game.events?.italian_naval_sortie_turn === game.turn || (index.malta && game.control[index.malta] === AXIS))
	const includeTerminals = options.include_terminals !== false
	const queue = [{ id: start, limited: false, fullSea: false, distance: 0 }]
	const visited = new Map([[`${start}:false:false`, 0]])
	const partisans = new Set(game.partisans || [])
	const terminals = []
	let best = "oos"
	for (let cursor = 0; cursor < queue.length; ++cursor) {
		const current = queue[cursor]
		if (beachSources.has(current.id) && !excludedSources.has(current.id)) {
			const status = !current.limited && current.distance <= 2 ? "full" : "limited"
			if (includeTerminals) terminals.push({ space_id: current.id, kind: "beachhead", status, distance: current.distance, path_type: current.limited ? "limited" : "regular" })
			if (status === "full") {
				best = "full"
				if (options.stop_at_full) return { status: "full", terminals }
				continue
			}
			if (best === "oos") best = "limited"
		}
		if (sources.has(current.id) && !excludedSources.has(current.id)) {
			const space = data.spaces[current.id]
			const sunnyItaly = game.options.sunny_italy && space?.name === "Naples" && [3, 4, 7, 8, 11, 12, 15, 16].includes(game.turn)
			const naplesIntoFrance = space?.name === "Naples" && data.spaces[start]?.nation === "fr"
			const winter42 = side === AXIS && nation === "ge" && Weather.isWinter42(game) && data.spaces[start]?.nation === "su"
			const partisanAtTerminal = side === AXIS && partisans.has(current.id)
			const status = current.limited || partisanAtTerminal || (space?.supply === "axis_limited" && !current.fullSea) || naplesIntoFrance || sunnyItaly || winter42 ? "limited" : "full"
			if (includeTerminals) terminals.push({ space_id: current.id, kind: "supply_source", status, distance: current.distance, path_type: current.limited ? "limited" : "regular" })
			if (status === "full") {
				best = "full"
				if (options.stop_at_full) return { status: "full", terminals }
				continue
			}
			if (best === "oos") best = "limited"
		}
		for (const edge of adjacency[current.id] || []) {
			if (data.spaces[edge.to]?.kind !== "sr" && !controlledBy(game, edge.to, side)) continue
			const fullSea = current.fullSea || (axisNorthAfricaSeaSupply && edge.type === "sr" && index.axisSeaGateways.has(current.id))
			const limited = current.limited || (edge.type === "sr" && !fullSea) || (side === AXIS && (partisans.has(current.id) || partisans.has(edge.to)))
			const distance = current.distance + 1
			const key = `${edge.to}:${limited}:${fullSea}`
			if (visited.has(key) && visited.get(key) <= distance) continue
			visited.set(key, distance)
			queue.push({ id: edge.to, limited, fullSea, distance })
		}
	}
	if (best === "oos" && isFortIntactForSide(game, data, start, side) && game.control[start] === side) {
		best = "limited"
		if (includeTerminals) terminals.push({ space_id: start, kind: "fort", status: "limited", distance: 0, path_type: "local" })
	}
	if (includeTerminals) terminals.sort((a, b) => (a.status === b.status ? a.distance - b.distance || a.space_id - b.space_id : a.status === "full" ? -1 : 1))
	return { status: best, terminals }
}

function traceSupply(game, data, adjacency, side, start, nation = null) {
	return traceSupplyDetails(game, data, adjacency, side, start, nation, { stop_at_full: true, include_terminals: false }).status
}

function pieceSupplyStatus(game, data, adjacency, pieceId, context = null, spaceId = game.pieces[pieceId]) {
	const piece = data.pieces[pieceId]
	if (!piece || !Number.isInteger(spaceId) || spaceId <= 0) return "oos"
	const side = pieceSide(game, data, pieceId)
	const status = traceSupply(game, data, adjacency, side, spaceId, piece.nation)
	if (status === "oos" && side === AXIS && ["defense", "attrition"].includes(context) && game.events?.luftwaffe_supply_turn === game.turn && game.events?.luftwaffe_supply_space === spaceId) return "limited"
	return status
}

module.exports = {
	activationCost,
	activationGroup,
	activationSupplyStatus,
	adjustVpForControl,
	applyStandFastExit,
	buildAdjacency,
	canEndFormationMovement,
	canEntrench,
	canEntrenchAfterActivation,
	canStack,
	canStackFormation,
	createSrSearchContext,
	controlledBy,
	enterSpace,
	controlNation,
	enemyPiecesInSpace,
	friendlyPiecesInSpace,
	effectiveControl,
	isFortIntactForSide,
	isMechanizedInSupply,
	hasLegalSrDestination,
	legalEntrenchingPieces,
	legalActivationSpaces,
	legalMoveDestinations,
	legalMoveFormationSteps,
	legalMovePaths,
	legalReserveEntrySpaces,
	legalSrPaths,
	movePiece,
	moveFormationStep,
	movePieceAlongPath,
	movementAllowance,
	pieceSupplyStatus,
	pieceSide,
	normalizeControlNations,
	partisanVpAdjustment,
	piecesInSpace,
	removeTrench,
	recordActivationSupply,
	recordSrReserveEntry,
	resolveEntrenchAttempt,
	setControl,
	SOVIET_TRENCH_LIMIT,
	syncPartisanVp,
	supplySources,
	traceSupply,
	traceSupplyDetails,
}
