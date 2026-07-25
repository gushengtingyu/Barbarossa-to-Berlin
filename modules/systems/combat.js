"use strict"

const { AXIS } = require("../core/constants.js")
const { clone } = require("../core/state.js")
const Locations = require("../core/unit_locations.js")
const Random = require("../core/random.js")
const Weather = require("./weather.js")
const Restrictions = require("./restrictions.js")
const CombatCards = require("./combat_cards.js")
const Neutrals = require("./neutrals.js")
const Orders = require("./orders.js")

const SCU_COLUMNS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7])
const LCU_COLUMNS = Object.freeze([1, 2, 3, 4, 5, 6, 9, 12, 15])

const SCU_FIRE = Object.freeze([null, [0, 0, 0, 0, 1, 1, 1, 1], [0, 0, 0, 1, 1, 1, 1, 2], [0, 0, 1, 1, 1, 2, 2, 2], [0, 1, 1, 1, 2, 2, 2, 3], [1, 1, 1, 2, 2, 2, 3, 3], [1, 1, 2, 2, 2, 3, 3, 3]])

const LCU_FIRE = Object.freeze([null, [0, 1, 1, 2, 2, 3, 3, 4, 4], [1, 1, 2, 2, 3, 3, 4, 4, 5], [1, 2, 2, 3, 3, 4, 4, 5, 5], [1, 2, 3, 3, 4, 4, 5, 5, 6], [2, 2, 3, 4, 4, 5, 5, 6, 6], [2, 3, 4, 4, 5, 5, 6, 6, 6]])

function isReduced(game, pieceId) {
	return game.reduced.includes(pieceId)
}

function setReduced(game, pieceId, reduced) {
	const index = game.reduced.indexOf(pieceId)
	if (reduced && index < 0) game.reduced.push(pieceId)
	if (!reduced && index >= 0) game.reduced.splice(index, 1)
}

function combatStrength(game, data, pieceId) {
	const piece = data.pieces[pieceId]
	return Number(isReduced(game, pieceId) ? piece?.rcf : piece?.cf) || 0
}

function lossFactor(game, data, pieceId) {
	const piece = data.pieces[pieceId]
	return Number(isReduced(game, pieceId) ? piece?.rlf : piece?.lf) || 0
}

function isOnMap(game, pieceId) {
	return Number.isInteger(game.pieces[pieceId]) && game.pieces[pieceId] > 0
}

function usesLcuTable(data, pieceIds) {
	return pieceIds.some((pieceId) => data.pieces[pieceId]?.size === "lcu")
}

function baseColumn(table, strength) {
	const columns = table === "lcu" ? LCU_COLUMNS : SCU_COLUMNS
	let index = 0
	for (let i = 0; i < columns.length; i++) if (strength >= columns[i]) index = i
	return index
}

function shiftedColumn(table, strength, shifts) {
	const columns = table === "lcu" ? LCU_COLUMNS : SCU_COLUMNS
	return Math.max(0, Math.min(columns.length - 1, baseColumn(table, strength) + shifts))
}

function fireResult(table, column, die) {
	const row = table === "lcu" ? LCU_FIRE : SCU_FIRE
	return row[Math.max(1, Math.min(6, die))][column]
}

function fireColumnLabel(table, column) {
	const columns = table === "lcu" ? LCU_COLUMNS : SCU_COLUMNS
	return columns[Math.max(0, Math.min(columns.length - 1, Number(column) || 0))]
}

function fortProvidesBenefit(game, data, map, spaceId, side) {
	if (game.combat?.krim && game.combat.defender_space === spaceId && side !== AXIS) return false
	if (typeof map.isFortIntactForSide === "function") return map.isFortIntactForSide(game, data, spaceId, side)
	return !!data.spaces[spaceId]?.fort && !game.destroyed_forts?.includes(spaceId) && (!data.spaces[spaceId].side || data.spaces[spaceId].side === side)
}

function defenderSupplyStatus(game, data, map, adjacency, pieceId, spaceId = game.pieces[pieceId]) {
	if (typeof map.pieceSupplyStatus === "function") return map.pieceSupplyStatus(game, data, adjacency, pieceId, "defense", spaceId)
	const side = sideOf(game, data, map, [pieceId])
	return map.traceSupply(game, data, adjacency, side, spaceId, data.pieces[pieceId].nation)
}

