"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
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

function isSovietTrench(game, data, spaceId) {
	if (!game.trench?.[spaceId]) return false
	const kind = game.trench_kind?.[spaceId]
	if (kind) return kind === "soviet"
	// Legacy saves predate trench_kind; Tobruk is their only Allied non-Soviet trench.
	return game.trench_owner?.[spaceId] === ALLIED && data.spaces[spaceId]?.name !== "Tobruk"
}

function sovietTrenchDefenderShiftCancelled(game, data, spaceId) {
	return game.turn === 1 && !!game.events?.barbarossa && isSovietTrench(game, data, spaceId)
}

function trenchProvidesBenefit(game, data, map, adjacency, spaceId, defenders) {
	if (!game.trench?.[spaceId] || !defenders.length) return false
	const side = sideOf(game, data, map, defenders)
	if (game.trench_owner?.[spaceId] && game.trench_owner[spaceId] !== side) return false
	const oos = defenders.some((pieceId) => defenderSupplyStatus(game, data, map, adjacency, pieceId, spaceId) === "oos")
	return !oos || defenders.every((pieceId) => data.pieces[pieceId]?.nation === "su")
}

function axisDefendsInPartisanSpace(game, data, map, spaceId, defenders) {
	return !!game.partisans?.includes(spaceId) && sideOf(game, data, map, defenders) === AXIS
}

