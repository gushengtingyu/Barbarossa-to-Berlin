"use strict"

const Runtime = require("../runtime.js")
const I18n = require("../core/i18n.js")
const Locations = require("../core/unit_locations.js")
const Engine = Object.freeze({
	constants: require("../core/constants.js"),
	state: require("../core/state.js"),
	combat: require("../systems/combat.js"),
	invasions: require("../systems/invasions.js"),
	map: require("../systems/map.js"),
	stalin: require("../systems/stalin.js"),
	turn: Runtime.turn,
})

function restoreTo(state) {
	const handler = function restoreSelection() {}
	Object.defineProperty(handler, "undo_restore_state", { value: state })
	return handler
}

function groupedSelection(handler) {
	Object.defineProperty(handler, "undo_group", { value: "selection" })
	return handler
}

function movablePieces(game, data, adjacency, side) {
	return game.action.move_spaces
		.flatMap((spaceId) => Engine.map.friendlyPiecesInSpace(game, data, side, spaceId))
		.filter((pieceId) => !game.action.moved.includes(pieceId) && Engine.map.legalMoveDestinations(game, data, adjacency, pieceId).length > 0)
}

function entrenchablePieces(game, data, adjacency) {
	return Engine.map.legalEntrenchingPieces(game, data, adjacency).filter((pieceId) => !game.action.moved.includes(pieceId))
}

function spaceHasMovementChoice(game, data, adjacency, side, spaceId) {
	return Engine.map.friendlyPiecesInSpace(game, data, side, spaceId).some((pieceId) => {
		if ((game.action.moved || []).includes(pieceId)) return false
		return Engine.map.legalMoveDestinations(game, data, adjacency, pieceId).length > 0 || Engine.map.canEntrenchAfterActivation(game, data, adjacency, pieceId, spaceId)
	})
}

function spaceHasCombatChoice(game, data, adjacency, side, spaceId) {
	return (adjacency[spaceId] || [])
		.filter((edge) => edge.type !== "sr")
		.map((edge) => edge.to)
		.some((target) => {
			const hasTarget = Engine.map.enemyPiecesInSpace(game, data, side, target).length > 0 || (side === Engine.constants.AXIS && Engine.invasions.activeBeachhead(game, target))
			return hasTarget && Engine.combat.mayAttackSpace(game, data, side, target)
		})
}

function pruneResolvedMoveSpaces(game, data, adjacency, side) {
	game.action.move_spaces = game.action.move_spaces.filter((spaceId) => spaceHasMovementChoice(game, data, adjacency, side, spaceId))
}

function hasMovementChoice(game, data, adjacency, side) {
	return movablePieces(game, data, adjacency, side).length > 0 || entrenchablePieces(game, data, adjacency).length > 0
}

function logActivationSummary(game, data, adjacency, side) {
	if (game.action.activations_logged) return
	game.action.activations_logged = true
	for (const [key, spaces] of [
		["activation.log.move", game.action.move_spaces],
		["activation.log.combat", game.action.attack_spaces],
	]) {
		if (!spaces.length) continue
		Engine.state.log(game, key, {}, "bold")
		for (const spaceId of spaces) {
			const cost = Engine.map.activationCost(game, data, side, spaceId, adjacency)
			if (cost > 1) Engine.state.log(game, "activation.log.space_cost", { space: `s${spaceId}`, cost }, "detail")
			else Engine.state.log(game, "activation.log.space", { space: `s${spaceId}` }, "detail")
		}
	}
}

function finishActivationSelection(game, role, data, adjacency) {
	const side = Engine.constants.sideForRole(role)
	logActivationSummary(game, data, adjacency, side)
	pruneResolvedMoveSpaces(game, data, adjacency, side)
	if (hasMovementChoice(game, data, adjacency, side)) game.state = "ops_move"
	else if (game.action.attack_spaces.length) game.state = "ops_combat"
	else Engine.turn.finishAction(game, side)
}

