"use strict"

const Runtime = require("../runtime.js")
const I18n = require("../core/i18n.js")
const Engine = Object.freeze({
	constants: require("../core/constants.js"),
	state: require("../core/state.js"),
	combat: require("../systems/combat.js"),
	combatCards: require("../systems/combat_cards.js"),
	invasions: require("../systems/invasions.js"),
	logistics: require("../systems/logistics.js"),
	map: require("../systems/map.js"),
	orders: require("../systems/orders.js"),
	replacements: require("../systems/replacements.js"),
	restrictions: require("../systems/restrictions.js"),
	turn: Runtime.turn,
})

const { ALLIED, AXIS, otherSide, roleForSide } = Engine.constants

function pauseForEliminatedTheater(game, data, adjacency, pieceId, outcome, returnState) {
	if (!outcome.eliminated || outcome.permanent || !Engine.replacements.isWesternAlliedLcu(data.pieces[pieceId])) return false
	const classified = Engine.replacements.classifyEliminatedLcu(game, data, Engine.map, adjacency, pieceId, outcome.origin_space_id)
	if (classified.classified) return false
	game.theater_choice = {
		piece_id: pieceId,
		options: classified.options,
		return_state: returnState,
		return_active: game.active,
		reason: "combat",
	}
	game.state = "eliminated_theater_choice"
	game.active = roleForSide(ALLIED)
	return true
}

function combatTargets(game, side, origin, data, adjacency) {
	return (adjacency[origin] || [])
		.filter((edge) => edge.type !== "sr")
		.map((edge) => edge.to)
		.filter((spaceId) => !game.action.defended.includes(spaceId))
		.filter((spaceId) => Engine.map.enemyPiecesInSpace(game, data, side, spaceId).length > 0 || (side === AXIS && Engine.invasions.activeBeachhead(game, spaceId)))
		.filter((spaceId) => Engine.combat.mayAttackSpace(game, data, side, spaceId))
}

function extraAttackTargets(game, data, adjacency) {
	const extra = game.event?.extra_attack
	if (!extra || extra.used || !extra.first_attack_completed || !Engine.combat.isOnMap(game, extra.piece_id)) return []
	if (game.action?.activation_supply?.[extra.piece_id] === "oos") return []
	const origin = game.pieces[extra.piece_id]
	const side = Engine.map.pieceSide(game, data, extra.piece_id)
	return (adjacency[origin] || [])
		.filter((edge) => edge.type !== "sr")
		.map((edge) => edge.to)
		.filter((spaceId) => !game.action?.defended?.includes(spaceId))
		.filter((spaceId) => Engine.map.enemyPiecesInSpace(game, data, side, spaceId).length > 0 || (side === AXIS && Engine.invasions.activeBeachhead(game, spaceId)))
		.filter((spaceId) => Engine.combat.mayAttackSpace(game, data, side, spaceId))
}

function extraAttackAvailable(game, data, adjacency) {
	return extraAttackTargets(game, data, adjacency).length > 0
}

function currentRoundRetreatedPieces(game, spaceId) {
	const pieces = new Set()
	for (const entry of game.retreat_history || []) {
		if (entry.turn !== game.turn || entry.round !== game.action_round) continue
		for (const pieceId of entry.pieces || []) if (game.pieces[pieceId] === spaceId) pieces.add(pieceId)
	}
	return pieces
}

function unusedPiecesInSpace(game, data, side, spaceId) {
	return Engine.map.friendlyPiecesInSpace(game, data, side, spaceId).filter((pieceId) => !game.action.used_pieces.includes(pieceId))
}

function availableCombatOrigins(game, data, adjacency) {
	const side = Engine.constants.sideForRole(game.active)
	return game.action.attack_spaces.filter((spaceId) => unusedPiecesInSpace(game, data, side, spaceId).length && combatTargets(game, side, spaceId, data, adjacency).length)
}

function invasionCombatPending(game, data) {
	return Engine.invasions.pendingCombatBeaches(game, data, Engine.map).length > 0
}

function combatOrigins(game, pieceIds) {
	return [...new Set(pieceIds.map((pieceId) => game.pieces[pieceId]))].sort((a, b) => a - b)
}

function mechanizedOrigins(game, data, adjacency, pieceIds) {
	const origins = new Set()
	for (const pieceId of pieceIds) if (Engine.map.isMechanizedInSupply(game, data, adjacency, pieceId)) origins.add(game.pieces[pieceId])
	return origins
}

function normalizedCombatOrigins(game, data, adjacency, selected) {
	const origins = combatOrigins(game, selected)
	if (!origins.length) return null
	const mechanized = mechanizedOrigins(game, data, adjacency, selected)
	const withoutMechanized = origins.filter((origin) => !mechanized.has(origin))
	if (withoutMechanized.length > 1) return null
	const primary = withoutMechanized[0] ?? origins[0]
	return [primary, ...origins.filter((origin) => origin !== primary)]
}

function commonCombatTargets(game, data, adjacency, side, origins) {
	if (!origins.length) return []
	const targets = combatTargets(game, side, origins[0], data, adjacency)
	return targets.filter((target) => origins.slice(1).every((origin) => (adjacency[origin] || []).some((edge) => edge.type !== "sr" && edge.to === target)))
}

function combatSelectionTargets(game, data, adjacency, selected = game.combat?.attackers || []) {
	if (!selected.length) return []
	const origins = normalizedCombatOrigins(game, data, adjacency, selected)
	if (!origins) return []
	const side = Engine.constants.sideForRole(game.active)
	return commonCombatTargets(game, data, adjacency, side, origins)
}

function allCombatSelectionPieces(game, data, adjacency) {
	const side = Engine.constants.sideForRole(game.active)
	return availableCombatOrigins(game, data, adjacency).flatMap((spaceId) => unusedPiecesInSpace(game, data, side, spaceId))
}

