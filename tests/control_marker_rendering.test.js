"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const { parseHTML } = require("linkedom")
const Engine = require("../modules/engine.js")

function loadFrontend() {
	const { window } = parseHTML(fs.readFileSync("play.html", "utf8"))
	Object.defineProperty(window, "localStorage", {
		value: { getItem: () => null, setItem: () => {} },
		configurable: true,
	})
	window.BTB_DATA = Engine.data
	window.view = {}
	window.send_action = () => {}
	window.action_button = () => {}
	window.innerWidth = 1200
	const context = vm.createContext(window)
	vm.runInContext(fs.readFileSync("modules/core/i18n_catalog.js", "utf8"), context)
	vm.runInContext(fs.readFileSync("modules/core/i18n.js", "utf8"), context)
	vm.runInContext(fs.readFileSync("play.js", "utf8"), context)
	return { context, window }
}

test("control markers only render in spaces without units", () => {
	const { context, window } = loadFrontend()
	const document = window.document
	const space = Engine.data.spaces.find((entry) => entry?.kind === "land" && entry.side === "allied")
	const unit = Engine.data.pieces.find((entry) => entry?.side === "axis" && entry.size !== "marker")
	const stalin = Engine.data.pieces.find((entry) => entry?.size === "marker")
	const pieces = Array(Engine.data.pieces.length).fill("removed")
	const control = Engine.data.spaces.map((entry) => entry?.side || null)
	control[space.id] = "axis"
	window.view = {
		actions: {},
		pieces,
		control,
		events: {},
		oos: [],
		trench: { [space.id]: 1 },
		trench_owner: { [space.id]: "axis" },
		trench_kind: {},
	}

	const marker = (type) => document.querySelector(`.map-marker[data-space-id="${space.id}"][data-marker-type="${type}"]`)
	const stackTypes = () => Array.from(vm.runInContext(`(currentMarkerStacks.get(${space.id}) || []).map(([, element]) => element.dataset.markerType)`, context))

	vm.runInContext("updateMapMarkers()", context)
	assert.ok(marker("control"))
	const trench = marker("trench")
	assert.ok(trench)
	assert.deepEqual(stackTypes(), ["control", "trench"])

	pieces[unit.id] = space.id
	vm.runInContext("updateMapMarkers()", context)
	assert.equal(marker("control"), null)
	assert.equal(marker("trench"), trench)
	assert.deepEqual(stackTypes(), ["trench"])

	pieces[unit.id] = "removed"
	vm.runInContext("updateMapMarkers()", context)
	assert.ok(marker("control"))
	assert.equal(marker("trench"), trench)

	pieces[stalin.id] = space.id
	window.view.stalin_location = space.id
	vm.runInContext("updateMapMarkers()", context)
	assert.ok(marker("control"))
	assert.ok(marker("stalin"))
	assert.equal(marker("trench"), trench)
})