function defensiveTerrainReason(game, data, map, spaceId, defenders) {
	if (axisDefendsInPartisanSpace(game, data, map, spaceId, defenders)) return null
	const space = data.spaces[spaceId]
	const side = sideOf(game, data, map, defenders)
	if (["mountain", "swamp"].includes(space?.terrain)) return space.terrain
	if (space?.urban) return "urban"
	if (fortProvidesBenefit(game, data, map, spaceId, side)) return "fort"
	if (space?.kind === "beach") return "beach"
	return null
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

function solelyAcrossSkagerrak(game, data, combat) {
	const defenderName = data.spaces[combat.defender_space]?.name
	const origins = combat.origin_spaces?.length ? combat.origin_spaces : (combat.attackers || []).filter((pieceId) => isOnMap(game, pieceId)).map((pieceId) => game.pieces[pieceId])
	if (!defenderName || !origins.length) return false
	const skagerrakPairs = new Set(["Jutland:Oslo", "Copenhagen:Malmo"])
	return origins.every((spaceId) => {
		const originName = data.spaces[spaceId]?.name
		return !!originName && skagerrakPairs.has([originName, defenderName].sort().join(":"))
	})
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
	let attackerShiftFactors = []
	let defenderShiftFactors = []
	const terrainReason = defensiveTerrainReason(game, data, map, combat.defender_space, allDefenders)
	if (terrainReason) attackerShiftFactors.push({ reason: "terrain", amount: -1, terrain: terrainReason })
	const trench = trenchProvidesBenefit(game, data, map, adjacency, combat.defender_space, allDefenders) ? Number(game.trench[combat.defender_space]) || 0 : 0
	if (trench) {
		attackerShiftFactors.push({ reason: "trench", amount: -trench })
		if (!sovietTrenchDefenderShiftCancelled(game, data, combat.defender_space)) defenderShiftFactors.push({ reason: "trench", amount: 1 })
	}
	if (includeCombatCards && CombatCards.attackerTerrainShift(combat)) attackerShiftFactors.push({ reason: "combat_card", amount: -1, card_id: 73 })
	const winter42Attackers = Weather.formationIsWinter42German(game, data, attackers)
	const winter42Defenders = Weather.formationIsWinter42German(game, data, allDefenders)
	if (winter42Defenders) {
		attackerShiftFactors = trench ? [{ reason: "trench", amount: -trench }] : []
	}
	if (riverAttack) attackerShiftFactors.push({ reason: "river", amount: -1 })
	if (winter42Attackers) attackerShiftFactors.push({ reason: "winter_1942", amount: -1 })
	if (winter42Defenders) defenderShiftFactors.push({ reason: "winter_1942", amount: -1 })
	if (attackers.some((pieceId) => attackerSupplyStatus(game, data, map, adjacency, pieceId) === "oos")) attackerShiftFactors.push({ reason: "oos", amount: -1 })
	if (allDefenders.some((pieceId) => defenderSupplyStatus(game, data, map, adjacency, pieceId) === "oos")) defenderShiftFactors.push({ reason: "oos", amount: -1 })
	const attackerShift = attackerShiftFactors.reduce((sum, factor) => sum + factor.amount, 0)
	const defenderShift = defenderShiftFactors.reduce((sum, factor) => sum + factor.amount, 0)
	const attackerBaseColumn = baseColumn(attackerTable, attackerStrength)
	const defenderBaseColumn = baseColumn(defenderTable, defenderStrength)
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
		attacker_base_column: attackerBaseColumn,
		defender_base_column: defenderBaseColumn,
		attacker_shift: attackerShift,
		defender_shift: defenderShift,
		attacker_shift_factors: attackerShiftFactors,
		defender_shift_factors: defenderShiftFactors,
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
	const attackerDrmFactors = CombatCards.drmFactors(combat, attackerSide)
	const defenderDrmFactors = CombatCards.drmFactors(combat, defenderSide)
	const attackerEventDrm = eventAttackDrm(game, data, map, attackers, allDefenders)
	const defenderEventDrm = eventDefenderDrm(game, data, map, combat)
	if (attackerEventDrm) attackerDrmFactors.unshift({ reason: "event", amount: attackerEventDrm, card_id: game.event?.card_id || null })
	if (defenderEventDrm) defenderDrmFactors.unshift({ reason: "event", amount: defenderEventDrm, card_id: game.event?.card_id || null })
	const attackerDrm = attackerDrmFactors.reduce((sum, factor) => sum + factor.amount, 0)
	const defenderDrm = defenderDrmFactors.reduce((sum, factor) => sum + factor.amount, 0)
	const attackerDie = Math.max(1, Math.min(6, attackerRawDie + attackerDrm))
	const defenderDie = Math.max(1, Math.min(6, defenderRawDie + defenderDrm))
	Object.assign(combat, {
		...profile,
		attacker_die_raw: attackerRawDie,
		defender_die_raw: defenderRawDie,
		attacker_drm: attackerDrm,
		defender_drm: defenderDrm,
		attacker_drm_factors: attackerDrmFactors,
		defender_drm_factors: defenderDrmFactors,
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
	if (lcu.nation === "su") return scu.nation === "su" && scu.unit_type !== "mechanized" && !String(scu.name || "").includes("Shock")
	if (lcu.nation === "br" && !["br", "cw"].includes(scu.nation)) return false
	else if (lcu.nation === "cw" && scu.nation !== "cw") return false
	else if (lcu.nation === "ff" && scu.nation !== "ff") return false
	else if (!["br", "cw", "ff"].includes(lcu.nation) && scu.nation !== lcu.nation) return false
	if (lcu.nation === "ge" && lcu.unit_type === "mechanized") {
		const ssReplacement = String(scu.name || "").includes("SS")
		return scu.unit_type === "mechanized" && (String(lcu.name || "").includes("6SS") ? ssReplacement : !ssReplacement)
	}
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

function recordLcuReplacementIdentity(game, data, pieceId, replacement) {
	if (replacement && data.pieces[pieceId]?.name === "IT 8 Army") game.italian_8th_corps = replacement
}

function inheritAttackerReplacementState(game, combat, pieceId, replacement) {
	if (!replacement || !combat.attackers?.includes(pieceId) || !game.action) return
	if (game.action.activation_supply && Object.hasOwn(game.action.activation_supply, pieceId)) game.action.activation_supply[replacement] = game.action.activation_supply[pieceId]
	game.action.used_pieces ||= []
	if (!game.action.used_pieces.includes(replacement)) game.action.used_pieces.push(replacement)
	for (const key of ["moved", "sr_moved"]) {
		if (game.action[key]?.includes(pieceId) && !game.action[key].includes(replacement)) game.action[key].push(replacement)
	}
}

function registerCombatReplacement(game, data, combat, pieceId, replacement) {
	recordLcuReplacementIdentity(game, data, pieceId, replacement)
	inheritAttackerReplacementState(game, combat, pieceId, replacement)
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
	if (piece.name === "SU Southwest Front") {
		const replacement = findLcuReplacement(game, data, pieceId)
		if (!replacement) {
			game.pieces[pieceId] = Locations.REMOVED
			const cost = maxCost === null ? baseCost : baseCost + hypotheticalReplacementLoss(data, pieceId, Math.max(0, maxCost - baseCost))
			Orders.releaseStandFastIfVacated(game, data, location)
			return { cost, eliminated: true, replacement: null, permanent: true, origin_space_id: location }
		}
		const southwestReplacement = replaceEliminatedSouthwestFront(game, data, pieceId)
		game.pieces[replacement] = location
		replaceParticipant(combat, pieceId, replacement)
		registerCombatReplacement(game, data, combat, pieceId, replacement)
		Orders.releaseStandFastIfVacated(game, data, location)
		return { cost: baseCost, eliminated: true, replacement: southwestReplacement, scu_replacement: replacement, permanent: false, origin_space_id: location }
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
			registerCombatReplacement(game, data, combat, pieceId, replacement)
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
	if (piece.name === "SU Southwest Front") {
		const replacement = findLcuReplacement(game, data, pieceId)
		if (!replacement) {
			game.pieces[pieceId] = Locations.REMOVED
			Orders.releaseStandFastIfVacated(game, data, location)
			return { replacement: null, permanent: true, origin_space_id: location }
		}
		const southwestReplacement = replaceEliminatedSouthwestFront(game, data, pieceId)
		setReduced(game, replacement, false)
		game.pieces[replacement] = Locations.eliminated(side)
		Orders.releaseStandFastIfVacated(game, data, location)
		return { replacement: southwestReplacement, scu_replacement: replacement, permanent: false, origin_space_id: location }
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
		recordLcuReplacementIdentity(game, data, pieceId, replacement)
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
	const sovietTrenchNoRetreatCancelled = game.turn === 1 && (game.events?.barbarossa || game.events?.von_paulus_pause) && isSovietTrench(game, data, combat.defender_space)
	const trenchAllowed = trenchProvidesBenefit(game, data, map, adjacency, combat.defender_space, survivors) && !sovietTrenchNoRetreatCancelled
	const hedgehogsAllowed = game.events?.hedgehogs_turn === game.turn && data.spaces[combat.defender_space]?.nation === "su" && survivors.length > 0 && survivors.every((pieceId) => data.pieces[pieceId]?.nation === "ge")
	if (hedgehogsAllowed) return true
	if (
		Weather.formationIsWinter42German(
			game,
			data,
			combat.defenders.filter((pieceId) => isOnMap(game, pieceId)),
		)
	)
		return !!trenchAllowed
	const alliedAntwerp = space?.name === "Antwerp" && game.control?.[combat.defender_space] === ALLIED
	const skagerrak = solelyAcrossSkagerrak(game, data, combat)
	const devilsGardens = space?.terrain === "desert" && CombatCards.played(combat, combat.defender_side, 73)
	const normalTerrainAllowed = !axisDefendsInPartisanSpace(game, data, map, combat.defender_space, survivors)
	return !!(
		trenchAllowed ||
		(normalTerrainAllowed && (alliedAntwerp || skagerrak || devilsGardens || fortProvidesBenefit(game, data, map, combat.defender_space, side) || space?.kind === "beach" || ["forest", "mountain", "swamp"].includes(space?.terrain)))
	)
}

function eventRoundMatches(game, value) {
	if (value === true) return true
	return value?.turn === game.turn && value?.round === game.action_round
}

function mayAttackSpace(game, data, side, spaceId) {
	const space = data.spaces[spaceId]
	if (!space || !["land", "beach"].includes(space.kind)) return false
	if (side === AXIS && game.action?.von_paulus_no_soviet_combat && data.pieces.some((piece) => piece?.nation === "su" && game.pieces?.[piece.id] === spaceId)) return false
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

function defenderParticipants(combat) {
	return [...new Set([...(combat.defenders || []), ...(combat.retreated_defenders || [])])]
}

function onMapDefenders(game, combat) {
	return defenderParticipants(combat).filter((pieceId) => isOnMap(game, pieceId))
}

function retreatDistanceForAdvance(combat) {
	if (Number.isInteger(combat.retreat_distance)) return combat.retreat_distance
	if (Array.isArray(combat.retreat_path)) return combat.retreat_path.length
	const paths = Object.values(combat.retreat_paths || {})
	return paths.length ? Math.max(...paths.map((path) => path.length)) : 0
}

function allDefendersEliminatedForAdvance(game, combat) {
	if (combat.advance_outcome) return combat.advance_outcome === "eliminated"
	if (retreatDistanceForAdvance(combat) > 0) return false
	return onMapDefenders(game, combat).length === 0
}

function advanceOrigin(game, combat, pieceId) {
	return combat.advance_origins?.[pieceId] ?? game.pieces[pieceId]
}

function timeOfMudAdvanceCap(game, data, combat, pieceId) {
	const piece = data.pieces[pieceId]
	const origin = advanceOrigin(game, combat, pieceId)
	return game.options?.time_of_mud && game.turn === 3 && [2, 3].includes(game.action_round) && piece?.nation === "ge" && piece?.unit_type === "mechanized" && data.spaces[origin]?.nation === "su" ? 1 : Infinity
}

function advanceLimit(game, data, map, adjacency, combat, pieceId) {
	const piece = data.pieces[pieceId]
	const mechanized = isMechanizedForAdvance(game, data, map, adjacency, pieceId)
	const allDefendersEliminated = allDefendersEliminatedForAdvance(game, combat)
	const retreatDistance = retreatDistanceForAdvance(combat)
	const normal = mechanized ? (allDefendersEliminated || retreatDistance !== 1 ? 3 : 2) : allDefendersEliminated || retreatDistance <= 1 ? 1 : 2
	let absolute = timeOfMudAdvanceCap(game, data, combat, pieceId)
	if (String(piece?.name || "").includes("Shock")) absolute = Math.min(absolute, 1)
	if (Number.isInteger(combat.extra_advance_limit)) absolute = Math.min(absolute, combat.extra_advance_limit)
	return Math.min(normal, absolute)
}

function stopsMechanizedAdvance(game, combat, space) {
	const combatTerrain = space?.id === combat.defender_space
	const krimCancelsFort = combatTerrain && combat.krim
	const devilsGardens = combatTerrain && space?.terrain === "desert" && CombatCards.played(combat, combat.defender_side, 73)
	return !!((space?.fort && !game.destroyed_forts?.includes(space.id) && !krimCancelsFort) || devilsGardens || ["forest", "mountain", "swamp"].includes(space?.terrain))
}

function stopsWinter42GermanAdvance(game, data, pieceId, space) {
	return Weather.isWinter42(game) && data.pieces[pieceId]?.nation === "ge" && space?.nation === "su"
}

function activeCombatMarkerSpaces(game, combat = game.combat) {
	const attacked = new Set(game.action?.attacked || [])
	const markers = new Set((game.action?.attack_spaces || []).filter((spaceId) => !attacked.has(spaceId)))
	for (const spaceId of combat?.origin_spaces || []) markers.add(spaceId)
	return [...markers]
}

function hasActiveCombatMarker(game, spaceId, combat = game.combat) {
	return activeCombatMarkerSpaces(game, combat).includes(spaceId)
}

function mayAdvanceIntoSpace(game, data, adjacency, combat, pieceId, spaceId) {
	if (!Restrictions.mayEnter(game, data, adjacency, pieceId, spaceId)) return false
	const piece = data.pieces[pieceId]
	const resolved = Number.isFinite(combat.defender_loss) && Number.isFinite(combat.attacker_loss)
	if (resolved && game.events?.tito && piece?.nation === "su" && data.spaces[spaceId]?.nation === "yu" && winner(combat) !== combat.attacker_side) return false
	return true
}

function uniqueRoutes(routes) {
	const seen = new Set()
	return routes.filter((route) => {
		const key = route.join(",")
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

function legalNonMechanizedAdvanceRoutes(game, data, map, adjacency, combat, pieceId, limit) {
	const routes = []
	const defender = combat.defender_space
	const side = sideOf(game, data, map, [pieceId])
	if (limit < 1 || map.enemyPiecesInSpace(game, data, side, defender).length) return routes
	const legalPath = (path) =>
		path.length <= limit && path.every((spaceId) => !map.enemyPiecesInSpace(game, data, side, spaceId).length && map.canStack(game, data, pieceId, spaceId) && mayAdvanceIntoSpace(game, data, adjacency, combat, pieceId, spaceId))
	const addRoute = (path) => {
		if (legalPath(path) && !hasActiveCombatMarker(game, path[path.length - 1], combat)) routes.push(path)
	}
	addRoute([defender])
	if (allDefendersEliminatedForAdvance(game, combat) || retreatDistanceForAdvance(combat) < 2 || limit < 2) return uniqueRoutes(routes)
	const retreatPaths = Object.keys(combat.retreat_paths || {}).length ? Object.values(combat.retreat_paths) : combat.retreat_path ? [combat.retreat_path] : []
	for (const retreatPath of retreatPaths) {
		for (let index = 0; index < retreatPath.length - 1; index++) {
			const path = [defender].concat(retreatPath.slice(0, index + 1))
			addRoute(path)
		}
	}
	return uniqueRoutes(routes)
}

function legalAdvanceRoutes(game, data, map, adjacency, combat, pieceId) {
	if (!combat.attackers.includes(pieceId) || !isOnMap(game, pieceId) || combat.advanced?.includes(pieceId)) return []
	const invasionBeach = game.invasion?.beaches?.find((record) => combat.origin_spaces?.includes(record.space_id) && game.pieces[pieceId] === record.space_id)
	if (invasionBeach) {
		const destination = combat.defender_space
		if (
			destination &&
			destination === invasionBeach.connected_land &&
			!map.enemyPiecesInSpace(game, data, sideOf(game, data, map, [pieceId]), destination).length &&
			map.canStack(game, data, pieceId, destination) &&
			mayAdvanceIntoSpace(game, data, adjacency, combat, pieceId, destination)
		)
			return [[destination]]
		return []
	}
	const limit = advanceLimit(game, data, map, adjacency, combat, pieceId)
	if (!isMechanizedForAdvance(game, data, map, adjacency, pieceId)) return legalNonMechanizedAdvanceRoutes(game, data, map, adjacency, combat, pieceId, limit)
	const side = sideOf(game, data, map, [pieceId])
	const from = game.pieces[pieceId]
	const routes = []
	function visit(current, path) {
		if (path.length >= limit) return
		for (const edge of adjacency[current] || []) {
			const next = data.spaces[edge.to]
			if (edge.type === "sr" || next?.kind !== "land" || edge.to === from || path.includes(edge.to)) continue
			const nextPath = path.concat(edge.to)
			if (map.enemyPiecesInSpace(game, data, side, edge.to).length) continue
			if (!mayAdvanceIntoSpace(game, data, adjacency, combat, pieceId, edge.to)) continue
			if (!map.canStack(game, data, pieceId, edge.to)) continue
			if (!hasActiveCombatMarker(game, edge.to, combat)) routes.push(nextPath)
			if (stopsMechanizedAdvance(game, combat, next) || stopsWinter42GermanAdvance(game, data, pieceId, next)) continue
			visit(edge.to, nextPath)
		}
	}
	visit(from, [])
	return uniqueRoutes(routes)
}

function legalAdvancePaths(game, data, map, adjacency, combat, pieceId) {
	const paths = new Map()
	const routes = legalAdvanceRoutes(game, data, map, adjacency, combat, pieceId)
	for (const route of routes.slice().sort((a, b) => a.length - b.length)) {
		const destination = route[route.length - 1]
		if (!paths.has(destination)) paths.set(destination, route)
	}
	return paths
}

module.exports = {
	LCU_COLUMNS,
	LCU_FIRE,
	SCU_COLUMNS,
	SCU_FIRE,
	applyStepLoss,
	activeCombatMarkerSpaces,
	advanceLimit,
	attackersAcrossRiver,
	baseColumn,
	canCancelRetreat,
	combatStrength,
	eliminatePreviouslyRetreated,
	fireColumnLabel,
	fireResult,
	findLcuReplacement,
	hasActiveCombatMarker,
	isOnMap,
	isReduced,
	legalLossChoices,
	legalAdvancePaths,
	legalAdvanceRoutes,
	lossFactor,
	maxReachableLoss,
	mayAttackSpace,
	onMapDefenders,
	preview,
	recordLcuReplacementIdentity,
	replaceEliminatedSouthwestFront,
	resolve,
	setReduced,
	shiftedColumn,
	winner,
}
