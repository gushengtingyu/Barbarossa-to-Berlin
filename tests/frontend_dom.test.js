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
	const queries = []
	window.send_query = (query) => queries.push(query)
	window.innerWidth = 1200
	window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
		this.dataset.scrolledIntoView = "true"
	}
	const context = vm.createContext(window)
	vm.runInContext(fs.readFileSync("modules/core/i18n_catalog.js", "utf8"), context)
	vm.runInContext(fs.readFileSync("modules/core/i18n.js", "utf8"), context)
	vm.runInContext(fs.readFileSync("play.js", "utf8"), context)
	return { context, queries, window }
}

test("supply buttons show split map projections and toggle the overlay off", () => {
	const { context, window } = loadFrontend()
	const game = rules.setup(20260730, "Campaign", {})
	const alliedSupply = rules.query(game, "Observer", "allied_supply")

	window.on_reply("allied_supply", alliedSupply)
	assert.equal(window.document.getElementById("supply_allied").className, "checked")
	const westernFull = Number(Object.entries(alliedSupply.spaces.western).find(([, status]) => status === "full")[0])
	const sovietFull = Number(Object.entries(alliedSupply.spaces.soviet).find(([, status]) => status === "full")[0])
	assert.equal(vm.runInContext(`spaceElements[${westernFull}].classList.contains("supply-western-full")`, context), true)
	assert.equal(vm.runInContext(`spaceElements[${sovietFull}].classList.contains("supply-soviet-full")`, context), true)

	window.toggleSupplyOverlay("allied_supply")
	assert.equal(window.document.getElementById("supply_allied").className, "unchecked")
	assert.equal(window.document.querySelectorAll(".space.supply-overlay").length, 0)

	const axisSupply = rules.query(game, "Observer", "axis_supply")
	window.on_reply("axis_supply", axisSupply)
	const axisFull = Number(Object.entries(axisSupply.spaces.axis).find(([, status]) => status === "full")[0])
	assert.equal(window.document.getElementById("supply_axis").className, "checked")
	assert.equal(vm.runInContext(`spaceElements[${axisFull}].classList.contains("supply-axis-full")`, context), true)
})

test("log headings preserve their first visible character", () => {
	const { window } = loadFrontend()
	const cases = [
		[".h1回合", "h1", "回合"],
		[".h2消耗阶段", "h2", "消耗阶段"],
		[".h3补员阶段", "h3", "补员阶段"],
		[".h3ap盟军行动", "h3 ap", "盟军行动"],
		[".h3cp轴心国行动", "h3 cp", "轴心国行动"],
	]
	for (const [source, className, title] of cases) {
		const heading = window.on_log(source, 0)
		assert.equal(heading.className, className)
		assert.equal(heading.textContent, title)
	}
})

test("PUG-style combat details retain interactive dice, card, unit, and space references", () => {
	const { window } = loadFrontend()
	const card = Engine.data.cards.find((entry) => entry?.id === 56)
	const piece = Engine.data.pieces.find((entry) => entry?.size === "lcu")
	const space = Engine.data.spaces.find((entry) => entry?.kind === "land")
	const modifier = window.on_log(`>> 掷骰修正：+1 事件c${card.id}`, 0)
	const fire = window.on_log(`> B3 + 1 = 4 × 5→4列 = 2`, 1)
	const retreat = window.on_log(`>> P${piece.id}：s${space.id} → s${space.id}`, 2)

	assert.equal(modifier.className, "i detail align")
	assert.equal(modifier.querySelector(".cardtip").textContent, card.name_zh)
	assert.equal(fire.querySelector(".die.cp.d3").getAttribute("aria-label"), "掷骰 3")
	assert.equal(retreat.querySelectorAll(".piecetip").length, 1)
	assert.equal(retreat.querySelectorAll(".spacetip").length, 2)
})

