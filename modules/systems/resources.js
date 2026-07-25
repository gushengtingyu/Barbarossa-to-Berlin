"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")

function resourceSpaces(data, kind) {
	return data.spaces.filter((space) => space?.resource === kind).map((space) => space.id)
}

function effectiveControl(game, data, map, spaceId) {
	if (game.partisans.includes(spaceId) && !map.friendlyPiecesInSpace(game, data, AXIS, spaceId).length) return ALLIED
	return typeof map.effectiveControl === "function" ? map.effectiveControl(game, spaceId, game.control[spaceId], data.spaces[spaceId]) : game.control[spaceId]
}

function controlsResource(game, data, map, side, spaceId) {
	return effectiveControl(game, data, map, spaceId) === side
}

function axisFullSupplyOilCount(game, data, map, adjacency) {
	return resourceSpaces(data, "oil").filter((spaceId) => controlsResource(game, data, map, AXIS, spaceId) && map.traceSupply(game, data, adjacency, AXIS, spaceId, "ge") === "full").length
}

function alliedOilCount(game, data, map) {
	return resourceSpaces(data, "oil").filter((spaceId) => controlsResource(game, data, map, ALLIED, spaceId)).length
}

function alliedIronCount(game, data, map) {
	return resourceSpaces(data, "iron").filter((spaceId) => controlsResource(game, data, map, ALLIED, spaceId)).length
}

function temporaryHandLimitModifier(game, side) {
	if (side === AXIS) return (game.events?.bomber_command_pending ? -2 : 0) + (game.events?.eighth_air_force_pending ? -2 : 0)
	return game.events?.wolfpacks_pending ? -2 : 0
}

function clearTemporaryHandLimitModifiers(game) {
	for (const flag of ["bomber_command_pending", "eighth_air_force_pending", "wolfpacks_pending"]) delete game.events?.[flag]
}

function handLimit(game, data, map, adjacency, side) {
	let limit = 7 + (Number(game.hand_limit_modifier?.[side]) || 0) + temporaryHandLimitModifier(game, side)
	if (side === AXIS) {
		if (alliedIronCount(game, data, map) === resourceSpaces(data, "iron").length) limit--
		const oil = axisFullSupplyOilCount(game, data, map, adjacency)
		if (oil === 0) limit--
		else if (oil >= 2) limit++
		return Math.max(game.turn >= 16 ? 2 : 5, Math.min(8, limit))
	}
	const oil = alliedOilCount(game, data, map)
	const evacuationTurn = Number(game.events?.industrial_evacuation_turn) || 0
	if (game.events?.industrial_evacuation && evacuationTurn && game.turn >= evacuationTurn + 8) limit++
	if (oil === 0) limit -= 2
	else if (oil === 1) limit--
	else if (oil === resourceSpaces(data, "oil").length) limit++
	return Math.max(5, Math.min(8, limit))
}

module.exports = {
	alliedIronCount,
	alliedOilCount,
	axisFullSupplyOilCount,
	clearTemporaryHandLimitModifiers,
	controlsResource,
	effectiveControl,
	handLimit,
	resourceSpaces,
	temporaryHandLimitModifier,
}
