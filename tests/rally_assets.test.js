"use strict"

const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const assert = require("node:assert/strict")
const { prepareRallySource, readRuntimeManifest, ROOT } = require("../tools/prepare_rally_source.js")

function covered(manifest, relative) {
	const normalized = relative.replace(/\\/g, "/")
	return manifest.files.includes(normalized) || manifest.directories.some((directory) => normalized === directory || normalized.startsWith(`${directory}/`))
}

test("Rally runtime manifest covers every explicitly linked local asset", () => {
	const manifest = readRuntimeManifest()
	for (const asset of ["outside.css", "btb map.webp", "info/rules.html", "info/charts.html", "info/cards.html", "info/pieces.html", "BtB rules-2006.pdf"]) assert.equal(covered(manifest, asset), true, asset)
	assert.equal(covered(manifest, "btb map.png"), false, "editable map source is not a Rally runtime asset")
	assert.equal(covered(manifest, "assets/source/vassal/buildFile"), false, "review sources are not Rally runtime assets")
	assert.equal(prepareRallySource(), ROOT)
})

test("archived VASSAL artwork is outside the runtime image directory", () => {
	const archive = path.join(ROOT, "assets", "source", "vassal", "images-unused")
	assert.equal(fs.statSync(archive).isDirectory(), true)
	assert.ok(fs.readdirSync(archive).length > 0)
	for (const file of fs.readdirSync(archive)) assert.equal(fs.existsSync(path.join(ROOT, "images", file)), false, file)
})