function combatSelectionCanBeCompleted(game, data, adjacency, selected) {
	const origins = combatOrigins(game, selected)
	if (!origins.length) return false
	const side = Engine.constants.sideForRole(game.active)
	if (!commonCombatTargets(game, data, adjacency, side, origins).length) return false
	const available = origins.flatMap((origin) => unusedPiecesInSpace(game, data, side, origin))
	const potentiallyMechanized = mechanizedOrigins(game, data, adjacency, available)
	return origins.filter((origin) => !potentiallyMechanized.has(origin)).length <= 1
}

function combatSelectionCandidates(game, data, adjacency) {
	const selected = game.combat?.attackers || []
	return allCombatSelectionPieces(game, data, adjacency).filter((pieceId) => selected.includes(pieceId) || combatSelectionCanBeCompleted(game, data, adjacency, selected.concat(pieceId)))
}

function syncCombatOrigins(game, data, adjacency) {
	if (!game.combat) return
	game.combat.origin_spaces = normalizedCombatOrigins(game, data, adjacency, game.combat.attackers) || combatOrigins(game, game.combat.attackers)
}

function combatAttackerCandidates(game, data) {
	const side = Engine.constants.sideForRole(game.active)
	return game.combat.origin_spaces.flatMap((spaceId) => unusedPiecesInSpace(game, data, side, spaceId))
}

function advanceCandidates(game, data, adjacency) {
	return onMapParticipants(game, "attackers").filter((pieceId) => !game.combat.advanced.includes(pieceId) && Engine.combat.legalAdvancePaths(game, data, Engine.map, adjacency, game.combat, pieceId).size)
}

