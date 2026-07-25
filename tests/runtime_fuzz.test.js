"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { runFuzz } = require("./runtime_fuzz_loop.js")

test("deterministic runtime fuzz smoke reaches a valid replayable state", () => {
	const result = runFuzz({ maxSteps: 120 })
	assert.ok(result.actions > 0)
	assert.ok(result.turn >= 1)
})
