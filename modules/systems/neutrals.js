"use strict"

const { ALLIED, AXIS, otherSide, roleForSide } = require("../core/constants.js")
const { clearUndo, log, pieceLogRef } = require("../core/state.js")
const Locations = require("../core/unit_locations.js")

const COUNTRY_NAMES = Object.freeze({ tu: "土耳其", sw: "瑞典" })
const VICHY_NATIONS = Object.freeze(new Set(["fr", "dz", "tn"]))

function neutralState(game, nation) {
	game.neutrals ||= {}
	game.neutrals[nation] ||= { at_war: false, controller: null }
	return game.neutrals[nation]
}

function isAtWar(game, nation) {
	return !!neutralState(game, nation).at_war
}

function controller(game, nation) {
	return neutralState(game, nation).controller || null
}

function effectivePieceSide(game, piece) {
	if (!piece) return null
	if (piece.side !== "neutral") return piece.side
	if (["tu", "sw"].includes(piece.nation) && isAtWar(game, piece.nation)) return controller(game, piece.nation)
	return "neutral"
}

function isVichySpace(space) {
	return !!(space?.kind === "land" && space.side === "neutral" && VICHY_NATIONS.has(space.nation))
}

function mayEnterSpace(game, space) {
	if (!space || space.kind !== "land") return false
	if (isVichySpace(space)) return !!game.events?.vichy_war
	if (["tu", "sw"].includes(space.nation)) return isAtWar(game, space.nation)
	return true
}

function deploymentPieces(game, data, nation) {
	return data.pieces.filter((piece) => piece?.nation === nation && game.pieces[piece.id] === `setup_choice:${nation === "tu" ? "turkey" : "sweden"}`).map((piece) => piece.id)
}

function deploymentSpaces(game, data, map, nation, pieceId) {
	return data.spaces.filter((space) => space?.kind === "land" && space.nation === nation && map.canStack(game, data, pieceId, space.id)).map((space) => space.id)
}

function relabelReservePieces(game, data, nation, side) {
	for (const piece of data.pieces) {
		if (piece?.nation === nation && Locations.isReserve(game.pieces[piece.id], "neutral")) game.pieces[piece.id] = Locations.reserve(side)
	}
}

function declareWar(game, data, nation, declarerSide, returnState = "action_select") {
	if (!["tu", "sw"].includes(nation)) throw new Error(`unsupported neutral nation: ${nation}`)
	const state = neutralState(game, nation)
	if (state.at_war) throw new Error(`${nation} is already at war`)
	const controllingSide = otherSide(declarerSide)
	state.at_war = true
	state.controller = controllingSide
	state.declared_by = declarerSide
	state.turn = game.turn
	state.round = game.action_round
	relabelReservePieces(game, data, nation, controllingSide)
	if (declarerSide === AXIS && !game.events?.casablanca) {
		const penalty = nation === "tu" ? 3 : 1
		game.vp -= penalty
		log(game, "neutrals.log.declare_war_penalty", {
			country: { "zh-CN": COUNTRY_NAMES[nation], en: nation === "tu" ? "Turkey" : "Sweden" },
			penalty,
			vp: game.vp,
		})
	} else
		log(game, "neutrals.log.declare_war", {
			side: declarerSide === ALLIED ? { "zh-CN": "盟军", en: "The Allies" } : { "zh-CN": "轴心国", en: "The Axis" },
			country: { "zh-CN": COUNTRY_NAMES[nation], en: nation === "tu" ? "Turkey" : "Sweden" },
		})
	const pieces = deploymentPieces(game, data, nation)
	if (pieces.length) {
		game.neutral_deployment = {
			nation,
			controller: controllingSide,
			declarer: declarerSide,
			pieces,
			index: 0,
			return_state: returnState,
		}
		game.active = roleForSide(controllingSide)
		game.state = "neutral_deployment"
	} else {
		game.active = roleForSide(declarerSide)
		game.state = returnState
	}
	clearUndo(game)
	return state
}

function placeDeploymentPiece(game, data, map, pieceId, spaceId) {
	const deployment = game.neutral_deployment
	if (!deployment || deployment.pieces[deployment.index] !== pieceId) throw new Error(`unexpected neutral deployment piece: ${pieceId}`)
	if (!deploymentSpaces(game, data, map, deployment.nation, pieceId).includes(spaceId)) throw new Error(`illegal neutral deployment space: ${spaceId}`)
	game.pieces[pieceId] = spaceId
	deployment.index++
	log(game, "neutrals.log.deployment", {
		country: { "zh-CN": COUNTRY_NAMES[deployment.nation], en: deployment.nation === "tu" ? "Turkey" : "Sweden" },
		piece: pieceLogRef(game, pieceId),
		space: `s${spaceId}`,
	})
	if (deployment.index >= deployment.pieces.length) {
		game.active = roleForSide(deployment.declarer)
		game.state = deployment.return_state
		game.neutral_deployment = null
		clearUndo(game)
	}
}

function activateVichy(game) {
	if (game.events?.vichy_war) return false
	game.events ||= {}
	game.events.vichy_war = true
	log(game, "neutrals.log.vichy")
	return true
}

function awardTurkeyRp(game) {
	const state = neutralState(game, "tu")
	if (!state.at_war || state.rp_awarded_turn === game.turn) return 0
	game.rp ||= {}
	game.rp.tu = (Number(game.rp.tu) || 0) + 2
	state.rp_awarded_turn = game.turn
	log(game, "neutrals.log.turkey_rp", {
		side: state.controller === ALLIED ? { "zh-CN": "盟军", en: "the Allies" } : { "zh-CN": "轴心国", en: "the Axis" },
	})
	return 2
}

module.exports = {
	COUNTRY_NAMES,
	VICHY_NATIONS,
	activateVichy,
	awardTurkeyRp,
	controller,
	declareWar,
	deploymentPieces,
	deploymentSpaces,
	effectivePieceSide,
	isAtWar,
	isVichySpace,
	mayEnterSpace,
	neutralState,
	placeDeploymentPiece,
}
