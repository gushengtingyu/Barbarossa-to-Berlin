"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Orders = require("../modules/systems/orders.js")

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
	assert.deepEqual(Orders.applyPenalties(game), ["Axis", "Allied"])
	assert.equal(game.vp, 7)
})
