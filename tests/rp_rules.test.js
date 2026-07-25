"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")

const { data } = Engine

function card(side, number) {
	return data.cards.find((entry) => entry?.side === side && entry.num === number).id
}

test("Axis RP card limits follow the turn 8 and turn 12 manpower bands", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 2, {})
	game.turn = 8
	game.action_history.axis = ["rp", "ops"]
	assert.equal(Engine.cards.canPlayRpCard(game, "axis"), true)
	game.action_history.axis.push("rp", "ops")
	assert.equal(Engine.cards.canPlayRpCard(game, "axis"), false)
	game.turn = 12
	game.action_history.axis = ["rp", "ops"]
	assert.equal(Engine.cards.canPlayRpCard(game, "axis"), false)
	game.action_history.axis = ["ops"]
	assert.equal(Engine.cards.canPlayRpCard(game, "axis"), true)
})

test("neutral U.S. gains no RP and Moscow or Stalin absence reduces Soviet RP", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 2, {})
	const alliedCard = card("allied", 1)
	let points = Engine.cards.replacementPointsForCard(game, data, "allied", alliedCard)
	assert.deepEqual(points, { br: 2, usa: 0, su: 4 })
	game.control[game.stalin_location] = "axis"
	points = Engine.cards.replacementPointsForCard(game, data, "allied", alliedCard)
	assert.deepEqual(points, { br: 2, usa: 0, su: 3 })
	game.control[game.stalin_location] = "allied"
	game.stalin_location = data.spaces.find((space) => space?.name === "Kuibishev").id
	game.events.us_entry = true
	points = Engine.cards.replacementPointsForCard(game, data, "allied", alliedCard)
	assert.deepEqual(points, { br: 2, usa: 2, su: 3 })
})

test("replacement-card application updates only the owning side's RP buckets", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 2, {})
	const points = Engine.cards.applyReplacementCard(game, data, "axis", card("axis", 3))
	assert.deepEqual({ ge: game.rp.ge, axis: game.rp.axis }, points)
	assert.deepEqual({ br: game.rp.br, usa: game.rp.usa, su: game.rp.su }, { br: 0, usa: 0, su: 0 })
})
