"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { makeReport } = require("../tools/report_coverage.js")

test("coverage matrix accounts for every numbered and optional rule", () => {
	const report = makeReport()
	assert.equal(report.rules.length, 20)
	assert.equal(report.optional.length, 4)
	assert.match(report.markdown, /Core rules: 8\/20 covered\./)
	assert.doesNotMatch(report.markdown, /card events|Card events/)
})
