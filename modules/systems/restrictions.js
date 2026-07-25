"use strict"

const Neutrals = require("./neutrals.js")

const SOVIET_BLOCKED = new Set(["eg", "ly", "dz", "tn", "ps", "sy", "jo"])
const ITALIAN_ALLOWED = new Set(["it", "yu", "al", "gr", "tu", "tn", "dz", "ly", "eg", "ps", "sy", "jo", "iq"])
const SOUTH_ITALY = new Set(["Rome", "Cassino", "Ancona", "Pescara", "Foggia", "Naples", "Catanzaro", "Taranto", "Messina", "Palermo", "Gela", "Syracuse"])

function adjacentToNation(data, adjacency, spaceId, nation) {
	return data.spaces[spaceId]?.nation === nation || (adjacency[spaceId] || []).some((edge) => data.spaces[edge.to]?.nation === nation)
}

function mayEnter(game, data, adjacency, pieceId, spaceId) {
	const piece = data.pieces[pieceId]
	const space = data.spaces[spaceId]
	if (!piece || !space || space.kind !== "land") return false
	if (!Neutrals.mayEnterSpace(game, space)) return false
	if (["tu", "sw"].includes(piece.nation) && space.nation !== piece.nation) return false
	if (piece.nation === "hu") {
		if (piece.name.includes("HU 3 Army")) return space.nation === "hu"
		return ["hu", "su", "yu"].includes(space.nation)
	}
	if (piece.nation === "ro") return ["ro", "su", "yu"].includes(space.nation)
	if (piece.nation === "bu") return ["gr", "bu", "tu", "yu"].includes(space.nation)
	if (piece.nation === "it") {
		if (piece.name.includes("IT 8 Army")) return space.nation === "su"
		return ITALIAN_ALLOWED.has(space.nation)
	}
	if (piece.nation === "ge" && piece.size === "lcu" && space.nation === "it" && SOUTH_ITALY.has(space.name) && !game.events.achse) return false
	if (piece.nation === "yu") return adjacentToNation(data, adjacency, spaceId, "yu")
	if (piece.nation === "br" && piece.name.includes("BR 1 Army") && !game.events.sledgehammer) return ["mt", "dz", "tn", "ly", "eg"].includes(space.nation)
	if (piece.nation === "su") {
		if (SOVIET_BLOCKED.has(space.nation)) return false
	}
	if (["br", "cw", "us", "ff"].includes(piece.nation) && space.nation === "su") return false
	return true
}

module.exports = { ITALIAN_ALLOWED, SOUTH_ITALY, SOVIET_BLOCKED, mayEnter }
