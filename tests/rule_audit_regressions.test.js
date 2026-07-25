"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine
const adjacency = Engine.map.buildAdjacency(data)
const space = (name) => data.spaces.find((entry) => entry?.name === name).id
const piece = (predicate) => data.pieces.find(predicate).id

function occupationGame() {
	const game = Engine.setup.createInitialState(data, "Campaign", 41, {})
	game.orders = {
		axis: { result: "none", fulfilled: true },
		allied: { result: "stalin_orders", fulfilled: true },
	}
	return game
}

test("Rule 8.2 occupation fulfills each qualifying Mandated Offensive without accepting Free French units", () => {
	let game = occupationGame()
	const soviet = piece((entry) => entry?.nation === "su")
	const kaunas = space("Kaunas")
	game.orders.allied = { result: "soviet_mo", fulfilled: false }
	game.control[kaunas] = "axis"
	Engine.map.enterSpace(game, data, soviet, kaunas)
	assert.equal(game.orders.allied.fulfilled, true)

	game = occupationGame()
	const british = piece((entry) => entry?.nation === "br")
	const cairo = space("Cairo")
	game.orders.allied = { result: "allied_mo", fulfilled: false }
	game.control[cairo] = "axis"
	Engine.map.enterSpace(game, data, british, cairo)
	assert.equal(game.orders.allied.fulfilled, true)

	game = occupationGame()
	const german = piece((entry) => entry?.nation === "ge")
	const berlin = space("Berlin")
	game.orders.axis = { result: "okw_mo", fulfilled: false }
	game.control[berlin] = "allied"
	Engine.map.enterSpace(game, data, german, berlin)
	assert.equal(game.orders.axis.fulfilled, true)

	game = occupationGame()
	const freeFrench = piece((entry) => entry?.nation === "ff")
	game.orders.allied = { result: "allied_mo", fulfilled: false }
	game.control[cairo] = "axis"
	Engine.map.enterSpace(game, data, freeFrench, cairo)
	assert.equal(game.orders.allied.fulfilled, false)
})

test("Rules 13.7 and 19.6 protect Malta and Tito-controlled Yugoslavia from OOS control conversion", () => {
	const malta = space("Malta")
	const zagreb = space("Zagreb")
	let game = Engine.setup.createInitialState(data, "Campaign", 42, {})
	game.pieces.fill(0)
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.control[malta] = "allied"
	let resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "allied")
	assert.equal(game.control[malta], "allied")
	assert.equal(resolved.changedControl.includes(malta), false)

	game = Engine.setup.createInitialState(data, "Campaign", 43, {})
	game.pieces.fill(0)
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.control[zagreb] = "allied"
	game.events.tito = true
	resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "allied")
	assert.equal(game.control[zagreb], "allied")
	assert.equal(resolved.changedControl.includes(zagreb), false)

	game.events.tito = false
	resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "allied")
	assert.equal(game.control[zagreb], "axis")
	assert.equal(resolved.changedControl.includes(zagreb), true)
})

test("Rule 13.5 uses the occupying Western nation when an empty controlled space traces to a national beachhead", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Bridgehead perimeter", kind: "land", nation: "fr", side: "axis" }, { id: 2, name: "Beachhead D", kind: "beach", nation: "sea", side: "neutral", beach_letter: "D" }],
		pieces: [null],
	}
	const localAdjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]
	const game = {
		beachheads: { 2: { type: "br" } },
		control: [null, "allied", "allied"],
		control_nation: [null, "br", null],
		destroyed_forts: [],
		eliminated_theater: {},
		events: {},
		options: {},
		orders: {},
		partisans: [],
		pieces: [0],
		reduced: [],
		stand_fast: {},
		trench: {},
		trench_kind: {},
		trench_owner: {},
		turn: 8,
		vp: 7,
	}
	let resolved = Engine.logistics.resolveAttrition(game, localData, Engine.map, localAdjacency, "allied")
	assert.equal(game.control[1], "allied")
	assert.deepEqual(resolved.changedControl, [])

	game.control_nation[1] = "us"
	resolved = Engine.logistics.resolveAttrition(game, localData, Engine.map, localAdjacency, "allied")
	assert.equal(game.control[1], "axis")
	assert.deepEqual(resolved.changedControl, [1])
})

