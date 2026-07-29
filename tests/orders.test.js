"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const Orders = require("../modules/systems/orders.js")
const rules = require("../rules.js")

test("Orders table rolls are deterministic and use the official result bands", () => {
	const first = { seed: 99, orders: { axis: null, allied: null } }
	const second = { seed: 99, orders: { axis: null, allied: null } }
	assert.deepEqual(Orders.rollAxis(first), Orders.rollAxis(second))
	assert.deepEqual(Orders.rollAllied(first), Orders.rollAllied(second))
	assert.equal(first.seed, second.seed)
	assert.ok(["none", "okw_mo", "hitler_orders"].includes(first.orders.axis.result))
	assert.ok(["allied_mo", "soviet_mo", "stalin_orders"].includes(first.orders.allied.result))
})

test("unfulfilled Mandated Offensives apply opposite VP movements", () => {
	const game = {
		vp: 7,
		orders: {
			axis: { result: "okw_mo", fulfilled: false },
			allied: { result: "soviet_mo", fulfilled: false },
		},
	}
	assert.deepEqual(Orders.applyPenalties(game), ["axis", "allied"])
	assert.equal(game.vp, 7)
})

test("Mandated Offensive penalty logs name the side that failed", () => {
	const game = rules.setup(8001, "Campaign", {})
	game.turn = 2
	game.vp = 7
	game.orders = {
		axis: { result: "okw_mo", fulfilled: false },
		allied: { result: "soviet_mo", fulfilled: false },
		placements: [],
	}

	Engine.turn.startEndPhases(game)

	const sides = game.log.filter((entry) => entry?.key === "turn.log.mandated_offensive_failed").map((entry) => entry.params.side.en)
	assert.deepEqual(sides, ["The Axis", "The Allies"])
	assert.equal(game.vp, 7)
})

test("Western Allied Mandated Offensive combat accepts only British and U.S. units", () => {
	const data = {
		spaces: [null, { id: 1, nation: "ge" }],
		pieces: [
			null,
			{ id: 1, side: "allied", nation: "br", size: "scu" },
			{ id: 2, side: "allied", nation: "us", size: "scu" },
			{ id: 3, side: "allied", nation: "cw", size: "scu" },
			{ id: 4, side: "allied", nation: "ff", size: "scu" },
		],
	}
	const combat = { attacker_side: "allied", defender_space: 1 }

	for (const [pieceId, expected] of [
		[1, true],
		[2, true],
		[3, false],
		[4, false],
	]) {
		const game = { orders: { allied: { result: "allied_mo", fulfilled: false } } }
		Orders.fulfillForCombat(game, data, { ...combat, attackers: [pieceId] })
		assert.equal(game.orders.allied.fulfilled, expected, `piece ${pieceId}`)
	}
})

function noTargetFixture(piece) {
	return {
		data: {
			spaces: [
				null,
				{ id: 1, kind: "land", nation: piece.nation },
				{ id: 2, kind: "land", nation: "ge" },
			],
			pieces: [null, { id: 1, ...piece }],
		},
		adjacency: [[], [], []],
		game: {
			events: {},
			orders: { axis: null, allied: null },
			pieces: [0, 1],
			control: [null, piece.side, piece.side === "axis" ? "allied" : "axis"],
		},
	}
}

test("a rolled Mandated Offensive is treated as None when its qualifying units have no legal theater target", () => {
	const axis = noTargetFixture({ side: "axis", nation: "ge", size: "scu" })
	axis.game.seed = 4
	const axisRoll = Orders.rollAxis(axis.game, axis.data, axis.adjacency)
	assert.equal(axisRoll.rolled_result, "okw_mo")
	assert.equal(axisRoll.result, "none")
	assert.equal(axisRoll.fulfilled, true)
	assert.equal(axisRoll.ignored, true)

	const western = noTargetFixture({ side: "allied", nation: "br", size: "scu" })
	western.game.seed = 1
	const westernRoll = Orders.rollAllied(western.game, western.data, western.adjacency)
	assert.equal(westernRoll.rolled_result, "allied_mo")
	assert.equal(westernRoll.result, "none")
	assert.equal(westernRoll.fulfilled, true)
	assert.equal(westernRoll.ignored, true)

	const soviet = noTargetFixture({ side: "allied", nation: "su", size: "lcu" })
	soviet.game.seed = 2
	const sovietRoll = Orders.rollAllied(soviet.game, soviet.data, soviet.adjacency)
	assert.equal(sovietRoll.rolled_result, "soviet_mo")
	assert.equal(sovietRoll.result, "none")
	assert.equal(sovietRoll.fulfilled, true)
	assert.equal(sovietRoll.ignored, true)
})

test("a connected enemy-controlled space keeps a rolled Mandated Offensive in force", () => {
	const western = noTargetFixture({ side: "allied", nation: "br", size: "scu" })
	western.game.seed = 1
	western.adjacency[1].push({ to: 2, type: "regular" })
	western.adjacency[2].push({ to: 1, type: "regular" })

	const roll = Orders.rollAllied(western.game, western.data, western.adjacency)

	assert.equal(roll.result, "allied_mo")
	assert.equal(roll.fulfilled, false)
	assert.equal(roll.ignored, undefined)
})

