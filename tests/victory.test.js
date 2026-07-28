"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog, renderMessage } = require("./i18n_helpers.js")
const Engine = require("../modules/engine.js")

const { ALLIED, AXIS } = Engine.constants
const { data } = Engine

function actionGame() {
	const game = Engine.setup.createInitialState(data, "Campaign", 97, {})
	game.turn = 2
	game.phase = "action"
	game.state = "action_select"
	game.active = "Allied"
	game.action_round = 3
	game.action = { mode: "ops" }
	game.action_history = { [ALLIED]: [], [AXIS]: [] }
	return game
}

function germanSupplySpaces() {
	return data.spaces.filter((space) => space?.kind === "land" && space.nation === "ge" && space.supply === "axis")
}

test("Rule 5.3 gives the Allies immediate victory after an Allied action controlling every German Axis supply space", () => {
	const game = actionGame()
	const sources = germanSupplySpaces()
	assert.deepEqual(sources.map((space) => space.name).sort(), ["Berlin", "Breslau", "Ruhr"])
	for (const space of sources) game.control[space.id] = ALLIED

	Engine.turn.finishAction(game, ALLIED)

	assert.equal(game.state, "game_over")
	assert.equal(game.phase, "game_over")
	assert.equal(game.active, "None")
	assert.equal(game.result, "Allied")
	assert.match(renderMessage(game.victory), /德国全部轴心补给源/)
	assert.equal(game.undo.length, 0)
})

test("Rule 5.3 does not trigger while one German Axis supply space remains Axis controlled", () => {
	const game = actionGame()
	const sources = germanSupplySpaces()
	for (const space of sources.slice(0, -1)) game.control[space.id] = ALLIED
	game.control[sources.at(-1).id] = AXIS

	Engine.turn.finishAction(game, ALLIED)

	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Axis")
	assert.equal(game.action_round, 4)
	assert.equal(game.result, undefined)
})

test("Rule 5.1 adjusts VP exactly once when an Axis VP space changes control", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 101, {})
	const brest = data.spaces.find((space) => space?.name === "Brest")
	assert.equal(brest.vp, 1)
	assert.equal(game.control[brest.id], AXIS)

	assert.equal(Engine.map.setControl(game, data, brest.id, ALLIED), true)
	assert.equal(game.vp, 6)
	assert.match(renderLog(game).at(-1), /s6.*VP-1/)
	assert.equal(Engine.map.setControl(game, data, brest.id, ALLIED), false)
	assert.equal(game.vp, 6)
	assert.equal(Engine.map.setControl(game, data, brest.id, AXIS), true)
	assert.equal(game.vp, 7)
	assert.match(renderLog(game).at(-1), /s6.*VP\+1/)
})

test("Rule 5.1 scores neutral Vichy VP spaces by Axis control", () => {
	for (const name of ["Marseille", "Tunis"]) {
		const space = data.spaces.find((entry) => entry?.name === name)
		assert.equal(space.vp, 1)

		const axisFirst = Engine.setup.createInitialState(data, "Campaign", 103, {})
		assert.equal(axisFirst.control[space.id], "neutral")
		assert.equal(Engine.map.setControl(axisFirst, data, space.id, AXIS), true)
		assert.equal(axisFirst.vp, 8)
		assert.match(renderLog(axisFirst).at(-1), new RegExp(`s${space.id}.*VP\\+1`))
		assert.equal(Engine.map.setControl(axisFirst, data, space.id, ALLIED), true)
		assert.equal(axisFirst.vp, 7)
		assert.match(renderLog(axisFirst).at(-1), new RegExp(`s${space.id}.*VP-1`))

		const alliedFirst = Engine.setup.createInitialState(data, "Campaign", 107, {})
		assert.equal(alliedFirst.control[space.id], "neutral")
		assert.equal(Engine.map.setControl(alliedFirst, data, space.id, ALLIED), true)
		assert.equal(alliedFirst.vp, 7)
		assert.equal(Engine.map.setControl(alliedFirst, data, space.id, AXIS), true)
		assert.equal(alliedFirst.vp, 8)
		assert.match(renderLog(alliedFirst).at(-1), new RegExp(`s${space.id}.*VP\\+1`))
	}
})

test("Rule 5.2 applies the Winter VP requirement including Courland and Herkules", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 107, {})
	const regional = data.spaces.filter((space) => space?.vp && ["su", "eg", "iq"].includes(space.nation))
	for (const space of regional) game.control[space.id] = ALLIED
	for (const space of regional.slice(0, 3)) game.control[space.id] = AXIS

	game.turn = 4
	game.vp = 7
	assert.equal(Engine.turn.applyWinterVpPenalty(game), 2)
	assert.equal(game.vp, 5)
	assert.match(renderLog(game).at(-1), /仅控制3个计分格，VP-2/)

	game.turn = 16
	game.vp = 7
	for (const space of regional) game.control[space.id] = ALLIED
	const courland = data.spaces.find((space) => space?.name === "Courland")
	game.control[courland.id] = AXIS
	assert.equal(Engine.turn.applyWinterVpPenalty(game), 0)

	game.control[courland.id] = ALLIED
	game.events.herkules = true
	const tobruk = data.spaces.find((space) => space?.name === "Tobruk")
	game.control[tobruk.id] = AXIS
	assert.equal(Engine.turn.applyWinterVpPenalty(game), 0)
})

test("Rule 5.2 Winter penalty can cause Allied automatic victory", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 109, {})
	for (const space of data.spaces.filter((entry) => entry?.vp && ["su", "eg", "iq"].includes(entry.nation))) game.control[space.id] = ALLIED
	game.turn = 4
	game.vp = 5

	Engine.turn.finishTurn(game)

	assert.equal(game.vp, 0)
	assert.equal(game.state, "game_over")
	assert.equal(game.result, "Allied")
})
