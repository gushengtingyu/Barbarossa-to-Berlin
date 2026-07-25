"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const { parseHTML } = require("linkedom")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

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
	window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
		this.dataset.scrolledIntoView = "true"
	}
	const context = vm.createContext(window)
	vm.runInContext(fs.readFileSync("modules/core/i18n_catalog.js", "utf8"), context)
	vm.runInContext(fs.readFileSync("modules/core/i18n.js", "utf8"), context)
	vm.runInContext(fs.readFileSync("play.js", "utf8"), context)
	return { context, window }
}

test("reinforcement display uses the published BTB board with accessible card hotspots", () => {
	const { window } = loadFrontend()
	const document = window.document
	const board = document.getElementById("reinforcement_board")
	assert.ok(board)
	assert.equal(board.style.width, "1320px")
	assert.equal(board.style.height, "1020px")
	assert.match(board.getAttribute("aria-label"), /增援表/)
	assert.equal(document.querySelectorAll(".reinforcement_block, .rule_box_board, .reinforcement_catalog").length, 0)
	for (const spec of Engine.data.reinforcement_catalog) {
		const hotspot = document.querySelector(`.reinforcement_card_hotspot[data-card-id="${spec.card_id}"]`)
		assert.ok(hotspot, `missing hotspot for card ${spec.card_id}`)
		assert.ok(hotspot.getAttribute("aria-label"))
	}
})

test("Campaign opening fills every authored reinforcement-board unit slot", () => {
	const { context, window } = loadFrontend()
	const game = rules.setup(20240725, "Campaign", {})
	window.view = rules.view(game, "Axis")
	vm.runInContext("rebuildInteractionCache(); updateOffMapBoards(); updatePieces()", context)
	const board = window.document.getElementById("reinforcement_board")
	const counters = [...board.querySelectorAll(".piece")].filter((element) => !element.hidden)
	assert.equal(counters.length, Engine.data.reinforcement_board.slots.length)
	for (const slot of Engine.data.reinforcement_board.slots) {
		const counter = board.querySelector(`.piece[title^="#${slot.piece_id} "]`)
		assert.ok(counter, `piece ${slot.piece_id} is missing from its opening reinforcement slot`)
		assert.equal(counter.hidden, false)
	}
})

test("published reinforcement slots keep stable counter nodes as units enter play", () => {
	const { context, window } = loadFrontend()
	const document = window.document
	const spec = Engine.data.reinforcement_catalog.find((entry) => entry.units.length)
	const pieceId = spec.units[0].piece_id
	const hotspot = document.querySelector(`.reinforcement_card_hotspot[data-card-id="${spec.card_id}"]`)

	const pieces = Array(Engine.data.pieces.length).fill("available")
	window.view = {
		actions: { play_event: [spec.card_id] },
		pieces,
		reduced: [],
		turn: 6,
		neutrals: {},
		eliminated_theater: {},
		off_map_units: [],
	}
	vm.runInContext("rebuildInteractionCache(); updateOffMapBoards(); updatePieces()", context)
	const counter = document.querySelector(`.piece[title^="#${pieceId} "]`)

	assert.ok(counter)
	assert.equal(counter.parentElement.id, "reinforcement_board")
	assert.equal(hotspot.classList.contains("legal"), true)
	pieces[pieceId] = Engine.data.spaces.find((space) => space?.kind === "land").id
	vm.runInContext("updatePieces()", context)
	assert.equal(counter.parentElement.id, "piece-overlay")
	assert.equal(document.querySelector(`.reinforcement_card_hotspot[data-card-id="${spec.card_id}"]`), hotspot)
})

test("published reinforcement counters match the printed slot sizes and centers", () => {
	const { context, window } = loadFrontend()
	const document = window.document
	const pieces = Array(Engine.data.pieces.length).fill("removed")
	const cases = [560, 462, 478, 405, 483, 401, 573, 559].map((id) => {
		const slot = Engine.data.reinforcement_board.slots.find((entry) => entry.piece_id === id)
		assert.ok(slot, `missing authored reinforcement slot for piece ${id}`)
		return { id, size: slot.w, left: Math.round(slot.x - slot.w / 2), top: Math.round(slot.y - slot.h / 2) }
	})
	for (const entry of cases) pieces[entry.id] = "available"
	window.view = {
		actions: {},
		pieces,
		reduced: [],
		neutrals: {},
		off_map_units: [],
	}

	vm.runInContext("rebuildInteractionCache(); updatePieces()", context)
	for (const entry of cases) {
		const counter = document.querySelector(`.piece[title^="#${entry.id} "]`)
		assert.equal(counter.parentElement.id, "reinforcement_board")
		assert.equal(counter.style.width, `${entry.size}px`)
		assert.equal(counter.style.height, `${entry.size}px`)
		assert.equal(counter.style.left, `${entry.left}px`)
		assert.equal(counter.style.top, `${entry.top}px`)
	}
})