function trenchProvidesBenefit(game, data, map, adjacency, spaceId, defenders) {
	if (!game.trench?.[spaceId] || !defenders.length) return false
	const side = sideOf(game, data, map, defenders)
	if (game.trench_owner?.[spaceId] && game.trench_owner[spaceId] !== side) return false
	const oos = defenders.some((pieceId) => defenderSupplyStatus(game, data, map, adjacency, pieceId, spaceId) === "oos")
	return !oos || defenders.every((pieceId) => data.pieces[pieceId]?.nation === "su")
}

function attackerTerrainShift(game, data, map, adjacency, spaceId, defenders) {
	const space = data.spaces[spaceId]
	const side = sideOf(game, data, map, defenders)
	const defenderOos = defenders.some((pieceId) => defenderSupplyStatus(game, data, map, adjacency, pieceId, spaceId) === "oos")
	let shift = !defenderOos && (["mountain", "swamp"].includes(space?.terrain) || space?.urban || fortProvidesBenefit(game, data, map, spaceId, side) || space?.kind === "beach") ? -1 : 0
	if (trenchProvidesBenefit(game, data, map, adjacency, spaceId, defenders)) shift -= Number(game.trench[spaceId]) || 0
	return shift
}

function defenderTerrainShift(game, data, map, adjacency, spaceId, defenders) {
	return trenchProvidesBenefit(game, data, map, adjacency, spaceId, defenders) ? 1 : 0
}

function attackersAcrossRiver(game, adjacency, combat, attackers) {
	return (
		attackers.length > 0 &&
		attackers.every((pieceId) => {
			const origin = game.pieces[pieceId]
			return (adjacency[origin] || []).some((edge) => edge.to === combat.defender_space && edge.type === "river")
		})
	)
}

function sideOf(game, data, map, pieceIds) {
	if (!pieceIds.length) return null
	if (typeof map?.pieceSide === "function") return map.pieceSide(game, data, pieceIds[0])
	return Neutrals.effectivePieceSide(game, data.pieces[pieceIds[0]])
}

function currentAttackModifier(game) {
	const modifier = game.event?.attack_modifier
	if (modifier && typeof modifier === "object") return modifier
	const legacyDrm = Number(game.event?.attack_drm) || 0
	return legacyDrm
		? {
				attacker_side: AXIS,
				nations: ["ge"],
				defender_nations: ["su"],
				drm: legacyDrm,
				no_retreat: false,
			}
		: null
}

function eventAttackModifierMatches(game, data, map, attackers, defenders) {
	const modifier = currentAttackModifier(game)
	if (!modifier || !attackers.length) return false
	if (modifier.attacker_side && sideOf(game, data, map, attackers) !== modifier.attacker_side) return false
	if (modifier.nations?.length && !attackers.every((pieceId) => modifier.nations.includes(data.pieces[pieceId]?.nation))) return false
	if (modifier.any_attacker_nations?.length && !attackers.some((pieceId) => modifier.any_attacker_nations.includes(data.pieces[pieceId]?.nation))) return false
	if (modifier.any_attacker_piece_ids?.length && !attackers.some((pieceId) => modifier.any_attacker_piece_ids.includes(pieceId))) return false
	if (modifier.defender_nations?.length && !defenders.every((pieceId) => modifier.defender_nations.includes(data.pieces[pieceId]?.nation))) return false
	if (modifier.excluded_defender_nations?.length && defenders.some((pieceId) => modifier.excluded_defender_nations.includes(data.pieces[pieceId]?.nation))) return false
	return true
}

function eventAttackDrm(game, data, map, attackers, defenders) {
	const modifier = currentAttackModifier(game)
	return eventAttackModifierMatches(game, data, map, attackers, defenders) ? Number(modifier.drm) || 0 : 0
}

function eventPreventsNoRetreat(game, data, map, combat) {
	const modifier = currentAttackModifier(game)
	return !!modifier?.no_retreat && eventAttackModifierMatches(game, data, map, combat.attackers || [], combat.defenders || [])
}

function eventDefenderDrm(game, data, map, combat) {
	const modifier = game.event?.defender_modifier
	if (!modifier || (modifier.defender_side && combat.defender_side !== modifier.defender_side)) return 0
	if (modifier.nations?.length && !combat.defenders.every((pieceId) => modifier.nations.includes(data.pieces[pieceId]?.nation))) return 0
	return Number(modifier.drm) || 0
}

