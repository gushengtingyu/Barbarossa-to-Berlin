"use strict"

const AVAILABLE = "available"
const REMOVED = "removed"
const SIDES = Object.freeze(new Set(["allied", "axis", "neutral"]))

function assertSide(side) {
	if (!SIDES.has(side)) throw new Error(`invalid unit-location side: ${side}`)
	return side
}

function reserve(side) {
	return `reserve:${assertSide(side)}`
}

function eliminated(side) {
	if (side === "neutral") throw new Error("neutral units cannot use an eliminated pool")
	return `eliminated:${assertSide(side)}`
}

function turnTrack(turn) {
	if (!Number.isInteger(turn) || turn < 1) throw new Error(`invalid turn-track turn: ${turn}`)
	return `turn_track:${turn}`
}

function parse(location) {
	if (location === AVAILABLE) return Object.freeze({ kind: AVAILABLE })
	if (location === REMOVED) return Object.freeze({ kind: REMOVED })
	if (Number.isInteger(location) && location > 0) return Object.freeze({ kind: "map", space_id: location })
	if (typeof location !== "string") return Object.freeze({ kind: "unknown", value: location })
	let match = /^reserve:(allied|axis|neutral)$/.exec(location)
	if (match) return Object.freeze({ kind: "reserve", side: match[1] })
	match = /^eliminated:(allied|axis)$/.exec(location)
	if (match) return Object.freeze({ kind: "eliminated", side: match[1] })
	match = /^turn_track:(\d+)$/.exec(location)
	if (match && Number(match[1]) >= 1) return Object.freeze({ kind: "turn_track", turn: Number(match[1]) })
	if (location.startsWith("setup_choice:")) return Object.freeze({ kind: "setup_choice", choice: location.slice(13) })
	return Object.freeze({ kind: "unknown", value: location })
}

function isReserve(location, side = null) {
	const parsed = parse(location)
	return parsed.kind === "reserve" && (!side || parsed.side === side)
}

function isAvailable(location) {
	return location === AVAILABLE
}

function isEliminated(location, side = null) {
	const parsed = parse(location)
	return parsed.kind === "eliminated" && (!side || parsed.side === side)
}

function turnFor(location) {
	const parsed = parse(location)
	return parsed.kind === "turn_track" ? parsed.turn : null
}

function isRemoved(location) {
	return location === REMOVED
}

function isTurnTrack(location, turn = null) {
	const parsed = parse(location)
	return parsed.kind === "turn_track" && (turn === null || parsed.turn === turn)
}

module.exports = Object.freeze({
	AVAILABLE,
	REMOVED,
	eliminated,
	isAvailable,
	isEliminated,
	isRemoved,
	isReserve,
	isTurnTrack,
	parse,
	reserve,
	turnFor,
	turnTrack,
})
