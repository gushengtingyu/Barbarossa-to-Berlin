"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const catalog = require("../tools/unit_catalog.js")
const { buildUnitTables } = require("../tools/materialize_vassal_units.js")

test("reviewed counter catalog covers every combat counter image", () => {
	const { pieces } = buildUnitTables()
	assert.equal(pieces.length, 189)
	assert.equal(pieces.filter((piece) => piece.size === "marker").length, 1)
	assert.equal(
		pieces.filter((piece) => piece.size !== "marker").every((piece) => Number.isFinite(piece.cf) && Number.isFinite(piece.rmf)),
		true,
	)
	assert.deepEqual(catalog.get("GE_4 PzA.jpg"), {
		cf: 5,
		lf: 3,
		mf: 5,
		rcf: 3,
		rlf: 3,
		rmf: 5,
		non_replaceable: false,
	})
	const southwest = pieces.find((piece) => piece.id === 140)
	assert.deepEqual([southwest.rcf, southwest.rlf, southwest.rmf], [3, 3, 4])
	assert.equal(southwest.reduced_asset, "SU_SW Mech-b.jpg")
})

test("unit materializer maps initial stacks without inventing placement choices", () => {
	const { pieces, setup } = buildUnitTables()
	const markerIds = new Set(pieces.filter((piece) => piece.size === "marker").map((piece) => piece.id))
	assert.equal(setup.length, 187)
	assert.equal(
		setup.some((row) => markerIds.has(row.piece_id)),
		false,
	)
	assert.equal(
		setup.some((row) => row.piece_id === 155),
		false,
	)
	assert.equal(
		setup.some((row) => row.location === "setup_choice:occupied_france"),
		true,
	)
	assert.equal(
		setup.some((row) => row.location === "setup_choice:turkey"),
		true,
	)
	assert.equal(setup.filter((row) => row.space_id).length > 50, true)
})