function deactivateSpace(game, data, adjacency, side, spaceId) {
	const cost = Number(game.action.activation_cost?.[spaceId])
	if (!cost) throw new Error("space is not a paid activation")
	game.action.points += cost
	game.action.move_spaces = game.action.move_spaces.filter((candidate) => candidate !== spaceId)
	game.action.attack_spaces = game.action.attack_spaces.filter((candidate) => candidate !== spaceId)
	delete game.action.activation_cost[spaceId]
	for (const pieceId of Engine.map.friendlyPiecesInSpace(game, data, side, spaceId)) delete game.action.activation_supply[pieceId]
}

function finishMovementIfExhausted(game, role, data, adjacency) {
	const side = Engine.constants.sideForRole(role)
	pruneResolvedMoveSpaces(game, data, adjacency, side)
	if (hasMovementChoice(game, data, adjacency, side)) {
		game.state = "ops_move"
		return
	}
	if (game.action.entrenching?.length) {
		game.action.after_entrench = game.action.attack_spaces.length ? "combat" : "finish"
		game.state = "ops_entrench_roll"
	} else if (game.action.attack_spaces.length) game.state = "ops_combat"
	else Engine.turn.finishAction(game, side)
}

function resolveEntrenchAtSpace(game, role, data, spaceId) {
	const attempts = game.action.entrenching || []
	const index = attempts.findIndex((attempt) => attempt.space_id === spaceId)
	const attempt = index < 0 ? null : attempts[index]
	if (attempt) {
		const side = Engine.constants.sideForRole(role)
		const resolved = Engine.map.resolveEntrenchAttempt(game, data, attempt)
		const die = Engine.state.formatDie(side, resolved.raw, resolved.modified - resolved.raw, resolved.modified)
		const params = { space: `s${resolved.space_id}`, die }
		if (resolved.success) Engine.state.log(game, "activation.log.entrench_success", { ...params, level: resolved.level })
		else Engine.state.log(game, "activation.log.entrench_failure", params)
	}
	game.action.entrenching = attempts.filter((_, attemptIndex) => attemptIndex !== index)
	Engine.state.clearUndo(game)
	if (game.action.entrenching.length) return
	const next = game.action.after_entrench
	delete game.action.after_entrench
	if (next === "finish") Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
	else game.state = "ops_combat"
}

function logMoveGroup(game, pieceIds, origin, destination) {
	if (!pieceIds.length) return
	if (!game.action.move.log_started) {
		Engine.state.log(game, "core.blank")
		Engine.state.log(game, "activation.log.move_from", { origin: `s${origin}` })
		game.action.move.log_started = true
	}
	Engine.state.log(
		game,
		"activation.log.move_group",
		{
			pieces: I18n.list(pieceIds.map((pieceId) => Engine.state.pieceLogRef(game, pieceId))),
			destination: `s${destination}`,
		},
		"detail",
	)
}

function beginMoveSelection(game, pieceId) {
	const origin = game.pieces[pieceId]
	game.action.piece = pieceId
	game.action.move = {
		origin,
		current: origin,
		path: [origin],
		pieces: [pieceId],
	}
	game.state = "ops_move_piece"
}

function moveSelectionCandidates(game, data, adjacency, side) {
	const origin = game.action.move?.origin
	return movablePieces(game, data, adjacency, side).filter((pieceId) => game.pieces[pieceId] === origin)
}

function dropMovePieces(game, pieceIds) {
	const move = game.action.move
	logMoveGroup(game, pieceIds, move.origin, move.current)
	for (const pieceId of pieceIds) {
		if (!game.action.moved.includes(pieceId)) game.action.moved.push(pieceId)
	}
	move.pieces = move.pieces.filter((pieceId) => !pieceIds.includes(pieceId))
	game.action.piece = move.pieces[0] ?? null
}

function finishMoveFormation(game, role, data, adjacency) {
	const move = game.action.move
	if (move?.pieces?.length) dropMovePieces(game, move.pieces.slice())
	delete game.action.move
	game.action.piece = null
	finishMovementIfExhausted(game, role, data, adjacency)
}