test("printed reduced-strength reinforcements use their reduced counter face before entry", () => {
	const { context, window } = loadFrontend()
	const document = window.document
	const spec = Engine.data.reinforcement_catalog.find((entry) => entry.units.some((unit) => unit.reduced))
	const unit = spec.units.find((entry) => entry.reduced)
	const piece = Engine.data.pieces[unit.piece_id]
	window.view = {
		actions: {},
		pieces: Array(Engine.data.pieces.length).fill("available"),
		reduced: [],
		neutrals: {},
		off_map_units: [],
	}
	vm.runInContext("rebuildInteractionCache(); updatePieces()", context)
	const counter = document.querySelector(`.piece[title^="#${unit.piece_id} "]`)
	assert.equal(counter.parentElement.id, "reinforcement_board")
	assert.match(counter.style.backgroundImage, new RegExp(encodeURIComponent(piece.image_reduced).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
})

test("delayed counters render directly on the printed Turn Record", () => {
	const { context, window } = loadFrontend()
	const document = window.document
	const delayed = Engine.data.pieces.filter((entry) => entry?.size === "lcu").slice(0, 2)
	const pieces = Array(Engine.data.pieces.length).fill("available")
	for (const piece of delayed) pieces[piece.id] = "turn_track:7"

	window.view = {
		actions: {},
		pieces,
		reduced: [],
		turn: 4,
		neutrals: {},
		eliminated_theater: {},
		off_map_units: [],
	}
	vm.runInContext("rebuildInteractionCache(); updatePieces()", context)
	for (const piece of delayed) {
		const counter = document.querySelector(`.piece[title^="#${piece.id} "]`)
		assert.equal(counter.parentElement.id, "piece-overlay")
		assert.ok(Number.parseInt(counter.style.left, 10) > 2900)
		assert.ok(Number.parseInt(counter.style.top, 10) > 1100)
	}
})

test("an over-capacity off-map pool expands on demand without replacing counter nodes", () => {
	const { context, window } = loadFrontend()
	const document = window.document
	const axisPieces = Engine.data.pieces.filter((piece) => piece?.side === "axis").slice(0, 30)
	const pieces = Array(Engine.data.pieces.length).fill("removed")
	for (const piece of axisPieces) pieces[piece.id] = "reserve:europe"
	window.view = {
		actions: {},
		pieces,
		reduced: [],
		neutrals: {},
		off_map_units: [],
	}
	vm.runInContext("rebuildInteractionCache(); updatePieces()", context)
	const counters = [...document.querySelectorAll('.piece[data-off-map-key="axis_reserve"]')]
	assert.equal(counters.length, axisPieces.length)
	const firstCounter = counters[0]
	firstCounter.dispatchEvent(new window.Event("click"))
	assert.equal(document.getElementById("focus-box").style.display, "block")
	assert.equal(new Set(counters.map((counter) => `${counter.style.left}:${counter.style.top}`)).size, counters.length)
	assert.equal(document.querySelector(`.piece[title^="#${axisPieces[0].id} "]`), firstCounter)
})

test("published chart keeps its aspect ratio and scrolls safely on narrow screens", () => {
	const css = fs.readFileSync("play.css", "utf8")
	assert.match(css, /#reinforcements\s*\{[\s\S]*?width:\s*1320px/)
	assert.match(css, /\.reinforcement_board\s*\{[\s\S]*?width:\s*1320px;[\s\S]*?height:\s*1020px/)
	assert.match(css, /#reinforcements_wrap\s*\{[\s\S]*?overflow-x:\s*auto/)
	assert.match(css, /@media \(max-width: 800px\)[\s\S]*?#reinforcements_wrap\s*\{[\s\S]*?width:\s*calc\(100vw - 24px\)/)
	assert.match(css, /\.reinforcement_card_hotspot\s*\{[\s\S]*?transition:/)
	assert.match(css, /\.reinforcement_board \.piece\s*\{[\s\S]*?box-sizing:\s*border-box/)
	assert.doesNotMatch(css, /\.reinforcement_block|\.rule_box_board|\.reinforcement_catalog|\.force_pool/)
})
