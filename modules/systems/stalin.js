"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
const { log } = require("../core/state.js")

function namedSpace(data, name) {
	return data.spaces.find((space) => space?.name === name) || null
}

function isActive(game) {
	return Number.isInteger(game.stalin_location) && game.stalin_location > 0
}

function isLegalGeneralDestination(game, data, map, adjacency, space) {
	if (!space || space.kind !== "land" || space.nation !== "su" || game.control[space.id] !== ALLIED) return false
	if (map.friendlyPiecesInSpace(game, data, AXIS, space.id).length) return false
	return map.traceSupply(game, data, adjacency, ALLIED, space.id, "su") !== "oos"
}

function legalDestinations(game, data, map, adjacency) {
	if (!isActive(game)) return []
	const origin = game.stalin_location
	const moscow = namedSpace(data, "Moscow")
	const kuibishev = namedSpace(data, "Kuibishev")
	if (!moscow || !kuibishev) return []
	if (origin === moscow.id && isLegalGeneralDestination(game, data, map, adjacency, kuibishev)) return [kuibishev.id]
	return data.spaces.filter((space) => space?.id !== origin && isLegalGeneralDestination(game, data, map, adjacency, space)).map((space) => space.id)
}

function move(game, data, map, adjacency, destination) {
	destination = Number(destination)
	if (!legalDestinations(game, data, map, adjacency).includes(destination)) throw new Error(`illegal Stalin SR destination: ${destination}`)
	const origin = game.stalin_location
	game.stalin_location = destination
	log(game, "stalin.log.sr", { origin: `s${origin}`, destination: `s${destination}` })
	return destination
}

function eliminate(game, reason) {
	if (!isActive(game)) return false
	const spaceId = game.stalin_location
	game.stalin_location = null
	game.events ||= {}
	game.events.stalin_eliminated = true
	game.events.stalin_eliminated_reason = reason
	game.vp += 4
	log(game, "stalin.log.captured", {
		space: `s${spaceId}`,
		reason: reason === "attrition" ? { "zh-CN": "因损耗被消灭", en: "eliminated by Attrition" } : { "zh-CN": "被轴心国俘获", en: "captured by the Axis" },
		vp: game.vp,
	})
	return true
}

function captureAt(game, destination) {
	return isActive(game) && game.stalin_location === Number(destination) ? eliminate(game, "capture") : false
}

module.exports = { captureAt, eliminate, isActive, legalDestinations, move }