function attackerSupplyStatus(game, data, map, adjacency, pieceId) {
	if (typeof map.activationSupplyStatus === "function") return map.activationSupplyStatus(game, data, adjacency, pieceId)
	const piece = data.pieces[pieceId]
	return map.traceSupply(game, data, adjacency, sideOf(game, data, map, [pieceId]), game.pieces[pieceId], piece.nation)
}

function fireProfile(game, data, map, adjacency, combat, includeCombatCards) {
	const attackers = combat.attackers.filter((pieceId) => isOnMap(game, pieceId))
	const defenders = combat.defenders.filter((pieceId) => isOnMap(game, pieceId))
	const allDefenders = [...new Set(defenders.concat((combat.retreated_defenders || []).filter((pieceId) => isOnMap(game, pieceId))))]
	if (!attackers.length || !allDefenders.length) throw new Error("combat requires attackers and defenders")
	const attackerTable = usesLcuTable(data, attackers) ? "lcu" : "scu"
	const defenderTable = usesLcuTable(data, allDefenders) ? "lcu" : "scu"
	const attackerStrength = attackers.reduce((sum, pieceId) => sum + combatStrength(game, data, pieceId), 0)
	const defenderStrength = defenders.reduce((sum, pieceId) => sum + combatStrength(game, data, pieceId), 0)
	const riverAttack = attackersAcrossRiver(game, adjacency, combat, attackers)
	let attackerShift = attackerTerrainShift(game, data, map, adjacency, combat.defender_space, allDefenders)
	if (includeCombatCards) attackerShift += CombatCards.attackerTerrainShift(combat)
	let defenderShift = defenderTerrainShift(game, data, map, adjacency, combat.defender_space, allDefenders)
	const winter42Attackers = Weather.formationIsWinter42German(game, data, attackers)
	const winter42Defenders = Weather.formationIsWinter42German(game, data, allDefenders)
	if (winter42Defenders) {
		const trench = trenchProvidesBenefit(game, data, map, adjacency, combat.defender_space, allDefenders) ? Number(game.trench[combat.defender_space]) || 0 : 0
		attackerShift = trench ? -trench : 0
	}
	if (riverAttack) attackerShift--
	if (winter42Attackers) attackerShift--
	if (winter42Defenders) defenderShift--
	if (attackers.some((pieceId) => attackerSupplyStatus(game, data, map, adjacency, pieceId) === "oos")) attackerShift--
	if (allDefenders.some((pieceId) => defenderSupplyStatus(game, data, map, adjacency, pieceId) === "oos")) defenderShift--
	const attackerColumn = shiftedColumn(attackerTable, attackerStrength, attackerShift)
	const defenderColumn = shiftedColumn(defenderTable, defenderStrength, defenderShift)
	const attackerSide = sideOf(game, data, map, attackers)
	const defenderSide = sideOf(game, data, map, allDefenders) || combat.defender_side
	return {
		attackers,
		defenders,
		attacker_side: attackerSide,
		defender_side: defenderSide,
		attacker_table: attackerTable,
		defender_table: defenderTable,
		attacker_strength: attackerStrength,
		defender_strength: defenderStrength,
		river_attack: riverAttack,
		attacker_shift: attackerShift,
		defender_shift: defenderShift,
		attacker_column: attackerColumn,
		defender_column: defenderColumn,
	}
}

function preview(game, data, map, adjacency, combat) {
	return fireProfile(game, data, map, adjacency, combat, false)
}

