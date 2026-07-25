"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { ALLIED, AXIS } = Engine.constants
const { data } = Engine

function actionGame(round, remaining) {
	const game = Engine.setup.createInitialState(data, "Campaign", 701, {})
	game.turn = 2
	game.action_round = round
	game.phase = "action"
	game.state = "action_select"
	game.active = "Axis"
	game.events.von_paulus_pause = true
	game.events.axis_forced_auto_ops = remaining
	game.hands[AXIS] = [data.cards.find((card) => card?.side === AXIS && card.num === 3).id]
	game.action_history = { [ALLIED]: [], [AXIS]: [] }
	game.action_track = { [ALLIED]: [], [AXIS]: [] }
	return game
}

test("Von Paulus permits an early start, then forces the consecutive second 1 OPS round", () => {
	let game = actionGame(1, 2)
	let actions = rules.view(game, "Axis").actions
	assert.equal(actions.auto_ops, 1)
	assert.ok(actions.play_ops.length > 0)

	game = rules.action(game, "Axis", "auto_ops")
	assert.equal(game.action.points, 1)
	assert.equal(game.action.von_paulus_no_soviet_combat, true)
	assert.equal(game.events.axis_forced_auto_ops, 1)

	const soviet = data.pieces.find((piece) => piece?.nation === "su" && Number.isInteger(game.pieces[piece.id]) && game.pieces[piece.id] > 0)
	const westernAllied = data.pieces.find((piece) => ["br", "cw"].includes(piece?.nation) && Number.isInteger(game.pieces[piece.id]) && game.pieces[piece.id] > 0)
	assert.ok(soviet)
	assert.ok(westernAllied)
	assert.equal(Engine.combat.mayAttackSpace(game, data, AXIS, game.pieces[soviet.id]), false)
	assert.equal(Engine.combat.mayAttackSpace(game, data, AXIS, game.pieces[westernAllied.id]), true)

	game.state = "action_select"
	game.active = "Axis"
	game.action_round = 2
	actions = rules.view(game, "Axis").actions
	assert.equal(actions.auto_ops, 1)
	assert.equal(actions.play_ops, undefined)
	assert.deepEqual(
		Object.keys(actions).filter((verb) => !["undo", "flag_supply_warnings"].includes(verb)),
		["auto_ops"],
	)

	game = rules.action(game, "Axis", "auto_ops")
	assert.equal(game.events.axis_forced_auto_ops, 0)
	assert.equal(game.action.von_paulus_no_soviet_combat, true)
})

test("Von Paulus forces rounds 3 and 4 when the Axis has not started the pair", () => {
	let game = actionGame(3, 2)
	let actions = rules.view(game, "Axis").actions
	assert.equal(actions.auto_ops, 1)
	assert.equal(actions.play_ops, undefined)

	game = rules.action(game, "Axis", "auto_ops")
	assert.equal(game.events.axis_forced_auto_ops, 1)

	game.state = "action_select"
	game.active = "Axis"
	game.action_round = 4
	actions = rules.view(game, "Axis").actions
	assert.equal(actions.auto_ops, 1)
	assert.equal(actions.play_ops, undefined)

	game = rules.action(game, "Axis", "auto_ops")
	assert.equal(game.events.axis_forced_auto_ops, 0)
})

test("an unoccupied Axis VP space with Partisans counts for the Allies until Axis occupation", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 703, {})
	const athens = data.spaces.find((space) => space?.name === "Athens")
	const axisOccupants = Engine.map.friendlyPiecesInSpace(game, data, AXIS, athens.id)
	assert.ok(axisOccupants.length > 0)
	for (const pieceId of axisOccupants) game.pieces[pieceId] = "reserve:axis"

	const before = game.vp
	game.partisans.push(athens.id)
	assert.equal(Engine.map.syncPartisanVp(game, data), -athens.vp)
	assert.equal(game.vp, before - athens.vp)
	assert.equal(game.partisan_vp_adjustment, -athens.vp)

	const occupier = axisOccupants[0]
	Engine.map.enterSpace(game, data, occupier, athens.id)
	assert.equal(game.vp, before)
	assert.equal(game.partisan_vp_adjustment, 0)

	const berlin = data.spaces.find((space) => space?.name === "Berlin")
	Engine.map.enterSpace(game, data, occupier, berlin.id)
	assert.equal(game.vp, before - athens.vp)
	assert.equal(game.partisan_vp_adjustment, -athens.vp)

	Engine.events.removePartisan(game, data, athens.id)
	assert.equal(game.vp, before)
	assert.equal(game.partisan_vp_adjustment, 0)
})

test("Partisan effective VP neither double-charges a control flip nor alters Winter 5.2 control", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 704, {})
	const athens = data.spaces.find((space) => space?.name === "Athens")
	for (const pieceId of Engine.map.friendlyPiecesInSpace(game, data, AXIS, athens.id)) game.pieces[pieceId] = "reserve:axis"
	game.partisans.push(athens.id)
	Engine.map.syncPartisanVp(game, data)
	const partisanVp = game.vp

	Engine.map.setControl(game, data, athens.id, ALLIED, "br")
	assert.equal(game.vp, partisanVp)
	assert.equal(game.partisan_vp_adjustment, 0)
	assert.equal(game.partisans.includes(athens.id), false)

	const sovietVp = data.spaces.find((space) => space?.vp && space.nation === "su")
	game.control[sovietVp.id] = AXIS
	game.partisans.push(sovietVp.id)
	for (const pieceId of Engine.map.friendlyPiecesInSpace(game, data, AXIS, sovietVp.id)) game.pieces[pieceId] = "reserve:axis"
	Engine.map.syncPartisanVp(game, data)
	game.turn = 4
	assert.equal(
		Engine.turn.winterVpSpaces(game).some((space) => space.id === sovietVp.id),
		true,
	)
})

test("Partisan effective VP is reconciled before an End Phase automatic-victory check", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 705, {})
	const athens = data.spaces.find((space) => space?.name === "Athens")
	for (const pieceId of Engine.map.friendlyPiecesInSpace(game, data, AXIS, athens.id)) game.pieces[pieceId] = "reserve:axis"
	game.partisans.push(athens.id)
	game.partisan_vp_adjustment = 0
	game.vp = athens.vp

	Engine.turn.finishTurn(game)
	assert.equal(game.vp, 0)
	assert.equal(game.result, "Allied")
	assert.equal(game.state, "game_over")
})

test("reconciling a newly placed Partisan does not let a forged action mutate the saved game", () => {
	const game = actionGame(1, 0)
	const athens = data.spaces.find((space) => space?.name === "Athens")
	for (const pieceId of Engine.map.friendlyPiecesInSpace(game, data, AXIS, athens.id)) game.pieces[pieceId] = "reserve:axis"
	game.partisans.push(athens.id)
	const before = JSON.stringify(game)

	assert.throws(() => rules.action(game, "Axis", "forged"), /illegal action/)
	assert.equal(JSON.stringify(game), before)
})
