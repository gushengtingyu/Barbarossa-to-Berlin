"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const rules = require("../rules.js")
const Engine = require("../modules/engine.js")
const I18n = require("../modules/core/i18n.js")

function makeActionGame(seed = 301, options = {}) {
	const game = rules.setup(seed, "Campaign", options)
	game.phase = "action"
	game.state = "action_select"
	game.active = "Axis"
	game.turn = 2
	game.action_round = 2
	game.action = null
	game.log.push(I18n.message("core.blank"))
	Engine.collaboration.saveRollbackPoint(game)
	return game
}

test("rollback proposals require the opponent and rejection restores the original live state", () => {
	let game = makeActionGame()
	Engine.state.pushUndo(game)
	const before = JSON.stringify(game)
	const view = rules.view(game, "Axis")
	assert.deepEqual(view.actions.propose_rollback, [0])
	assert.equal(view.rollback_state, undefined)

	game = rules.action(game, "Axis", "propose_rollback", 0)
	assert.equal(game.state, "review_rollback_proposal")
	assert.equal(game.active, "Allied")
	assert.equal(rules.view(game, "Allied").actions.accept, 1)
	assert.equal(rules.view(game, "Axis").actions, undefined)
	assert.throws(() => rules.action(game, "Axis", "reject"), /illegal action/)

	game = rules.action(game, "Allied", "reject")
	assert.equal(JSON.stringify(game), before)
})

test("accepted rollback restores the checkpoint, preserves the current PRNG seed, and records a replayable audit", () => {
	let game = makeActionGame(302)
	const checkpointVp = game.vp
	game.vp = 12
	game.seed = 987654321
	game.log.push(I18n.message("core.blank"))
	game.action_log.push({ player: "Axis", verb: "pass", noun: null })

	game = rules.action(game, "Axis", "propose_rollback", 0)
	game = rules.action(game, "Allied", "accept")
	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Axis")
	assert.equal(game.vp, checkpointVp)
	assert.equal(game.seed, 987654321)
	assert.equal(game.undo.length, 0)
	assert.equal(game.rollback.length, 1)
	assert.equal(game.action_log.at(-1).player, "System")
	assert.equal(game.action_log.at(-1).verb, "rollback_seed")
	assert.equal(game.action_log.at(-1).noun.rollback_count, 1)
	assert.match(I18n.render("zh-CN", game.log.at(-1)), /双方同意回滚到/)
})

test("rollback PRNG audit entries reproduce exactly without exposing discarded actions", () => {
	const game = rules.setup(303, "Campaign", {})
	game.undo = [{ state: "transient" }]
	Engine.collaboration.applyRollbackAudit(game, {
		seed: 246813579,
		name: I18n.message("core.rollback.action_round", { turn: 2, round: 1, side: I18n.message("core.role.axis") }),
		proposer: "Axis",
		reviewer: "Allied",
	})
	assert.deepEqual(game.undo, [])
	const replayed = rules.replay(303, "Campaign", {}, game.action_log)
	assert.equal(JSON.stringify(replayed), JSON.stringify(game))
})

test("active players can flag land spaces and the next player must acknowledge them", () => {
	let game = makeActionGame(304)
	const target = Engine.data.spaces.find((space) => space?.kind === "land").id

	game = rules.action(game, "Axis", "flag_supply_warnings")
	assert.equal(game.state, "flag_supply_warnings")
	assert.ok(rules.view(game, "Axis").actions.space.includes(target))
	game = rules.action(game, "Axis", "space", target)
	assert.deepEqual(game.supply_warnings, [target])
	assert.equal(rules.view(game, "Allied").supply_warnings.includes(target), true)
	game = rules.action(game, "Axis", "done")
	assert.equal(game.state, "action_select")

	game = rules.action(game, "Axis", "auto_ops")
	game = rules.action(game, "Axis", "done")
	assert.equal(game.state, "review_supply_warnings")
	assert.equal(game.active, "Allied")
	assert.equal(game.rollback.at(-1).active, "Allied")
	assert.equal(Engine.collaboration.decodeRollbackStates(game.rollback_state).at(-1).action_log.at(-1).verb, "done")
	assert.deepEqual(game.supply_warnings, [target])
	assert.equal(rules.view(game, "Allied").actions.done, 1)
	assert.equal(rules.view(game, "Axis").actions, undefined)

	game = rules.action(game, "Allied", "done")
	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Allied")
	assert.equal(game.supply_warnings, undefined)
	assert.match(I18n.render("zh-CN", game.log.at(-1)), /确认收到1处补给警告/)
})

test("collaborative features are mandatory and have no disable option", () => {
	const game = makeActionGame(305)
	const view = rules.view(game, "Axis")
	assert.equal(view.actions.flag_supply_warnings, 1)
	assert.deepEqual(view.actions.propose_rollback, [0])
	assert.equal(game.rollback.length, 1)
})