function resolve(game, data, map, adjacency, combat) {
	const profile = fireProfile(game, data, map, adjacency, combat, true)
	const { attackers, defenders, attacker_side: attackerSide, defender_side: defenderSide, attacker_table: attackerTable, defender_table: defenderTable, attacker_column: attackerColumn, defender_column: defenderColumn } = profile
	const allDefenders = [...new Set(defenders.concat((combat.retreated_defenders || []).filter((pieceId) => isOnMap(game, pieceId))))]
	const attackerRawDie = Random.random(game, 6) + 1
	const defenderRawDie = Random.random(game, 6) + 1
	const attackerDrm = eventAttackDrm(game, data, map, attackers, allDefenders) + CombatCards.drm(combat, attackerSide)
	const defenderDrm = eventDefenderDrm(game, data, map, combat) + CombatCards.drm(combat, defenderSide)
	const attackerDie = Math.max(1, Math.min(6, attackerRawDie + attackerDrm))
	const defenderDie = Math.max(1, Math.min(6, defenderRawDie + defenderDrm))
	Object.assign(combat, {
		...profile,
		attacker_die_raw: attackerRawDie,
		defender_die_raw: defenderRawDie,
		attacker_drm: attackerDrm,
		defender_drm: defenderDrm,
		attacker_die: attackerDie,
		defender_die: defenderDie,
		defender_loss: fireResult(attackerTable, attackerColumn, attackerDie),
		attacker_loss: fireResult(defenderTable, defenderColumn, defenderDie),
		defender_loss_taken: 0,
		attacker_loss_taken: 0,
	})
	combat.southwest_loss_taken = false
	return combat
}

function hasTrait(piece, trait) {
	return String(piece?.traits || "")
		.split(";")
		.includes(trait)
}

function replacementMatches(lcu, scu) {
	if (!scu || scu.size !== "scu" || scu.side !== lcu.side) return false
	if (lcu.nation === "br" && !["br", "cw"].includes(scu.nation)) return false
	else if (lcu.nation === "cw" && scu.nation !== "cw") return false
	else if (lcu.nation === "ff" && !["ff", "us"].includes(scu.nation)) return false
	else if (!["br", "cw", "ff"].includes(lcu.nation) && scu.nation !== lcu.nation) return false
	return lcu.unit_type === "mechanized" ? scu.unit_type === "mechanized" : scu.unit_type !== "mechanized"
}

function findLcuReplacement(game, data, pieceId) {
	const lcu = data.pieces[pieceId]
	for (let id = 1; id < data.pieces.length; id++) if (Locations.isReserve(game.pieces[id]) && !isReduced(game, id) && replacementMatches(lcu, data.pieces[id])) return id
	for (let id = 1; id < data.pieces.length; id++) if (Locations.isReserve(game.pieces[id]) && replacementMatches(lcu, data.pieces[id])) return id
	return null
}

function replaceParticipant(combat, pieceId, replacement) {
	for (const key of ["attackers", "defenders"]) if (combat[key]?.includes(pieceId) && replacement && !combat[key].includes(replacement)) combat[key].push(replacement)
}

function replaceEliminatedSouthwestFront(game, data, pieceId) {
	if (data.pieces[pieceId]?.name !== "SU Southwest Front") return null
	const replacement = data.pieces.find((piece) => piece?.name === "SU Southwest Front (Infantry)")
	if (!replacement) throw new Error("missing Soviet Southwest Front infantry replacement")
	game.pieces[pieceId] = Locations.REMOVED
	setReduced(game, replacement.id, false)
	game.pieces[replacement.id] = Locations.eliminated(Neutrals.effectivePieceSide(game, replacement))
	return replacement.id
}

function hypotheticalReplacementLoss(data, pieceId, remaining) {
	if (remaining <= 0) return 0
	const lcu = data.pieces[pieceId]
	const scu = data.pieces.find((candidate) => replacementMatches(lcu, candidate))
	if (!scu) return 0
	let absorbed = 0
	for (const factor of [Number(scu.lf) || 0, Number(scu.rlf) || 0]) {
		if (!factor || absorbed + factor > remaining) break
		absorbed += factor
	}
	return absorbed
}