test("attrition uses a dedicated action label and hand borders highlight events only", () => {
	const { context, window } = loadFrontend()
	const labels = new Map()
	window.action_button = (verb, label) => labels.set(verb, label)
	window.view = { state: "axis_attrition", actions: { apply_attrition: 1 } }
	vm.runInContext("renderActionButtons()", context)
	assert.equal(labels.get("apply_attrition"), "结算损耗")

	const [opsOnly, eventPlayable] = Engine.data.cards
		.filter(Boolean)
		.slice(0, 2)
		.map((card) => card.id)
	window.view = {
		hand: [opsOnly, eventPlayable],
		actions: {
			play_ops: [opsOnly, eventPlayable],
			play_event: [eventPlayable],
		},
		combat_cards: {},
	}
	vm.runInContext("rebuildInteractionCache(); updateCards()", context)
	const opsCard = window.document.querySelector(`.card[data-card-id="${opsOnly}"]`)
	const eventCard = window.document.querySelector(`.card[data-card-id="${eventPlayable}"]`)
	assert.equal(opsCard.classList.contains("enabled"), true)
	assert.equal(opsCard.classList.contains("highlight"), false)
	assert.equal(eventCard.classList.contains("highlight"), true)
})

test("deck counters query side card overviews without exposing hidden card faces", () => {
	const { context, queries, window } = loadFrontend()
	const document = window.document
	window.view = {
		hand_count: { allied: 7, axis: 7 },
		deck_count: { allied: 18, axis: 17 },
	}
	vm.runInContext("updateInfo()", context)

	const alliedButton = document.getElementById("allied_deck_size")
	const axisButton = document.getElementById("axis_deck_size")
	assert.equal(alliedButton.tagName, "BUTTON")
	assert.equal(axisButton.tagName, "BUTTON")
	assert.equal(alliedButton.getAttribute("aria-controls"), "card_list_panel")
	assert.match(alliedButton.getAttribute("aria-label"), /盟军/)
	assert.match(axisButton.getAttribute("aria-label"), /轴心国/)
	vm.runInContext(alliedButton.getAttribute("onclick"), context)
	vm.runInContext(axisButton.getAttribute("onclick"), context)
	assert.deepEqual(queries, ["allied_cards", "axis_cards"])

	const alliedCards = Engine.data.cards.filter((card) => card?.side === "allied").slice(0, 3)
	window.on_reply("allied_cards", {
		side: "allied",
		discard: { count: 4, cards: null },
		removed: { count: 1, cards: [alliedCards[0].id] },
		hand_or_deck: { count: 25, cards: null },
	})
	const panel = document.getElementById("card_list_panel")
	let sections = [...document.querySelectorAll("#card_list_body section")]
	assert.equal(panel.hidden, false)
	assert.match(document.getElementById("card_list_title").textContent, /盟军/)
	assert.equal(sections.length, 3)
	assert.match(sections[0].querySelector("h3").textContent, /4/)
	assert.equal(sections[0].querySelectorAll(".card-back").length, 1)
	assert.equal(sections[0].querySelectorAll(".card:not(.card-back)").length, 0)
	assert.match(sections[0].querySelector(".card-back").style.backgroundImage, /card_allied_back\.webp/)
	assert.equal(sections[0].querySelector(".card-back").hasAttribute("data-card-id"), false)
	assert.equal(sections[0].querySelector(".card-back").getAttribute("aria-hidden"), "true")
	assert.match(sections[0].querySelector(".card-query-hidden-label").textContent, /4/)
	assert.equal(sections[1].querySelectorAll(".card:not(.card-back)").length, 1)
	assert.equal(sections[2].querySelectorAll(".card-back").length, 1)
	assert.equal(sections[2].querySelectorAll(".card:not(.card-back)").length, 0)
	assert.match(sections[2].querySelector(".card-query-hidden-label").textContent, /25/)

	window.on_reply("allied_cards", {
		side: "allied",
		discard: { count: 1, cards: [alliedCards[0].id] },
		removed: { count: 0, cards: [] },
		hand_or_deck: { count: 2, cards: [alliedCards[1].id, alliedCards[2].id] },
	})
	sections = [...document.querySelectorAll("#card_list_body section")]
	assert.equal(sections.length, 3)
	assert.equal(document.querySelectorAll("#card_list_body .card-back").length, 0)
	assert.equal(sections[0].querySelectorAll(".card").length, 1)
	assert.match(sections[1].querySelector(".card-query-empty").textContent, /无卡牌/)
	assert.equal(sections[2].querySelectorAll(".card").length, 2)
	window.hideCardQuery()
	assert.equal(panel.hidden, true)
})

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

