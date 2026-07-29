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