function applyStepLoss(game, data, combat, pieceId, maxCost = null) {
	if (!isOnMap(game, pieceId)) throw new Error(`piece ${pieceId} cannot take a combat loss`)
	const piece = data.pieces[pieceId]
	const baseCost = lossFactor(game, data, pieceId)
	if (combat.attackers?.includes(pieceId) && piece.name === "SU Southwest Front") combat.southwest_loss_taken = true
	if (!isReduced(game, pieceId)) {
		setReduced(game, pieceId, true)
		return {
			cost: baseCost,
			eliminated: false,
			replacement: null,
			permanent: false,
			origin_space_id: game.pieces[pieceId],
		}
	}
	const location = game.pieces[pieceId]
	setReduced(game, pieceId, false)
	const southwestReplacement = replaceEliminatedSouthwestFront(game, data, pieceId)
	if (southwestReplacement) {
		Orders.releaseStandFastIfVacated(game, data, location)
		return { cost: baseCost, eliminated: true, replacement: southwestReplacement, permanent: false, origin_space_id: location }
	}
	game.pieces[pieceId] = Locations.eliminated(Neutrals.effectivePieceSide(game, piece))
	let replacement = null
	let permanent = false
	let cost = baseCost
	if (piece.size === "lcu") {
		replacement = findLcuReplacement(game, data, pieceId)
		if (replacement) {
			game.pieces[replacement] = location
			replaceParticipant(combat, pieceId, replacement)
		} else {
			game.pieces[pieceId] = Locations.REMOVED
			permanent = true
			if (maxCost !== null) cost += hypotheticalReplacementLoss(data, pieceId, Math.max(0, maxCost - baseCost))
		}
	}
	if (hasTrait(piece, "non_replaceable")) {
		game.pieces[pieceId] = Locations.REMOVED
		permanent = true
	}
	Orders.releaseStandFastIfVacated(game, data, location)
	return { cost, eliminated: true, replacement, permanent, origin_space_id: location }
}

function eliminatePreviouslyRetreated(game, data, pieceId) {
	if (!isOnMap(game, pieceId)) throw new Error(`piece ${pieceId} cannot be eliminated after retreat`)
	const piece = data.pieces[pieceId]
	const location = game.pieces[pieceId]
	const side = Neutrals.effectivePieceSide(game, piece)
	Orders.ensureStandFastUnits(game, data, location)
	setReduced(game, pieceId, false)
	const southwestReplacement = replaceEliminatedSouthwestFront(game, data, pieceId)
	if (southwestReplacement) {
		Orders.releaseStandFastIfVacated(game, data, location)
		return { replacement: southwestReplacement, permanent: false, origin_space_id: location }
	}
	if (piece.size === "scu") {
		game.pieces[pieceId] = hasTrait(piece, "non_replaceable") ? Locations.REMOVED : Locations.eliminated(side)
		Orders.releaseStandFastIfVacated(game, data, location)
		return { replacement: null, permanent: hasTrait(piece, "non_replaceable"), origin_space_id: location }
	}
	const replacement = findLcuReplacement(game, data, pieceId)
	if (replacement) {
		setReduced(game, replacement, false)
		game.pieces[replacement] = Locations.eliminated(side)
		game.pieces[pieceId] = Locations.eliminated(side)
	} else game.pieces[pieceId] = Locations.REMOVED
	Orders.releaseStandFastIfVacated(game, data, location)
	return { replacement, permanent: !replacement, origin_space_id: location }
}

function cloneForLoss(game, combat) {
	return { game: clone(game), combat: clone(combat) }
}

function maxReachableLoss(game, data, combat, participantKey, remaining) {
	let best = 0
	for (const pieceId of combat[participantKey]) {
		if (!isOnMap(game, pieceId)) continue
		const baseCost = lossFactor(game, data, pieceId)
		if (!baseCost || baseCost > remaining) continue
		const copy = cloneForLoss(game, combat)
		const { cost } = applyStepLoss(copy.game, data, copy.combat, pieceId, remaining)
		best = Math.max(best, cost + maxReachableLoss(copy.game, data, copy.combat, participantKey, remaining - cost))
	}
	return best
}

function legalLossChoices(game, data, combat, participantKey, remaining) {
	if (participantKey === "attackers" && !combat.southwest_loss_taken) {
		const southwest = combat.attackers.find((pieceId) => isOnMap(game, pieceId) && data.pieces[pieceId]?.name === "SU Southwest Front")
		if (southwest && lossFactor(game, data, southwest) <= remaining) return [southwest]
	}
	const target = maxReachableLoss(game, data, combat, participantKey, remaining)
	if (!target) return []
	return combat[participantKey].filter((pieceId, index, list) => {
		if (list.indexOf(pieceId) !== index || !isOnMap(game, pieceId)) return false
		const baseCost = lossFactor(game, data, pieceId)
		if (!baseCost || baseCost > remaining) return false
		const copy = cloneForLoss(game, combat)
		const { cost } = applyStepLoss(copy.game, data, copy.combat, pieceId, remaining)
		return cost + maxReachableLoss(copy.game, data, copy.combat, participantKey, remaining - cost) === target
	})
}