test("a legal counter in a normal off-map pool sends its piece action immediately", () => {
	const { context, window } = loadFrontend()
	const sent = []
	window.send_action = (...args) => sent.push(args)
	const target = Engine.data.pieces.find((piece) => piece?.side === "allied" && piece.size === "lcu")
	const pieces = Array(Engine.data.pieces.length).fill("removed")
	pieces[target.id] = "eliminated:allied"
	window.view = {
		actions: { piece: [target.id] },
		pieces,
		reduced: [],
		neutrals: {},
		off_map_units: [],
	}
	vm.runInContext("rebuildInteractionCache(); updatePieces()", context)
	const counter = window.document.querySelector(`.piece[title^="#${target.id} "]`)
	assert.equal(counter.classList.contains("highlight"), true)

	counter.dispatchEvent(new window.Event("click"))
	assert.deepEqual(sent, [["piece", target.id]])
})

test("a legal counter in an expanded over-capacity pool sends its piece action", () => {
	const { context, window } = loadFrontend()
	const document = window.document
	const sent = []
	window.send_action = (...args) => sent.push(args)
	const alliedPieces = Engine.data.pieces.filter((piece) => piece?.side === "allied" && piece.size !== "marker").slice(0, 30)
	const target = alliedPieces.find((piece) => piece.size === "lcu")
	const pieces = Array(Engine.data.pieces.length).fill("removed")
	for (const piece of alliedPieces) pieces[piece.id] = "eliminated:allied"
	window.view = {
		actions: { piece: [target.id] },
		pieces,
		reduced: [],
		neutrals: {},
		off_map_units: [],
	}
	vm.runInContext("rebuildInteractionCache(); updatePieces()", context)
	const counter = document.querySelector(`.piece[title^="#${target.id} "]`)
	assert.equal(counter.classList.contains("highlight"), true)

	counter.dispatchEvent(new window.Event("click"))
	assert.equal(document.getElementById("focus-box").style.display, "block")
	assert.deepEqual(sent, [])

	counter.dispatchEvent(new window.Event("click"))
	assert.deepEqual(sent, [["piece", target.id]])
	assert.equal(document.getElementById("focus-box").style.display, "block")
})
test("a legal attacking unit remains clickable after its map stack expands", () => {
	const { context, window } = loadFrontend()
	const document = window.document
	const sent = []
	window.send_action = (...args) => sent.push(args)
	const units = Engine.data.pieces.filter((piece) => piece?.side === "allied" && piece.size !== "marker").slice(0, 2)
	const target = units[0]
	const spaceId = Engine.data.spaces.find((space) => space?.kind === "land").id
	const pieces = Array(Engine.data.pieces.length).fill("removed")
	for (const unit of units) pieces[unit.id] = spaceId
	window.view = {
		state: "ops_combat",
		actions: { piece: [target.id] },
		pieces,
		reduced: [],
		neutrals: {},
		off_map_units: [],
	}
	vm.runInContext("rebuildInteractionCache(); updatePieces()", context)
	const counter = document.querySelector(`.piece[title^="#${target.id} "]`)

	counter.dispatchEvent(new window.Event("click", { bubbles: true }))
	assert.equal(document.getElementById("focus-box").style.display, "block")
	assert.deepEqual(sent, [])

	counter.dispatchEvent(new window.Event("click", { bubbles: true }))
	assert.deepEqual(sent, [["piece", target.id]])
	assert.equal(document.getElementById("focus-box").style.display, "block")

	document.getElementById("map").dispatchEvent(new window.Event("click", { bubbles: true }))
	assert.equal(document.getElementById("focus-box").style.display, "none")
})

test("map capture closes supply without dismissing a focused stack before counter clicks", () => {
	const source = fs.readFileSync("play.js", "utf8")
	const listenerBlock = source.slice(source.indexOf('const mapElement = document.getElementById("map")'), source.indexOf('set_style(localStorage.getItem("btb.style")'))
	assert.match(listenerBlock, /hideSupplyOverlay\(\)[\s\S]*true/)
	assert.match(listenerBlock, /addEventListener\("click", \(\) => focusStack\(null\)\)/)
	assert.doesNotMatch(listenerBlock, /focusStack\(null\)[\s\S]*true/)
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