function settleExhaustedMovePieces(game, role, data, adjacency) {
	const move = game.action.move
	const spent = move.path.length - 1
	const exhausted = move.pieces.filter((pieceId) => Engine.map.movementAllowance(game, data, adjacency, pieceId) <= spent)
	if (!exhausted.length) return false
	const continuing = move.pieces.filter((pieceId) => !exhausted.includes(pieceId))
	if (!Engine.map.canEndFormationMovement(game, data, adjacency, exhausted, move.current, continuing)) return false
	dropMovePieces(game, exhausted)
	if (move.pieces.length) return false
	delete game.action.move
	game.action.piece = null
	finishMovementIfExhausted(game, role, data, adjacency)
	return true
}

const toggleOrDropMovePiece = groupedSelection(function toggleOrDropMovePiece(game, role, noun, { data, adjacency }) {
	const pieceId = Number(noun)
	const move = game.action.move
	if (move.path.length === 1) {
		const index = move.pieces.indexOf(pieceId)
		if (index < 0) move.pieces.push(pieceId)
		else move.pieces.splice(index, 1)
		if (!move.pieces.length) {
			delete game.action.move
			game.action.piece = null
			game.state = "ops_move"
			return
		}
		game.action.piece = move.pieces[0]
		return
	}
	const continuing = move.pieces.filter((candidate) => candidate !== pieceId)
	if (!Engine.map.canEndFormationMovement(game, data, adjacency, [pieceId], move.current, continuing)) throw new Error("piece cannot stop in current space")
	dropMovePieces(game, [pieceId])
	if (!move.pieces.length) {
		delete game.action.move
		game.action.piece = null
		finishMovementIfExhausted(game, role, data, adjacency)
	}
})

function locationLogRef(location) {
	if (Number.isInteger(location) && location > 0) return `s${location}`
	if (Locations.isReserve(location, Engine.constants.ALLIED)) return { "zh-CN": "盟军预备箱", en: "Allied Reserve Box" }
	if (Locations.isReserve(location, Engine.constants.AXIS)) return { "zh-CN": "轴心国预备箱", en: "Axis Reserve Box" }
	return String(location)
}

function logSrMove(game, pieceId, origin, destination) {
	if (!game.action.sr_log_started) {
		Engine.state.log(game, "core.blank")
		Engine.state.log(game, "activation.log.sr", {}, "bold")
		game.action.sr_log_started = true
	}
	Engine.state.log(
		game,
		"activation.log.sr_move",
		{
			piece: Engine.state.pieceLogRef(game, pieceId),
			origin: locationLogRef(origin),
			destination: locationLogRef(destination),
		},
		"detail",
	)
}