function winner(combat) {
	if (combat.defender_loss > combat.attacker_loss) return combat.attacker_side
	if (combat.attacker_loss > combat.defender_loss) return combat.defender_side
	return null
}

function canCancelRetreat(game, data, map, adjacency, combat) {
	if (combat === undefined) {
		combat = map
		map = {
			traceSupply: () => "full",
			isFortIntactForSide: (state, localData, spaceId, side) => !!localData.spaces[spaceId]?.fort && !state.destroyed_forts?.includes(spaceId) && (!localData.spaces[spaceId].side || localData.spaces[spaceId].side === side),
		}
		adjacency = []
	}
	if (eventPreventsNoRetreat(game, data, map, combat)) return false
	const space = data.spaces[combat.defender_space]
	const survivors = combat.defenders.filter((pieceId) => isOnMap(game, pieceId))
	const side = sideOf(game, data, map, survivors)
	const trenchAllowed = trenchProvidesBenefit(game, data, map, adjacency, combat.defender_space, survivors) && !(game.turn === 1 && (game.events.barbarossa || game.events.von_paulus_pause))
	const hedgehogsAllowed = game.events?.hedgehogs_turn === game.turn && data.spaces[combat.defender_space]?.nation === "su" && survivors.length > 0 && survivors.every((pieceId) => data.pieces[pieceId]?.nation === "ge")
	if (hedgehogsAllowed) return true
	const defenderOos = survivors.some((pieceId) => defenderSupplyStatus(game, data, map, adjacency, pieceId, combat.defender_space) === "oos")
	if (defenderOos) return !!trenchAllowed
	if (
		Weather.formationIsWinter42German(
			game,
			data,
			combat.defenders.filter((pieceId) => isOnMap(game, pieceId)),
		)
	)
		return !!trenchAllowed
	return !!(trenchAllowed || fortProvidesBenefit(game, data, map, combat.defender_space, side) || space?.kind === "beach" || ["forest", "mountain", "swamp"].includes(space?.terrain))
}

function eventRoundMatches(game, value) {
	if (value === true) return true
	return value?.turn === game.turn && value?.round === game.action_round
}

function mayAttackSpace(game, data, side, spaceId) {
	const space = data.spaces[spaceId]
	if (!space || !["land", "beach"].includes(space.kind)) return false
	if (space.kind === "beach") return true
	if (side !== AXIS) return true
	const requirement = space.attack_requires_event
	const events = game.events || {}
	if (requirement === "axis_no_entry") return false
	if (eventRoundMatches(game, events.nordlicht_round) && requirement !== "nordlicht") return false
	if (requirement === "nordlicht") return !!(events.nordlicht || game.control?.[spaceId] === AXIS)
	if (requirement === "taifun") return !!(events.taifun || game.control?.[spaceId] === AXIS)
	if (requirement === "fall_blau") {
		const controlsBlau = data.spaces.some((candidate) => candidate?.attack_requires_event === "fall_blau" && game.control?.[candidate.id] === AXIS)
		return !!(events.fall_blau || controlsBlau)
	}
	return true
}

function isMechanizedForAdvance(game, data, map, adjacency, pieceId) {
	const piece = data.pieces[pieceId]
	const allowance = Number(isReduced(game, pieceId) ? piece?.rmf : piece?.mf) || 0
	if (allowance < 4) return false
	if (attackerSupplyStatus(game, data, map, adjacency, pieceId) === "oos") return false
	if (Weather.isGermanInSovietUnion(game, data, pieceId)) return false
	return true
}

function advanceLimit(game, data, map, adjacency, combat, pieceId) {
	const piece = data.pieces[pieceId]
	if (!isMechanizedForAdvance(game, data, map, adjacency, pieceId)) return 1
	if (piece.name.includes("Shock")) return 1
	if (game.options.time_of_mud && game.turn === 3 && [2, 3].includes(game.action_round) && piece.nation === "ge" && data.spaces[game.pieces[pieceId]]?.nation === "su") return 1
	const retreatDistance = combat.retreat_distance ?? combat.retreat_path?.length ?? 0
	const normal = retreatDistance === 1 ? 2 : 3
	return Number.isInteger(combat.extra_advance_limit) ? Math.min(normal, combat.extra_advance_limit) : normal
}

