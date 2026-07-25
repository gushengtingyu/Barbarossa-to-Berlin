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
})

test("unit materializer maps initial stacks without inventing placement choices", () => {
	const { setup } = buildUnitTables()
	assert.equal(setup.length, 188)
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
