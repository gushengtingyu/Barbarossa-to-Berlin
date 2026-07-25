"use strict"

const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const assert = require("node:assert/strict")
const Constants = require("../modules/core/constants.js")
const Engine = require("../modules/engine.js")
const State = require("../modules/core/state.js")
const Events = require("../modules/systems/events.js")
const States = require("../modules/states/index.js")
const rules = require("../rules.js")

const ROOT = path.resolve(__dirname, "..")

test("early development rejects old schemas instead of carrying migrations", () => {
	assert.equal(State.applyMigrations, undefined)
	const game = rules.setup(1, "Campaign", {})
	assert.throws(() => State.normalizeGame({ ...game, schema_version: game.schema_version - 1 }), /不支持的存档版本/)
})

test("side inversion is centralized and rejects invalid internal values", () => {
	assert.equal(Constants.otherSide(Constants.ALLIED), Constants.AXIS)
	assert.equal(Constants.otherSide(Constants.AXIS), Constants.ALLIED)
	assert.throws(() => Constants.otherSide("observer"), /unknown side/)
})

test("die logs use faction colors and modifier notation", () => {
	assert.equal(State.formatDie(Constants.ALLIED, 4), "W4")
	assert.equal(State.formatDie(Constants.AXIS, 4, 1, 5), "B4 + 1 = 5")
	assert.equal(State.formatDie(Constants.ALLIED, 4, -2, 2), "W4 - 2 = 2")
})

test("runtime map adjacency is cached and read-only", () => {
	const adjacency = Engine.map.buildAdjacency(Engine.data)
	assert.equal(adjacency, Engine.adjacency)
	assert.equal(Object.isFrozen(adjacency), true)
	assert.equal(Object.isFrozen(adjacency.find((edges) => edges.length)), true)
	assert.equal(Object.isFrozen(adjacency.find((edges) => edges.length)[0]), true)
})

test("systems receive runtime data through their API instead of importing generated data", () => {
	const systems = path.join(ROOT, "modules", "systems")
	for (const name of fs.readdirSync(systems).filter((file) => file.endsWith(".js"))) {
		const source = fs.readFileSync(path.join(systems, name), "utf8")
		assert.doesNotMatch(source, /require\(["'][^"']*data\.js["']\)/, name)
	}
})

test("production workflows declare dependencies without importing the compatibility engine", () => {
	for (const relative of ["modules/states", "modules/view.js", "rules.js"]) {
		const target = path.join(ROOT, relative)
		const files = fs.statSync(target).isDirectory()
			? fs
					.readdirSync(target)
					.filter((file) => file.endsWith(".js"))
					.map((file) => path.join(target, file))
			: [target]
		for (const file of files) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /require\(["'][^"']*engine\.js["']\)/, path.relative(ROOT, file))
	}
})

test("registered state metadata contains only prompt, undo, and action handlers", () => {
	for (const [name, spec] of States.stateEntries()) {
		for (const [key, value] of Object.entries(spec)) {
			if (key === "undo") assert.equal(typeof value, "boolean", `${name}.${key}`)
			else assert.equal(typeof value, "function", `${name}.${key}`)
		}
	}
})

test("optional player prompts use concise action phrasing", () => {
	const combatStates = fs.readFileSync(path.join(ROOT, "modules", "states", "states_combat.js"), "utf8")
	const allStatePrompts = ["states_turn.js", "states_action.js", "states_activation.js", "states_combat.js", "event_states.js"].map((name) => fs.readFileSync(path.join(ROOT, "modules", "states", name), "utf8")).join("\n")

	assert.match(combatStates, /"combat\.attacker\.cards_none"/)
	assert.match(combatStates, /"combat\.defender\.cards_none"/)
	assert.doesNotMatch(allStatePrompts, /可打出或启用符合条件的战斗牌/)
	assert.doesNotMatch(allStatePrompts, /可选择额外的进攻空间/)
	assert.doesNotMatch(allStatePrompts, /可将符合条件的/)
	assert.doesNotMatch(allStatePrompts, /符合条件|合法空间|确认后结束|完成后结束|或撤销重新选择|将选定的/)
})

test("undo snapshots exclude prior undo history before cloning", () => {
	const game = {
		state: "example",
		action_log: [{ verb: "first" }],
		undo: [{ large: [1, 2, 3] }],
	}
	const saved = State.snapshot(game)
	assert.deepEqual(saved.undo, [])
	assert.deepEqual(saved.action_log, game.action_log)
	assert.notEqual(saved.action_log, game.action_log)
})

test("undo snapshots compact logs and preserve collaborative rollback history", () => {
	const rollback = [{ name: "checkpoint" }]
	const game = {
		active: "Axis",
		state: "example",
		log: ["before"],
		action_log: [{ verb: "first" }],
		rollback,
		rollback_state: "encoded",
		undo: [],
	}
	State.pushUndo(game)
	assert.equal(game.undo[0].log, 1)
	assert.equal(game.undo[0].rollback, undefined)
	game.log.push("after")
	game.action_log.push({ verb: "second" })
	game.rollback.push({ name: "new checkpoint" })
	const currentLog = game.log
	const restored = State.restoreUndo(game)
	assert.equal(restored.log, currentLog)
	assert.deepEqual(restored.log, ["before"])
	assert.deepEqual(restored.action_log, [{ verb: "first" }])
	assert.equal(restored.rollback, rollback)
	assert.equal(restored.rollback.length, 2)
	assert.equal(restored.rollback_state, "encoded")
})

test("undo ownership follows the active player", () => {
	const game = { active: "Axis", state: "example", log: [], undo: [] }
	State.pushUndo(game)
	assert.equal(State.canUndo(game), true)
	game.active = "Allied"
	assert.equal(State.canUndo(game), false)
	assert.throws(() => State.restoreUndo(game), /nothing to undo/)
})

test("grouped selection actions share one undo checkpoint", () => {
	let game = { active: "Axis", state: "ops_combat", value: 1, log: [], undo: [] }
	assert.equal(State.pushUndo(game, "Axis:ops_combat:selection"), true)
	game.value = 2
	assert.equal(State.pushUndo(game, "Axis:ops_combat:selection"), false)
	assert.equal(game.undo.length, 1)
	game = State.restoreUndo(game)
	assert.equal(game.value, 1)
	assert.equal(game._undo_group, undefined)
})

test("return restores the named selection checkpoint", () => {
	let game = { active: "Axis", state: "ops_move", value: 1, log: ["before"], action_log: [], undo: [] }
	State.pushUndo(game)
	game.state = "ops_move_piece"
	game.value = 2
	game.log.push("selected")
	game.action_log.push({ player: "Axis", verb: "piece", noun: 1 })
	State.pushUndo(game)
	game.state = "nested_choice"
	game.value = 3
	game = State.restoreUndoToState(game, "ops_move")
	assert.equal(game.state, "ops_move")
	assert.equal(game.value, 1)
	assert.deepEqual(game.log, ["before"])
	assert.deepEqual(game.action_log, [])
})

test("event registry rejects duplicate and incomplete handlers", () => {
	assert.throws(
		() =>
			Events.register(56, {
				name: "Duplicate",
				canPlay: () => true,
				play() {},
			}),
		/duplicate event card id: 56/,
	)
	assert.throws(() => Events.register(8, { name: "Incomplete", canPlay: () => true }), /handler requires play/)
	assert.equal(Events.handlers.has(8), false)
})