function stopsMechanizedAdvance(game, space) {
	return !!((space?.fort && !game.destroyed_forts?.includes(space.id)) || ["forest", "mountain", "swamp"].includes(space?.terrain))
}

function nonMechanizedAdvancePaths(game, data, map, adjacency, combat, pieceId) {
	const paths = new Map()
	const defender = combat.defender_space
	const side = sideOf(game, data, map, [pieceId])
	if (map.enemyPiecesInSpace(game, data, side, defender).length) return paths
	if (!game.action?.attack_spaces?.includes(defender) && map.canStack(game, data, pieceId, defender) && Restrictions.mayEnter(game, data, adjacency, pieceId, defender)) paths.set(defender, [defender])
	const retreatPaths = Object.keys(combat.retreat_paths || {}).length ? Object.values(combat.retreat_paths) : combat.retreat_path ? [combat.retreat_path] : []
	for (const retreatPath of retreatPaths) {
		for (let index = 0; index < retreatPath.length - 1; index++) {
			const destination = retreatPath[index]
			const path = [defender].concat(retreatPath.slice(0, index + 1))
			if (game.action?.attack_spaces?.includes(destination) || !map.canStack(game, data, pieceId, destination)) continue
			if (path.every((spaceId) => Restrictions.mayEnter(game, data, adjacency, pieceId, spaceId))) paths.set(destination, path)
		}
	}
	return paths
}

function legalAdvancePaths(game, data, map, adjacency, combat, pieceId) {
	if (!combat.attackers.includes(pieceId) || !isOnMap(game, pieceId) || combat.advanced?.includes(pieceId)) return new Map()
	const invasionBeach = game.invasion?.beaches?.find((record) => combat.origin_spaces?.includes(record.space_id) && game.pieces[pieceId] === record.space_id)
	if (invasionBeach) {
		const destination = combat.defender_space
		if (
			destination &&
			destination === invasionBeach.connected_land &&
			!map.enemyPiecesInSpace(game, data, sideOf(game, data, map, [pieceId]), destination).length &&
			map.canStack(game, data, pieceId, destination) &&
			Restrictions.mayEnter(game, data, adjacency, pieceId, destination)
		)
			return new Map([[destination, [destination]]])
		return new Map()
	}
	const limit = advanceLimit(game, data, map, adjacency, combat, pieceId)
	if (limit === 1 && !isMechanizedForAdvance(game, data, map, adjacency, pieceId)) return nonMechanizedAdvancePaths(game, data, map, adjacency, combat, pieceId)
	const side = sideOf(game, data, map, [pieceId])
	const from = game.pieces[pieceId]
	const paths = new Map()
	const queue = [{ space: from, path: [] }]
	const visited = new Map([[from, 0]])
	while (queue.length) {
		const current = queue.shift()
		for (const edge of adjacency[current.space] || []) {
			const next = data.spaces[edge.to]
			if (edge.type === "sr" || next?.kind !== "land") continue
			const path = current.path.concat(edge.to)
			if (path.length > limit || map.enemyPiecesInSpace(game, data, side, edge.to).length) continue
			if (!Restrictions.mayEnter(game, data, adjacency, pieceId, edge.to)) continue
			const hasCombatMarker = game.action?.attack_spaces?.includes(edge.to)
			if (!hasCombatMarker && map.canStack(game, data, pieceId, edge.to)) paths.set(edge.to, path)
			if (stopsMechanizedAdvance(game, next)) continue
			if (visited.has(edge.to) && visited.get(edge.to) <= path.length) continue
			visited.set(edge.to, path.length)
			queue.push({ space: edge.to, path })
		}
	}
	return paths
}

module.exports = {
	LCU_COLUMNS,
	LCU_FIRE,
	SCU_COLUMNS,
	SCU_FIRE,
	applyStepLoss,
	advanceLimit,
	attackersAcrossRiver,
	baseColumn,
	canCancelRetreat,
	combatStrength,
	eliminatePreviouslyRetreated,
	fireColumnLabel,
	fireResult,
	findLcuReplacement,
	isOnMap,
	isReduced,
	legalLossChoices,
	legalAdvancePaths,
	lossFactor,
	maxReachableLoss,
	mayAttackSpace,
	preview,
	replaceEliminatedSouthwestFront,
	resolve,
	setReduced,
	shiftedColumn,
	winner,
}
