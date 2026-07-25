"use strict"

const path = require("node:path")
const test = require("node:test")
const assert = require("node:assert/strict")
const { buildDraft } = require("../tools/import_vassal.js")

const ROOT = path.resolve(__dirname, "..")
const SOURCE = path.join(ROOT, "assets", "source", "vassal", "buildFile")

test("VASSAL importer produces a deterministic review-only draft", () => {
	const first = buildDraft(SOURCE)
	const second = buildDraft(SOURCE)
	assert.deepEqual(first, second)
	assert.equal(first.meta.piece_slot_count, 276)
	assert.equal(first.meta.setup_piece_count, 230)
	assert.equal(first.meta.map_region_count, 414)
	assert.equal(
		first.piece_slots.every((piece) => piece.flags.includes("needs_review")),
		true,
	)
	assert.equal(
		first.setup.every((piece) => piece.scenario === "Campaign"),
		true,
	)
})

test("VASSAL setup keeps stable source ids and locations", () => {
	const { setup } = buildDraft(SOURCE)
	assert.equal(new Set(setup.map((piece) => piece.gpid)).size, setup.length)
	assert.equal(
		setup.some((piece) => piece.location === "Tobruk" && piece.entry_name === "Tobruk Trench"),
		true,
	)
	assert.equal(
		setup.some((piece) => piece.location === "Moscow" && piece.entry_name === "Stalin"),
		true,
	)
})