function theaterLullFixture(seed) {
	return {
		data: {
			spaces: [
				null,
				{ id: 1, kind: "land", nation: "ge" },
				{ id: 2, kind: "land", nation: "fr" },
				{ id: 3, kind: "land", nation: "eg" },
				{ id: 4, kind: "land", nation: "ly" },
				{ id: 5, kind: "land", nation: "tn" },
				{ id: 6, kind: "land", nation: "it" },
				{ id: 7, kind: "land", nation: "su" },
				{ id: 8, kind: "land", nation: "su" },
				{ id: 9, kind: "beach", nation: "sea" },
				{ id: 10, kind: "land", nation: "dz" },
				{ id: 11, kind: "beach", nation: "sea" },
			],
			pieces: [
				null,
				{ id: 1, side: "axis", nation: "ge", size: "lcu" },
				{ id: 2, side: "allied", nation: "br", size: "scu" },
				{ id: 3, side: "axis", nation: "it", size: "scu" },
				{ id: 4, side: "allied", nation: "cw", size: "scu" },
				{ id: 5, side: "allied", nation: "su", size: "lcu" },
			],
		},
		adjacency: [
			[],
			[{ to: 2, type: "regular" }],
			[{ to: 1, type: "regular" }],
			[{ to: 4, type: "regular" }],
			[{ to: 3, type: "regular" }],
			[],
			[],
			[{ to: 8, type: "regular" }],
			[{ to: 7, type: "regular" }],
			[{ to: 2, type: "regular" }],
			[{ to: 11, type: "regular" }],
			[{ to: 10, type: "regular" }],
		],
		game: {
			seed,
			vp: 7,
			events: {},
			orders: { axis: null, allied: null },
			pieces: [0, 1, 3, "reserve:axis", "reserve:allied", 7],
			control: [null, "axis", "allied", "allied", "axis", "neutral", "neutral", "allied", "axis", "neutral", "neutral", "neutral"],
		},
	}
}

function assertActiveMandatedOffensive(order, result) {
	assert.equal(order.result, result)
	assert.equal(order.fulfilled, false)
	assert.equal(order.rolled_result, undefined)
	assert.equal(order.ignored, undefined)
}

test("Rule 8.3 theater lull ignores Axis and Allied Mandated Offensives despite empty controlled targets", () => {
	const axis = theaterLullFixture(4)
	const axisRoll = Orders.rollAxis(axis.game, axis.data, axis.adjacency)
	assert.equal(axisRoll.rolled_result, "okw_mo")
	assert.equal(axisRoll.result, "none")
	assert.equal(axisRoll.fulfilled, true)
	assert.equal(axisRoll.ignored, true)
	assert.deepEqual(Orders.applyPenalties(axis.game), [])
	assert.equal(axis.game.vp, 7)

	const western = theaterLullFixture(1)
	const westernRoll = Orders.rollAllied(western.game, western.data, western.adjacency)
	assert.equal(westernRoll.rolled_result, "allied_mo")
	assert.equal(westernRoll.result, "none")
	assert.equal(westernRoll.fulfilled, true)
	assert.equal(westernRoll.ignored, true)
	assert.deepEqual(Orders.applyPenalties(western.game), [])
	assert.equal(western.game.vp, 7)
})

test("any Axis combat unit in North Africa ends the Rule 8.3 theater lull", () => {
	const axis = theaterLullFixture(4)
	axis.game.pieces[3] = 5
	assertActiveMandatedOffensive(Orders.rollAxis(axis.game, axis.data, axis.adjacency), "okw_mo")

	const western = theaterLullFixture(1)
	western.game.pieces[3] = 5
	assertActiveMandatedOffensive(Orders.rollAllied(western.game, western.data, western.adjacency), "allied_mo")
})

test("any Western Allied combat unit in Europe ends the Rule 8.3 theater lull", () => {
	const axis = theaterLullFixture(4)
	axis.game.pieces[4] = 6
	assertActiveMandatedOffensive(Orders.rollAxis(axis.game, axis.data, axis.adjacency), "okw_mo")

	const western = theaterLullFixture(1)
	western.game.pieces[4] = 6
	assertActiveMandatedOffensive(Orders.rollAllied(western.game, western.data, western.adjacency), "allied_mo")
})

test("Rule 8.3 classifies beach units by their adjacent land theater", () => {
	const europeanBeach = theaterLullFixture(4)
	europeanBeach.game.pieces[4] = 9
	assertActiveMandatedOffensive(Orders.rollAxis(europeanBeach.game, europeanBeach.data, europeanBeach.adjacency), "okw_mo")

	const northAfricaBeach = theaterLullFixture(4)
	northAfricaBeach.game.pieces[4] = 11
	const ignored = Orders.rollAxis(northAfricaBeach.game, northAfricaBeach.data, northAfricaBeach.adjacency)
	assert.equal(ignored.rolled_result, "okw_mo")
	assert.equal(ignored.result, "none")
	assert.equal(ignored.fulfilled, true)
	assert.equal(ignored.ignored, true)
})

test("an Allied unit that advances outside the USSR into Europe ends the Rule 8.3 theater lull", () => {
	const game = theaterLullFixture(4)
	game.game.pieces[5] = 2
	assertActiveMandatedOffensive(Orders.rollAxis(game.game, game.data, game.adjacency), "okw_mo")
})

test("Rule 8.3 theater lull does not ignore a Soviet Mandated Offensive", () => {
	const soviet = theaterLullFixture(2)
	assertActiveMandatedOffensive(Orders.rollAllied(soviet.game, soviet.data, soviet.adjacency), "soviet_mo")
})