function register(registerState) {
	registerState("ops_activate", {
		prompt(result, game, role, { data, adjacency }) {
			const side = Engine.constants.sideForRole(game.active)
			result.prompt("activation.choose_space", { points: game.action?.points || 0 })
			const available = Engine.map.legalActivationSpaces(game, data, side).filter((spaceId) => {
				if (game.action.move_spaces.includes(spaceId) || game.action.attack_spaces.includes(spaceId)) return false
				return Engine.map.activationCost(game, data, side, spaceId, adjacency) <= game.action.points
			})
			const moveSpaces = available.filter((spaceId) => spaceHasMovementChoice(game, data, adjacency, side, spaceId))
			const attackSpaces = available.filter((spaceId) => spaceHasCombatChoice(game, data, adjacency, side, spaceId))
			if (moveSpaces.length) result.action("space", moveSpaces)
			if (attackSpaces.length) result.action("attack", attackSpaces)
			const paid = Object.keys(game.action.activation_cost || {}).map(Number)
			if (paid.length) result.action("deactivate", paid)
			result.action("done")
		},
		space(game, role, noun, { data, adjacency }) {
			const side = Engine.constants.sideForRole(role)
			const spaceId = Number(noun)
			const cost = Engine.map.activationCost(game, data, side, spaceId, adjacency)
			game.action.points -= cost
			game.action.activation_cost ||= {}
			game.action.activation_cost[spaceId] = cost
			Engine.map.recordActivationSupply(game, data, adjacency, side, spaceId)
			game.action.move_spaces.push(spaceId)
			if (game.action.points === 0) finishActivationSelection(game, role, data, adjacency)
		},
		attack(game, role, noun, { data, adjacency }) {
			const side = Engine.constants.sideForRole(role)
			const spaceId = Number(noun)
			const cost = Engine.map.activationCost(game, data, side, spaceId, adjacency)
			game.action.points -= cost
			game.action.activation_cost ||= {}
			game.action.activation_cost[spaceId] = cost
			Engine.map.recordActivationSupply(game, data, adjacency, side, spaceId)
			game.action.attack_spaces.push(spaceId)
			if (game.action.points === 0) finishActivationSelection(game, role, data, adjacency)
		},
		deactivate(game, role, noun, { data, adjacency }) {
			deactivateSpace(game, data, adjacency, Engine.constants.sideForRole(role), Number(noun))
		},
		done(game, role, noun, { data, adjacency }) {
			if (game.action.move_spaces.length || game.action.attack_spaces.length) finishActivationSelection(game, role, data, adjacency)
			else Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
		},
	})

	registerState("ops_move", {
		prompt(result, game, role, { data, adjacency }) {
			const side = Engine.constants.sideForRole(game.active)
			result.prompt("activation.move.units")
			const pieces = movablePieces(game, data, adjacency, side)
			if (pieces.length) result.action("piece", pieces)
			const entrenching = entrenchablePieces(game, data, adjacency)
			if (entrenching.length) result.action("entrench", entrenching)
			result.action("done")
		},
		piece(game, role, noun) {
			beginMoveSelection(game, Number(noun))
		},
		entrench(game, role, noun, { data, adjacency }) {
			const pieceId = Number(noun)
			game.action.entrenching ||= []
			game.action.entrenching.push({
				piece_id: pieceId,
				space_id: game.pieces[pieceId],
			})
			game.action.moved.push(pieceId)
			finishMovementIfExhausted(game, role, data, adjacency)
		},
		done(game, role) {
			game.action.move_spaces = []
			if (game.action.entrenching?.length) {
				game.action.after_entrench = game.action.attack_spaces.length ? "combat" : "finish"
				game.state = "ops_entrench_roll"
			} else if (game.action.attack_spaces.length) game.state = "ops_combat"
			else Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
		},
	})

	registerState("ops_entrench_roll", {
		prompt(result, game, role, { data }) {
			const spaces = [...new Set((game.action.entrenching || []).map((attempt) => attempt.space_id))].sort((a, b) => a - b)
			if (spaces.length) result.prompt("activation.entrench.roll", { spaces: I18n.list(spaces.map((spaceId) => data.spaces[spaceId]?.name || `s${spaceId}`)) })
			else result.prompt("activation.entrench.none")
			if (spaces.length) result.action("space", spaces)
			if (spaces.length === 1) result.action("roll")
			if (!spaces.length) result.action("done")
		},
		space(game, role, noun, { data }) {
			resolveEntrenchAtSpace(game, role, data, Number(noun))
		},
		roll(game, role, noun, runtime) {
			const attempt = game.action.entrenching?.[0]
			if (attempt) resolveEntrenchAtSpace(game, role, runtime.data, attempt.space_id)
		},
		done(game, role) {
			const next = game.action.after_entrench
			delete game.action.after_entrench
			if (next === "finish") Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
			else game.state = "ops_combat"
		},
	})

	registerState("ops_move_piece", {
		prompt(result, game, role, { data, adjacency }) {
			const side = Engine.constants.sideForRole(game.active)
			const move = game.action.move
			const choosing = move.path.length === 1
			if (choosing) result.prompt("activation.move.choose_group")
			else result.prompt("activation.move.group_distance", { distance: move.path.length - 1 })
			if (choosing) {
				result.action("piece", moveSelectionCandidates(game, data, adjacency, side))
				result.action("pass")
			} else if (move.pieces.length > 1) {
				const droppable = move.pieces.filter((pieceId) => {
					const continuing = move.pieces.filter((candidate) => candidate !== pieceId)
					return Engine.map.canEndFormationMovement(game, data, adjacency, [pieceId], move.current, continuing)
				})
				result.action("piece", droppable)
			}
			result.action("move", Engine.map.legalMoveFormationSteps(game, data, adjacency, move.pieces, move.path))
			if (!choosing && Engine.map.canEndFormationMovement(game, data, adjacency, move.pieces, move.current)) result.action("stop")
		},
		piece: toggleOrDropMovePiece,
		move(game, role, noun, { data, adjacency }) {
			const destination = Number(noun)
			const move = game.action.move
			Engine.map.moveFormationStep(game, data, adjacency, move.pieces, move.path, destination)
			move.current = destination
			move.path.push(destination)
			settleExhaustedMovePieces(game, role, data, adjacency)
		},
		stop(game, role, noun, { data, adjacency }) {
			finishMoveFormation(game, role, data, adjacency)
		},
		pass: restoreTo("ops_move"),
	})

	registerState("sr_piece", {
		prompt(result, game, role, { data, adjacency }) {
			const side = Engine.constants.sideForRole(game.active)
			const context = Engine.map.createSrSearchContext(game, data, adjacency)
			result.prompt("activation.sr.choose_piece", { points: game.action?.points || 0 })
			const pieces = data.pieces
				.map((piece, pieceId) => {
					const cost = piece?.size === "lcu" ? 3 : 1
					return Engine.map.pieceSide(game, data, pieceId) === side && cost <= game.action.points && !game.action.sr_moved.includes(pieceId) && Engine.map.hasLegalSrDestination(game, data, adjacency, pieceId, context)
						? pieceId
						: null
				})
				.filter(Boolean)
			if (pieces.length) result.action("piece", pieces)
			if (side === Engine.constants.ALLIED && game.action.points >= 1 && !game.action.stalin_moved && Engine.stalin.legalDestinations(game, data, Engine.map, adjacency).length) result.action("stalin")
			result.action("done")
		},
		piece(game, role, noun) {
			game.action.piece = Number(noun)
			game.state = "sr_destination"
		},
		done(game, role) {
			Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
		},
		stalin(game) {
			game.state = "sr_stalin_destination"
		},
	})

	registerState("sr_destination", {
		prompt(result, game, role, { data, adjacency }) {
			result.prompt("activation.sr.destination")
			result.action("move", [...Engine.map.legalSrPaths(game, data, adjacency, game.action.piece).keys()])
			result.action("pass")
		},
		move(game, role, noun, { data, adjacency }) {
			const pieceId = game.action.piece
			const cost = data.pieces[pieceId]?.size === "lcu" ? 3 : 1
			if (cost > game.action.points) throw new Error("insufficient SR points")
			const paths = Engine.map.legalSrPaths(game, data, adjacency, pieceId)
			const destination = Locations.isReserve(noun) ? noun : Number(noun)
			const origin = game.pieces[pieceId]
			Engine.map.movePieceAlongPath(game, data, pieceId, paths.get(destination))
			Engine.map.recordSrReserveEntry(game, data, pieceId, origin, destination)
			game.action.points -= cost
			game.action.sr_moved.push(pieceId)
			logSrMove(game, pieceId, origin, destination)
			game.action.piece = null
			if (game.action.points === 0) Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
			else game.state = "sr_piece"
		},
		pass: restoreTo("sr_piece"),
	})

	registerState("sr_stalin_destination", {
		prompt(result, game, role, { data, adjacency }) {
			result.prompt("activation.sr.stalin_destination")
			result.action("move", Engine.stalin.legalDestinations(game, data, Engine.map, adjacency))
			result.action("pass")
		},
		move(game, role, noun, { data, adjacency }) {
			if (game.action.points < 1 || game.action.stalin_moved) throw new Error("Stalin has no available SR point")
			Engine.stalin.move(game, data, Engine.map, adjacency, Number(noun))
			game.action.points--
			game.action.stalin_moved = true
			if (game.action.points === 0) Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
			else game.state = "sr_piece"
		},
		pass: restoreTo("sr_piece"),
	})
}

module.exports = { register }