function uniqueAdvanceRoutes(routes) {
	const seen = new Set()
	return routes.filter((route) => {
		const key = route.join(",")
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

function initialAdvanceRoutes(game, data, adjacency, pieceId) {
	return uniqueAdvanceRoutes([...Engine.combat.legalAdvancePaths(game, data, Engine.map, adjacency, game.combat, pieceId).values()].map((path) => path.slice()))
}

function advanceRoutesForPieces(game, data, adjacency, pieceIds) {
	const stored = game.combat.advance_routes
	return Object.fromEntries(pieceIds.map((pieceId) => [pieceId, stored?.[pieceId]?.map((route) => route.slice()) || initialAdvanceRoutes(game, data, adjacency, pieceId)]))
}

function advanceRouteCanStop(routes) {
	return routes.some((route) => route.length === 0)
}

function advanceRouteNextSpaces(routes) {
	return [...new Set(routes.filter((route) => route.length).map((route) => route[0]))]
}

function advanceRoutesAfterStep(routes, destination) {
	return routes.filter((route) => route[0] === destination).map((route) => route.slice(1))
}

function commonRouteNextSpaces(routesByPiece, pieceIds) {
	if (!pieceIds.length) return []
	const first = advanceRouteNextSpaces(routesByPiece[pieceIds[0]] || [])
	return first.filter((destination) => pieceIds.slice(1).every((pieceId) => advanceRouteNextSpaces(routesByPiece[pieceId] || []).includes(destination)))
}

function advanceGroupCanFinish(game, data, routesByPiece, pieceIds) {
	const required = pieceIds.filter((pieceId) => !advanceRouteCanStop(routesByPiece[pieceId] || []))
	if (!required.length) return true
	for (const destination of commonRouteNextSpaces(routesByPiece, required)) {
		if (!Engine.map.canStackFormation(game, data, required, destination)) continue
		const nextRoutes = Object.fromEntries(required.map((pieceId) => [pieceId, advanceRoutesAfterStep(routesByPiece[pieceId], destination)]))
		if (advanceGroupCanFinish(game, data, nextRoutes, required)) return true
	}
	return false
}

function commonAdvanceSteps(game, data, adjacency, pieceIds) {
	if (!pieceIds.length) return []
	const routesByPiece = advanceRoutesForPieces(game, data, adjacency, pieceIds)
	return commonRouteNextSpaces(routesByPiece, pieceIds).filter((destination) => {
		if (!Engine.map.canStackFormation(game, data, pieceIds, destination)) return false
		const nextRoutes = Object.fromEntries(pieceIds.map((pieceId) => [pieceId, advanceRoutesAfterStep(routesByPiece[pieceId], destination)]))
		return advanceGroupCanFinish(game, data, nextRoutes, pieceIds)
	})
}

function selectableAdvancePieces(game, data, adjacency) {
	const selected = game.combat.advance_pieces || []
	return advanceCandidates(game, data, adjacency).filter((pieceId) => selected.includes(pieceId) || commonAdvanceSteps(game, data, adjacency, selected.concat(pieceId)).length)
}

function clearAdvanceGroupIfEmpty(game) {
	if (game.combat.advance_pieces?.length) return
	delete game.combat.advance_pieces
	delete game.combat.advance_routes
}

function completeAdvancePieces(game, pieceIds) {
	const completed = new Set(pieceIds)
	for (const pieceId of pieceIds) {
		if (!game.combat.advanced.includes(pieceId)) game.combat.advanced.push(pieceId)
		if (game.combat.advance_routes) delete game.combat.advance_routes[pieceId]
	}
	game.combat.advance_pieces = (game.combat.advance_pieces || []).filter((pieceId) => !completed.has(pieceId))
	clearAdvanceGroupIfEmpty(game)
}

function groupedSelection(handler) {
	Object.defineProperty(handler, "undo_group", { value: "selection" })
	return handler
}

function restoreTo(state) {
	const handler = function restoreCombatSelection() {}
	Object.defineProperty(handler, "undo_restore_state", { value: state })
	return handler
}

const toggleCombatAttacker = groupedSelection(function toggleCombatAttacker(game, role, noun, { data, adjacency }) {
	const pieceId = Number(noun)
	if (!game.combat) {
		game.combat = {
			origin_spaces: [game.pieces[pieceId]],
			defender_space: null,
			attackers: [],
			defenders: [],
		}
	}
	const index = game.combat.attackers.indexOf(pieceId)
	if (index < 0) game.combat.attackers.push(pieceId)
	else game.combat.attackers.splice(index, 1)
	if (!game.combat.attackers.length) game.combat = null
	else syncCombatOrigins(game, data, adjacency)
})

const toggleAdvancePiece = groupedSelection(function toggleAdvancePiece(game, role, noun) {
	const pieceId = Number(noun)
	const selected = (game.combat.advance_pieces ||= [])
	const index = selected.indexOf(pieceId)
	if (game.combat.advance_routes) {
		if (index >= 0 && advanceRouteCanStop(game.combat.advance_routes[pieceId] || [])) completeAdvancePieces(game, [pieceId])
		return
	}
	if (index < 0) selected.push(pieceId)
	else selected.splice(index, 1)
	clearAdvanceGroupIfEmpty(game)
})

const selectAllCombatAttackers = groupedSelection(function selectAllCombatAttackers(game, role, noun, { data, adjacency }) {
	game.combat.attackers = combatAttackerCandidates(game, data)
	syncCombatOrigins(game, data, adjacency)
})

function onMapParticipants(game, key) {
	return game.combat[key].filter((pieceId) => Engine.combat.isOnMap(game, pieceId))
}

function resumeCombatOperations(game, data, adjacency, side) {
	game.active = roleForSide(side)
	if (availableCombatOrigins(game, data, adjacency).length || invasionCombatPending(game, data)) game.state = "ops_combat"
	else if (extraAttackAvailable(game, data, adjacency)) game.state = "event_extra_attack_prompt"
	else Engine.turn.finishAction(game, side)
}

function finishCombat(game, data, adjacency) {
	const completed = game.combat
	const side = completed.attacker_side
	for (const origin of completed.origin_spaces) if (!game.action.attacked.includes(origin)) game.action.attacked.push(origin)
	if (!game.action.defended.includes(completed.defender_space)) game.action.defended.push(completed.defender_space)
	game.last_combat = completed
	game.combat = null
	if (completed.extra_attack) {
		if (game.event?.extra_attack) game.event.extra_attack.used = true
		Engine.turn.finishAction(game, side)
		return
	}
	resumeCombatOperations(game, data, adjacency, side)
}

function beginAdvance(game) {
	game.combat.advanced = []
	delete game.combat.advance_pieces
	delete game.combat.advance_routes
	game.active = roleForSide(game.combat.attacker_side)
	game.state = "combat_advance"
}

function pathEndsInSupply(game, data, adjacency, pieceId, path) {
	const piece = data.pieces[pieceId]
	return Engine.map.traceSupply(game, data, adjacency, Engine.map.pieceSide(game, data, pieceId), path[path.length - 1], piece.nation) !== "oos"
}

function enumerateRetreatPaths(game, data, adjacency, pieceId) {
	const combat = game.combat
	const piece = data.pieces[pieceId]
	const side = Engine.map.pieceSide(game, data, pieceId)
	const paths = []
	function visit(current, path) {
		if (path.length >= combat.retreat_distance) return paths.push(path.slice())
		for (const edge of adjacency[current] || []) {
			const destination = edge.to
			if (edge.type === "sr" || data.spaces[destination]?.kind !== "land" || destination === combat.defender_space || path.includes(destination)) continue
			if (Engine.map.enemyPiecesInSpace(game, data, side, destination).length) continue
			if (!Engine.restrictions.mayEnter(game, data, adjacency, pieceId, destination)) continue
			const next = path.concat(destination)
			if (side === AXIS && game.partisans.includes(destination)) paths.push(next)
			else visit(destination, next)
		}
	}
	visit(combat.defender_space, [])
	return paths.filter((path) => {
		const destination = path[path.length - 1]
		if (!destination || !Engine.map.canStack(game, data, pieceId, destination)) return false
		if (game.turn === 1 && piece.nation === "su" && combat.retreat_distance === 2) {
			if (path.length < 2 || (adjacency[combat.defender_space] || []).some((edge) => edge.to === destination)) return false
		}
		return true
	})
}

function preferredRetreatPaths(game, data, adjacency, pieceId) {
	let paths = enumerateRetreatPaths(game, data, adjacency, pieceId)
	if (!paths.length) return paths
	const side = Engine.map.pieceSide(game, data, pieceId)
	const withoutPartisans = paths.filter((path) => !path.some((spaceId) => game.partisans.includes(spaceId)))
	if (withoutPartisans.length) paths = withoutPartisans
	const longest = Math.max(...paths.map((path) => path.length))
	for (let index = 0; index < longest; index++) {
		const friendly = paths.filter((path) => path.length > index && game.control[path[index]] === side)
		if (friendly.length) paths = friendly
	}
	const supplied = paths.filter((path) => pathEndsInSupply(game, data, adjacency, pieceId, path))
	return supplied.length ? supplied : paths
}

function retreatDestinations(game, data, adjacency) {
	if (!game.combat.retreat_piece) return []
	const prefix = game.combat.retreat_prefix || []
	const paths = game.combat.retreat_options || preferredRetreatPaths(game, data, adjacency, game.combat.retreat_piece)
	return [...new Set(paths.filter((path) => prefix.every((spaceId, index) => path[index] === spaceId) && path.length > prefix.length).map((path) => path[prefix.length]))]
}

function eliminateFailedRetreat(game, data, pieceId) {
	const pieceRef = Engine.state.pieceLogRef(game, pieceId)
	const originSpaceId = game.pieces[pieceId]
	Engine.logistics.eliminateForAttrition(game, data, pieceId)
	Engine.state.log(game, "combat.log.failed_retreat", { piece: pieceRef }, "detail2")
	Engine.invasions.removeDefeatedBeachhead(game, data, Engine.map, originSpaceId)
}

function prepareRetreat(game, data, adjacency) {
	for (const pieceId of game.combat.retreat_pending.slice()) {
		if (preferredRetreatPaths(game, data, adjacency, pieceId).length) continue
		eliminateFailedRetreat(game, data, pieceId)
		game.combat.retreat_pending.splice(game.combat.retreat_pending.indexOf(pieceId), 1)
	}
}

function startRetreat(game, data, adjacency) {
	game.combat.retreat_distance = Math.abs(game.combat.defender_loss - game.combat.attacker_loss) === 1 ? 1 : 2
	game.combat.retreat_pending = onMapParticipants(game, "defenders")
	game.combat.retreat_paths = {}
	game.combat.retreat_vacated = [game.combat.defender_space]
	Engine.state.log(game, "combat.log.retreat_heading", { distance: game.combat.retreat_distance }, "strong")
	game.active = roleForSide(game.combat.defender_side)
	game.state = "combat_retreat"
	prepareRetreat(game, data, adjacency)
}

function finishLosses(game, data, adjacency) {
	const combat = game.combat
	const survivingDefenders = onMapParticipants(game, "defenders")
	if (Engine.combat.winner(combat) === combat.attacker_side) {
		if (!survivingDefenders.length) {
			return beginAdvance(game)
		}
		if (Engine.combat.canCancelRetreat(game, data, Engine.map, adjacency, combat)) {
			game.active = roleForSide(combat.defender_side)
			game.state = "combat_retreat_option"
			return
		}
		return startRetreat(game, data, adjacency)
	}
	finishCombat(game, data, adjacency)
}

function noRetreatLossChoices(game, data) {
	return onMapParticipants(game, "defenders").filter((pieceId) => {
		const copy = Engine.state.clone(game)
		Engine.combat.applyStepLoss(copy, data, copy.combat, pieceId)
		return copy.combat.defenders.some((defenderId) => Engine.combat.isOnMap(copy, defenderId))
	})
}

function logCombatOverview(game) {
	const combat = game.combat
	const prefix = combat.attacker_side === ALLIED ? "#ap" : "#cp"
	Engine.state.log(game, "core.blank")
	Engine.state.log(game, "combat.log.overview", { space: `s${combat.defender_space}` }, prefix === "#ap" ? "heading_allied" : "heading_axis")
	Engine.state.log(game, "combat.log.attacker", {}, "strong")
	for (const origin of combat.origin_spaces) {
		const attackers = combat.attackers.filter((pieceId) => game.pieces[pieceId] === origin)
		if (attackers.length)
			Engine.state.log(
				game,
				"combat.log.attackers",
				{
					pieces: I18n.list(attackers.map((pieceId) => Engine.state.pieceLogRef(game, pieceId))),
					origin: `s${origin}`,
				},
				"detail2",
			)
	}
	Engine.state.log(game, "combat.log.defender", {}, "strong")
	if (combat.defenders.length) Engine.state.log(game, "combat.log.defenders", { pieces: I18n.list(combat.defenders.map((pieceId) => Engine.state.pieceLogRef(game, pieceId))) }, "detail2")
	else Engine.state.log(game, "combat.log.defender_none", {}, "detail2")
	if (combat.retreated_defenders?.length) Engine.state.log(game, "combat.log.defenders_retreated", { pieces: I18n.list(combat.retreated_defenders.map((pieceId) => Engine.state.pieceLogRef(game, pieceId))) }, "detail2")
	Engine.state.log(game, "combat.log.cards", {}, "strong")
}

function combatDieLog(combat, role) {
	return Engine.state.formatDie(combat[`${role}_side`], combat[`${role}_die_raw`], combat[`${role}_drm`], combat[`${role}_die`])
}

function signedModifier(value) {
	const amount = Number(value) || 0
	return amount > 0 ? `+${amount}` : String(amount)
}

function terrainModifierSource(terrain) {
	const terrainKey = {
		beach: "combat.log.modifier.beach",
		fort: "combat.log.modifier.fort",
		mountain: "ui.terrain.mountain",
		swamp: "ui.terrain.swamp",
		urban: "combat.log.modifier.urban",
	}[terrain]
	return I18n.message(terrainKey || "combat.log.modifier.terrain")
}

function modifierSource(factor) {
	switch (factor.reason) {
		case "terrain":
			return terrainModifierSource(factor.terrain)
		case "trench":
			return I18n.message("combat.log.modifier.trench")
		case "river":
			return I18n.message("combat.log.modifier.river")
		case "winter_1942":
			return I18n.message("combat.log.modifier.winter_1942")
		case "oos":
			return I18n.message("combat.log.modifier.oos")
		case "combat_card":
			return I18n.message("combat.log.modifier.combat_card", { card: `c${factor.card_id}` })
		case "event":
			return factor.card_id ? I18n.message("combat.log.modifier.event", { card: `c${factor.card_id}` }) : I18n.message("combat.log.modifier.event_generic")
		default:
			return I18n.message("combat.log.modifier.other")
	}
}

function modifierSummary(factors) {
	if (!factors?.length) return I18n.message("core.none")
	return I18n.list(
		factors.map((factor) =>
			I18n.message("combat.log.modifier.factor", {
				amount: signedModifier(factor.amount),
				source: modifierSource(factor),
			}),
		),
	)
}

function logFireResult(game, combat, role, loss) {
	const table = combat[`${role}_table`]
	const factors = combat[`${role}_shift_factors`] || []
	const params = {
		die: combatDieLog(combat, role),
		column: Engine.combat.fireColumnLabel(table, combat[`${role}_column`]),
		loss,
	}
	if (factors.length) {
		params.base_column = Engine.combat.fireColumnLabel(table, combat[`${role}_base_column`])
		Engine.state.log(game, "combat.log.fire_result_shifted", params, "detail")
	} else Engine.state.log(game, "combat.log.fire_result", params, "detail")
}

function logCombatResolution(game, combat) {
	Engine.state.log(game, "combat.log.column_shifts", {}, "strong")
	Engine.state.log(game, "combat.log.attacker_modifiers", { modifiers: modifierSummary(combat.attacker_shift_factors) }, "detail2")
	Engine.state.log(game, "combat.log.defender_modifiers", { modifiers: modifierSummary(combat.defender_shift_factors) }, "detail2")

	Engine.state.log(game, "combat.log.attacker_fire", { strength: combat.attacker_strength, table: combat.attacker_table.toUpperCase() }, "strong")
	Engine.state.log(game, "combat.log.drm", { modifiers: modifierSummary(combat.attacker_drm_factors) }, "detail2")
	logFireResult(game, combat, "attacker", combat.defender_loss)

	Engine.state.log(game, "combat.log.defender_fire", { strength: combat.defender_strength, table: combat.defender_table.toUpperCase() }, "strong")
	Engine.state.log(game, "combat.log.drm", { modifiers: modifierSummary(combat.defender_drm_factors) }, "detail2")
	logFireResult(game, combat, "defender", combat.attacker_loss)

	const outcomeKey = combat.defender_loss > combat.attacker_loss ? "combat.log.outcome_attacker" : combat.attacker_loss > combat.defender_loss ? "combat.log.outcome_defender" : "combat.log.outcome_draw"
	Engine.state.log(game, outcomeKey, { defender_loss: combat.defender_loss, attacker_loss: combat.attacker_loss }, "bold")
}

function logStepLoss(game, pieceId, outcome) {
	if (!outcome.eliminated) {
		Engine.state.log(game, "combat.log.reduced", { piece: Engine.state.pieceLogRef(game, pieceId, false) }, "detail2")
		return
	}
	const params = { piece: Engine.state.pieceLogRef(game, pieceId, true) }
	if (outcome.replacement) {
		params.replacement = Engine.state.pieceLogRef(game, outcome.replacement)
		Engine.state.log(game, outcome.permanent ? "combat.log.eliminated_replaced_permanent" : "combat.log.eliminated_replaced", params, "detail2")
	} else Engine.state.log(game, outcome.permanent ? "combat.log.eliminated_permanent" : "combat.log.eliminated", params, "detail2")
}

function removeDefeatedBeachheadAfterLoss(game, data, outcome) {
	if (!outcome?.eliminated) return false
	return Engine.invasions.removeDefeatedBeachhead(game, data, Engine.map, outcome.origin_space_id)
}

function resolveSelectedCombat(game, data, adjacency) {
	const combat = game.combat
	const attackers = combat.attackers.filter((pieceId) => Engine.combat.isOnMap(game, pieceId))
	const extra = game.event?.extra_attack
	if (!combat.extra_attack && extra && attackers.includes(extra.piece_id)) extra.first_attack_completed = true
	if (attackers.length) Engine.combat.resolve(game, data, Engine.map, adjacency, combat)
	else
		Object.assign(combat, {
			attacker_strength: 0,
			defender_strength: combat.defenders.reduce((sum, pieceId) => sum + (Engine.combat.isOnMap(game, pieceId) ? Engine.combat.combatStrength(game, data, pieceId) : 0), 0),
			attacker_die_raw: null,
			defender_die_raw: null,
			attacker_drm: Engine.combatCards.drm(combat, combat.attacker_side),
			defender_drm: Engine.combatCards.drm(combat, combat.defender_side),
			attacker_die: null,
			defender_die: null,
			defender_loss: 0,
			attacker_loss: 1,
			defender_loss_taken: 0,
			attacker_loss_taken: 1,
			southwest_loss_taken: false,
		})
	Engine.combatCards.finalize(game, data, combat)
	if (combat.defender_loss >= 1)
		for (const pieceId of combat.retreated_defenders)
			if (Engine.combat.isOnMap(game, pieceId)) {
				const pieceRef = Engine.state.pieceLogRef(game, pieceId, true)
				const outcome = Engine.combat.eliminatePreviouslyRetreated(game, data, pieceId)
				Engine.state.log(game, "combat.log.previously_retreated_eliminated", { piece: pieceRef }, "detail2")
				removeDefeatedBeachheadAfterLoss(game, data, { ...outcome, eliminated: true })
			}
	Engine.orders.fulfillForCombat(game, data, combat)
	for (const pieceId of combat.attackers) if (!game.action.used_pieces.includes(pieceId)) game.action.used_pieces.push(pieceId)
	Engine.state.clearUndo(game)
	if (attackers.length) logCombatResolution(game, combat)
	else Engine.state.log(game, "combat.log.attacker_aborted", { space: `s${combat.defender_space}` }, "detail2")
	if (!attackers.length) return finishCombat(game, data, adjacency)
	if (combat.defender_loss > 0) Engine.state.log(game, "combat.log.defender_takes_losses", {}, "strong")
	game.active = roleForSide(combat.defender_side)
	game.state = "combat_defender_losses"
}

function validatedCombatOrigins(game, data, adjacency, side, spaceId) {
	const origins = normalizedCombatOrigins(game, data, adjacency, game.combat.attackers)
	if (!origins || !commonCombatTargets(game, data, adjacency, side, origins).includes(spaceId)) throw new Error("illegal multi-space combat")
	return origins
}

function prepareCombatTarget(game, role, spaceId, data, adjacency) {
	const side = Engine.constants.sideForRole(role)
	game.combat.origin_spaces = validatedCombatOrigins(game, data, adjacency, side, spaceId)
	const allDefenders = Engine.map.enemyPiecesInSpace(game, data, side, spaceId)
	const retreated = currentRoundRetreatedPieces(game, spaceId)
	game.combat.defender_space = spaceId
	game.combat.retreated_defenders = allDefenders.filter((pieceId) => retreated.has(pieceId))
	game.combat.defenders = allDefenders.filter((pieceId) => !retreated.has(pieceId))
	game.combat.attacker_side = side
	game.combat.defender_side = otherSide(side)
	game.combat.krim = side === AXIS && game.event?.card_id === 68 && game.event?.krim_space === spaceId
	game.combat.zitadelle_objective =
		side === AXIS && game.event?.card_id === 82 && data.spaces[spaceId]?.nation === "su" && game.control[spaceId] === ALLIED && allDefenders.filter((pieceId) => data.pieces[pieceId]?.size === "lcu").length >= 2
}

function prepareExtraCombat(game, data, spaceId) {
	const extra = game.event.extra_attack
	const pieceId = extra.piece_id
	const side = Engine.map.pieceSide(game, data, pieceId)
	const allDefenders = Engine.map.enemyPiecesInSpace(game, data, side, spaceId)
	const retreated = currentRoundRetreatedPieces(game, spaceId)
	game.combat = {
		origin_spaces: [game.pieces[pieceId]],
		defender_space: spaceId,
		attackers: [pieceId],
		defenders: allDefenders.filter((defenderId) => !retreated.has(defenderId)),
		retreated_defenders: allDefenders.filter((defenderId) => retreated.has(defenderId)),
		attacker_side: side,
		defender_side: otherSide(side),
		extra_attack: true,
		extra_advance_limit: extra.advance_limit,
	}
}

function combatConfirmationPrompt(game, data, adjacency) {
	const combat = game.combat
	const target = data.spaces[combat.defender_space]?.name || `s${combat.defender_space}`
	if (!combat.defenders.length && !combat.retreated_defenders.length && Engine.invasions.activeBeachhead(game, combat.defender_space)) {
		return { key: "combat.confirm.empty_beachhead", params: { target } }
	}
	const preview = Engine.combat.preview(game, data, Engine.map, adjacency, combat)
	return {
		key: "combat.confirm",
		params: {
			target,
			attacker: preview.attacker_strength,
			defender: preview.defender_strength,
		},
	}
}

function confirmCombatSelection(game, data, adjacency) {
	const combat = game.combat
	const side = combat.attacker_side
	if (!combat.extra_attack) combat.origin_spaces = validatedCombatOrigins(game, data, adjacency, side, combat.defender_space)
	if (side === AXIS && !combat.defenders.length && Engine.invasions.activeBeachhead(game, combat.defender_space)) {
		for (const pieceId of combat.attackers) if (!game.action.used_pieces.includes(pieceId)) game.action.used_pieces.push(pieceId)
		for (const origin of combat.origin_spaces) if (!game.action.attacked.includes(origin)) game.action.attacked.push(origin)
		if (!game.action.defended.includes(combat.defender_space)) game.action.defended.push(combat.defender_space)
		Engine.invasions.removeBeachhead(game, data, combat.defender_space, "遭轴心国攻击且没有守军")
		Engine.state.log(game, "combat.log.beachhead_removed")
		game.combat = null
		Engine.state.clearUndo(game)
		resumeCombatOperations(game, data, adjacency, side)
		return
	}
	combat.cc_played = { [ALLIED]: [], [AXIS]: [] }
	combat.cc_from_hand = { [ALLIED]: [], [AXIS]: [] }
	Engine.state.clearUndo(game)
	logCombatOverview(game)
	game.state = "combat_attacker_cc"
}

function register(registerState) {
	registerState("ops_combat", {
		prompt(result, game, role, { data, adjacency }) {
			result.prompt("combat.select_attack")
			const candidates = combatSelectionCandidates(game, data, adjacency)
			if (candidates.length) result.action("piece", candidates)
			const selected = game.combat?.attackers || []
			if (selected.length) {
				result.action("space", combatSelectionTargets(game, data, adjacency))
				const originCandidates = combatAttackerCandidates(game, data)
				if (originCandidates.some((pieceId) => !selected.includes(pieceId)) && combatSelectionTargets(game, data, adjacency, originCandidates).length) result.action("select_all")
				result.action("cancel_selection")
			} else if (!invasionCombatPending(game, data)) result.action("done")
		},
		piece: toggleCombatAttacker,
		select_all: selectAllCombatAttackers,
		space(game, role, noun, { data, adjacency }) {
			prepareCombatTarget(game, role, Number(noun), data, adjacency)
			game.state = "combat_confirm"
		},
		cancel_selection: restoreTo("ops_combat"),
		done(game, role, noun, { data, adjacency }) {
			const side = Engine.constants.sideForRole(role)
			if (extraAttackAvailable(game, data, adjacency)) game.state = "event_extra_attack_prompt"
			else Engine.turn.finishAction(game, side)
		},
	})

	registerState("combat_confirm", {
		prompt(result, game, role, { data, adjacency }) {
			result.prompt(combatConfirmationPrompt(game, data, adjacency))
			result.action("confirm")
			result.action("cancel")
		},
		confirm(game, role, noun, { data, adjacency }) {
			confirmCombatSelection(game, data, adjacency)
		},
		cancel: restoreTo("ops_combat"),
	})

	registerState("event_extra_attack_prompt", {
		prompt(result, game) {
			result.prompt("combat.extra_attack.confirm", { event: game.event?.extra_attack?.label || "Event" })
			result.action("yes")
			result.action("no")
		},
		yes(game) {
			game.state = "event_extra_attack_target"
		},
		no(game) {
			Engine.turn.finishAction(game, Engine.constants.sideForRole(game.active))
		},
	})

	registerState("event_extra_attack_target", {
		prompt(result, game, role, { data, adjacency }) {
			result.prompt("combat.extra_attack.target", { event: game.event?.extra_attack?.label || "Event" })
			result.action("space", extraAttackTargets(game, data, adjacency))
			result.action("cancel")
		},
		space(game, role, noun, { data }) {
			prepareExtraCombat(game, data, Number(noun))
			game.state = "event_extra_attack_confirm"
		},
		cancel(game) {
			game.state = "event_extra_attack_prompt"
		},
	})

	registerState("event_extra_attack_confirm", {
		prompt(result, game, role, { data, adjacency }) {
			result.prompt(combatConfirmationPrompt(game, data, adjacency))
			result.action("confirm")
			result.action("cancel")
		},
		confirm(game, role, noun, { data, adjacency }) {
			confirmCombatSelection(game, data, adjacency)
		},
		cancel(game) {
			game.combat = null
			game.state = "event_extra_attack_target"
		},
	})

	registerState("combat_attacker_cc", {
		undo: false,
		prompt(result, game, role, { data, adjacency }) {
			const cards = Engine.combatCards.available(game, data, Engine.map, adjacency, game.combat, game.combat.attacker_side)
			result.prompt(cards.length ? "combat.attacker.cards" : "combat.attacker.cards_none")
			result.action("card", cards)
			result.action("continue")
		},
		card(game, role, noun, { data }) {
			Engine.combatCards.play(game, data, game.combat.attacker_side, Number(noun))
		},
		continue(game) {
			if (!game.combat.cc_played[game.combat.attacker_side].length) Engine.state.log(game, "combat.log.attacker_none", {}, "detail2")
			game.active = roleForSide(game.combat.defender_side)
			game.state = "combat_defender_cc"
		},
	})

	registerState("combat_defender_cc", {
		undo: false,
		prompt(result, game, role, { data, adjacency }) {
			const cards = Engine.combatCards.available(game, data, Engine.map, adjacency, game.combat, game.combat.defender_side)
			result.prompt(cards.length ? "combat.defender.cards" : "combat.defender.cards_none")
			result.action("card", cards)
			result.action("continue")
		},
		card(game, role, noun, { data }) {
			Engine.combatCards.play(game, data, game.combat.defender_side, Number(noun))
		},
		continue(game, role, noun, { data, adjacency }) {
			if (!game.combat.cc_played[game.combat.defender_side].length) Engine.state.log(game, "combat.log.defender_none", {}, "detail2")
			const targets = Engine.combatCards.panzerfaustTargets(game, data, game.combat)
			if (targets.length) {
				game.active = roleForSide(AXIS)
				game.state = "combat_panzerfaust"
			} else resolveSelectedCombat(game, data, adjacency)
		},
	})

	registerState("combat_panzerfaust", {
		undo: false,
		prompt(result, game, role, { data }) {
			result.prompt("combat.panzerfaust.loss")
			result.action("piece", Engine.combatCards.panzerfaustTargets(game, data, game.combat))
		},
		piece(game, role, noun, { data, adjacency }) {
			const pieceId = Number(noun)
			const pieceRef = Engine.state.pieceLogRef(game, pieceId)
			const outcome = Engine.combat.applyStepLoss(game, data, game.combat, pieceId)
			Engine.state.log(game, "combat.log.panzerfaust", { piece: pieceRef })
			removeDefeatedBeachheadAfterLoss(game, data, outcome)
			resolveSelectedCombat(game, data, adjacency)
		},
	})

	registerState("combat_defender_losses", {
		prompt(result, game, role, { data }) {
			const remaining = game.combat.defender_loss - game.combat.defender_loss_taken
			result.prompt("combat.defender.losses", { remaining: Math.max(0, remaining) })
			const choices = Engine.combat.legalLossChoices(game, data, game.combat, "defenders", remaining)
			if (choices.length) result.action("piece", choices)
			else result.action("continue")
		},
		piece(game, role, noun, { data, adjacency }) {
			const remaining = game.combat.defender_loss - game.combat.defender_loss_taken
			const pieceId = Number(noun)
			const outcome = Engine.combat.applyStepLoss(game, data, game.combat, pieceId, remaining)
			game.combat.defender_loss_taken += outcome.cost
			logStepLoss(game, pieceId, outcome)
			removeDefeatedBeachheadAfterLoss(game, data, outcome)
			pauseForEliminatedTheater(game, data, adjacency, pieceId, outcome, "combat_defender_losses")
		},
		continue(game) {
			Engine.state.clearUndo(game)
			if (game.combat.attacker_loss > 0) Engine.state.log(game, "combat.log.attacker_takes_losses", {}, "strong")
			game.active = roleForSide(game.combat.attacker_side)
			game.state = "combat_attacker_losses"
		},
	})

	registerState("combat_attacker_losses", {
		prompt(result, game, role, { data }) {
			const remaining = game.combat.attacker_loss - game.combat.attacker_loss_taken
			result.prompt("combat.attacker.losses", { remaining: Math.max(0, remaining) })
			const choices = Engine.combat.legalLossChoices(game, data, game.combat, "attackers", remaining)
			if (choices.length) result.action("piece", choices)
			else result.action("continue")
		},
		piece(game, role, noun, { data, adjacency }) {
			const remaining = game.combat.attacker_loss - game.combat.attacker_loss_taken
			const pieceId = Number(noun)
			const outcome = Engine.combat.applyStepLoss(game, data, game.combat, pieceId, remaining)
			game.combat.attacker_loss_taken += outcome.cost
			logStepLoss(game, pieceId, outcome)
			removeDefeatedBeachheadAfterLoss(game, data, outcome)
			pauseForEliminatedTheater(game, data, adjacency, pieceId, outcome, "combat_attacker_losses")
		},
		continue(game, role, noun, { data, adjacency }) {
			Engine.state.clearUndo(game)
			finishLosses(game, data, adjacency)
		},
	})

	registerState("combat_retreat_option", {
		prompt(result, game, role, { data }) {
			if (game.combat.retreat_cancelled) {
				result.prompt("combat.retreat.cancel_complete")
				result.action("done")
				return
			}
			result.prompt("combat.retreat.cancel_option")
			const choices = noRetreatLossChoices(game, data)
			if (choices.length) result.action("piece", choices)
			result.action("continue")
		},
		piece(game, role, noun, { data, adjacency }) {
			const pieceId = Number(noun)
			const outcome = Engine.combat.applyStepLoss(game, data, game.combat, pieceId)
			logStepLoss(game, pieceId, outcome)
			removeDefeatedBeachheadAfterLoss(game, data, outcome)
			game.combat.retreat_cancelled = true
			Engine.state.log(game, "combat.log.retreat_cancelled", {}, "bold")
			pauseForEliminatedTheater(game, data, adjacency, pieceId, outcome, "combat_retreat_option")
		},
		done(game, role, noun, { data, adjacency }) {
			delete game.combat.retreat_cancelled
			finishCombat(game, data, adjacency)
		},
		continue(game, role, noun, { data, adjacency }) {
			startRetreat(game, data, adjacency)
		},
	})

	registerState("combat_retreat", {
		prompt(result, game) {
			if (!game.combat.retreat_pending.length) {
				result.prompt("combat.retreat.complete")
				result.action("done")
				return
			}
			result.prompt("combat.retreat.choose_units", { distance: game.combat.retreat_distance })
			result.action("piece", game.combat.retreat_pending)
		},
		piece(game, role, noun, { data, adjacency }) {
			const pieceId = Number(noun)
			game.combat.retreat_piece = pieceId
			game.combat.retreat_prefix = []
			game.combat.retreat_options = preferredRetreatPaths(game, data, adjacency, pieceId)
			game.state = "combat_retreat_piece"
		},
		done(game) {
			Engine.state.clearUndo(game)
			beginAdvance(game)
		},
	})

	registerState("combat_retreat_piece", {
		prompt(result, game, role, { data, adjacency }) {
			const remaining = Math.max(0, game.combat.retreat_distance - game.combat.retreat_prefix.length)
			result.prompt("combat.retreat.choose_path", { remaining })
			result.action("move", retreatDestinations(game, data, adjacency))
		},
		move(game, role, noun, { data, adjacency }) {
			const pieceId = game.combat.retreat_piece
			const destination = Number(noun)
			const current = game.pieces[pieceId]
			Engine.orders.ensureStandFastUnits(game, data, current)
			if (current !== game.combat.defender_space && !game.combat.retreat_vacated.includes(current)) game.combat.retreat_vacated.push(current)
			Engine.map.enterSpace(game, data, pieceId, destination)
			Engine.orders.releaseStandFastIfVacated(game, data, current)
			game.combat.retreat_prefix.push(destination)
			game.combat.retreat_options = game.combat.retreat_options.filter((path) => game.combat.retreat_prefix.every((spaceId, index) => path[index] === spaceId))
			if (!game.combat.retreat_options.some((path) => path.length === game.combat.retreat_prefix.length)) return
			const path = game.combat.retreat_prefix.slice()
			game.combat.retreat_paths[pieceId] = path
			Engine.state.log(
				game,
				"combat.log.retreat_path",
				{
					piece: Engine.state.pieceLogRef(game, pieceId),
					origin: `s${game.combat.defender_space}`,
					path: path.map((spaceId) => `s${spaceId}`).join(" → "),
				},
				"detail2",
			)
			game.retreat_history.push({
				turn: game.turn,
				round: game.action_round,
				pieces: [pieceId],
				path,
			})
			game.combat.retreat_pending.splice(game.combat.retreat_pending.indexOf(pieceId), 1)
			delete game.combat.retreat_piece
			delete game.combat.retreat_prefix
			delete game.combat.retreat_options
			game.state = "combat_retreat"
			prepareRetreat(game, data, adjacency)
		},
	})

	registerState("combat_advance", {
		prompt(result, game, role, { data, adjacency }) {
			const selected = game.combat.advance_pieces || []
			const advancing = !!game.combat.advance_routes
			result.prompt(!selected.length ? "combat.advance.choose" : advancing ? "combat.advance.continue" : "combat.advance.destination")
			if (!selected.length) {
				const pieces = advanceCandidates(game, data, adjacency)
				if (pieces.length) result.action("piece", pieces)
				result.action("done")
				return
			}
			if (advancing) {
				const droppable = selected.filter((pieceId) => advanceRouteCanStop(game.combat.advance_routes[pieceId] || []))
				if (droppable.length) result.action("piece", droppable)
				if (droppable.length === selected.length) result.action("stop")
			} else {
				result.action("piece", selectableAdvancePieces(game, data, adjacency))
			}
			result.action("move", commonAdvanceSteps(game, data, adjacency, selected))
		},
		piece: toggleAdvancePiece,
		done(game, role, noun, { data, adjacency }) {
			if (!game.combat.advance_log_started) {
				Engine.state.log(game, "combat.log.advance_heading", {}, "strong")
				Engine.state.log(game, "combat.log.advance_none", {}, "detail2")
			}
			finishCombat(game, data, adjacency)
		},
		stop(game) {
			completeAdvancePieces(game, game.combat.advance_pieces.slice())
		},
		move(game, role, noun, { data, adjacency }) {
			const destination = Number(noun)
			const pieces = game.combat.advance_pieces.slice()
			const routesByPiece = advanceRoutesForPieces(game, data, adjacency, pieces)
			game.combat.advance_routes = routesByPiece
			if (!game.combat.advance_log_started) {
				Engine.state.log(game, "combat.log.advance_heading", {}, "strong")
				game.combat.advance_log_started = true
			}
			Engine.state.log(
				game,
				"combat.log.advance_group",
				{
					pieces: I18n.list(pieces.map((pieceId) => Engine.state.pieceLogRef(game, pieceId))),
					destination: `s${destination}`,
				},
				"detail2",
			)
			for (const pieceId of pieces) {
				game.combat.advance_routes[pieceId] = advanceRoutesAfterStep(routesByPiece[pieceId], destination)
				Engine.map.movePieceAlongPath(game, data, pieceId, [destination], { freeStandFastExit: true })
				if (game.combat.zitadelle_objective && destination === game.combat.defender_space && data.pieces[pieceId]?.nation === "ge" && data.pieces[pieceId]?.size === "lcu" && data.pieces[pieceId]?.unit_type === "mechanized")
					game.event.zitadelle_success = true
			}
			const completed = pieces.filter((pieceId) => game.combat.advance_routes[pieceId].every((route) => route.length === 0))
			if (completed.length) completeAdvancePieces(game, completed)
		},
	})
}

module.exports = {
	combatTargets,
	preferredRetreatPaths,
	prepareRetreat,
	register,
	retreatDestinations,
}
