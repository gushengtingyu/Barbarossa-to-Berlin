"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Locations = require("../modules/core/unit_locations.js")

test("off-map locations round-trip through one strict parser", () => {
	for (const location of [
		Locations.AVAILABLE,
		Locations.REMOVED,
		Locations.reserve("allied"),
		Locations.reserve("axis"),
		Locations.reserve("neutral"),
		Locations.eliminated("allied"),
		Locations.eliminated("axis"),
		Locations.turnTrack(7),
	]) {
		assert.notEqual(Locations.parse(location).kind, "unknown")
	}
	assert.equal(Locations.isReserve("reserve:neutral", "neutral"), true)
	assert.equal(Locations.isTurnTrack("turn_track:7", 7), true)
	assert.equal(Locations.turnFor("turn_track:7"), 7)
})

test("off-map constructors reject invalid sides and turns", () => {
	assert.throws(() => Locations.reserve("Allied"), /invalid unit-location side/)
	assert.throws(() => Locations.eliminated("neutral"), /eliminated pool/)
	assert.throws(() => Locations.turnTrack(0), /invalid turn-track turn/)
	assert.deepEqual(Locations.parse("turn_track:0"), { kind: "unknown", value: "turn_track:0" })
})