test("Rule 19.6 keeps the YPA supplied and permits Soviet transit and advance but not movement ending in Yugoslavia", () => {
	const ypa = piece((entry) => entry?.name === "YU YPA Army")
	const soviet = piece((entry) => entry?.nation === "su" && entry.size === "lcu")
	const zagreb = space("Zagreb")
	let game = Engine.setup.createInitialState(data, "Campaign", 44, {})
	game.pieces.fill(0)
	game.pieces[ypa] = zagreb
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.control[zagreb] = "allied"
	game.events.tito = true
	assert.equal(Engine.logistics.supplyStatus(game, data, Engine.map, adjacency, ypa), "full")
	const resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "allied")
	assert.equal(resolved.eliminated.includes(ypa), false)
	assert.equal(game.pieces[ypa], zagreb)

	const yugoslavTarget = data.spaces.find(
		(entry) => entry?.kind === "land" && entry.nation === "yu" && adjacency[entry.id].some((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && data.spaces[edge.to].nation !== "yu"),
	)
	const origin = adjacency[yugoslavTarget.id].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && data.spaces[edge.to].nation !== "yu").to
	game = Engine.setup.createInitialState(data, "Campaign", 45, {})
	game.pieces.fill(0)
	game.pieces[soviet] = origin
	game.control = data.spaces.map((entry) => (entry ? "allied" : null))
	game.events.tito = true
	game.action = { attack_spaces: [], activation_supply: {}, sr_moved: [], moved: [] }
	assert.equal(Engine.restrictions.mayEnter(game, data, adjacency, soviet, yugoslavTarget.id), true)
	assert.equal(Engine.map.legalMoveDestinations(game, data, adjacency, soviet).includes(yugoslavTarget.id), false)
	const combat = {
		origin_spaces: [origin],
		defender_space: yugoslavTarget.id,
		attackers: [soviet],
		defenders: [],
		advanced: [],
		attacker_side: "allied",
		defender_side: "axis",
		retreat_paths: {},
	}
	assert.equal(Engine.combat.legalAdvancePaths(game, data, Engine.map, adjacency, combat, soviet).has(yugoslavTarget.id), true)
})

test("Rule 5.5 forces Stalin from Moscow to Kuibishev and exposes the public SR workflow", () => {
	let game = rules.setup(46, "Campaign", {})
	game.control = data.spaces.map((entry) => (entry ? "allied" : null))
	game.active = "Allied"
	game.state = "sr_piece"
	game.phase = "action"
	game.turn = 5
	game.action_round = 1
	game.action = {
		mode: "sr",
		track: "sr",
		points: 1,
		sr_moved: [],
		stalin_moved: false,
		sr_reserve_entries: {},
		piece: null,
	}
	const moscow = space("Moscow")
	const kuibishev = space("Kuibishev")
	game.stalin_location = moscow
	assert.deepEqual(Engine.stalin.legalDestinations(game, data, Engine.map, adjacency), [kuibishev])
	let view = rules.view(game, "Allied")
	assert.equal(view.stalin_location, moscow)
	assert.equal(view.actions.stalin, 1)
	game = rules.action(game, "Allied", "stalin")
	assert.equal(game.state, "sr_stalin_destination")
	view = rules.view(game, "Allied")
	assert.deepEqual(view.actions.move, [kuibishev])
	game = rules.action(game, "Allied", "move", kuibishev)
	assert.equal(game.stalin_location, kuibishev)
	assert.equal(game.action, null)
})

test("Rule 5.5 eliminates Stalin for capture or qualifying Allied attrition and normalization preserves elimination", () => {
	const moscow = space("Moscow")
	const german = piece((entry) => entry?.nation === "ge")
	let game = Engine.setup.createInitialState(data, "Campaign", 47, {})
	game.vp = 7
	game.control[moscow] = "allied"
	Engine.map.enterSpace(game, data, german, moscow)
	assert.equal(game.stalin_location, null)
	assert.equal(game.events.stalin_eliminated_reason, "capture")
	assert.equal(game.vp, 12)
	assert.equal(Engine.state.normalizeGame(game).stalin_location, null)

	game = Engine.setup.createInitialState(data, "Campaign", 48, {})
	game.vp = 7
	game.pieces.fill(0)
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.control[moscow] = "allied"
	game.stalin_location = moscow
	Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "allied")
	assert.equal(game.stalin_location, null)
	assert.equal(game.events.stalin_eliminated_reason, "attrition")
	assert.equal(game.vp, 12)
})
