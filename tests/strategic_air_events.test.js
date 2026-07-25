"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data, adjacency } = Engine

function game(seed = 2100) {
	return Engine.setup.createInitialState(data, "Campaign", seed, {})
}

function handLimit(current, side) {
	return Engine.resources.handLimit(current, data, Engine.map, adjacency, side)
}

test("Bomber Command obeys its printed timing and Kammhuber Line cancels only an eligible pending effect", () => {
	const current = game()
	current.turn = 1
	current.action_round = 1
	assert.equal(Engine.events.canPlayEvent(current, data, 12), false)

	current.turn = 10
	current.action_round = 6
	assert.equal(Engine.events.canPlayEvent(current, data, 12), false)
	current.action_round = 5
	const base = handLimit(current, "axis")
	Engine.events.playEvent(current, data, 12)
	assert.equal(current.events.bomber_command_pending, true)
	assert.equal(handLimit(current, "axis"), base - 2)
	assert.equal(Engine.events.canPlayEvent(current, data, 75), true)
	Engine.events.playEvent(current, data, 75)
	assert.equal(current.events.bomber_command_pending, undefined)
	assert.equal(handLimit(current, "axis"), base)

	current.turn = 15
	current.action_round = 6
	assert.equal(Engine.events.canPlayEvent(current, data, 12), true)
	Engine.events.playEvent(current, data, 12)
	assert.equal(Engine.events.canPlayEvent(current, data, 75), false)
	current.turn = 16
	assert.equal(Engine.events.canPlayEvent(current, data, 75), false)
})

test("US 8th Air Force requires US Build-Up, while FW-190 cancels it for one VP until P-51 is played", () => {
	let current = game(2101)
	current.turn = 10
	current.action_round = 5
	assert.equal(Engine.events.canPlayEvent(current, data, 28), false)
	current.events.us_buildup = true
	assert.equal(Engine.events.canPlayEvent(current, data, 28), true)
	const base = handLimit(current, "axis")
	Engine.events.playEvent(current, data, 28)
	assert.equal(handLimit(current, "axis"), base - 2)
	const vp = current.vp
	Engine.events.playEvent(current, data, 84)
	assert.equal(current.vp, vp + 1)
	assert.equal(handLimit(current, "axis"), base)

	current = game(2102)
	current.turn = 10
	current.action_round = 6
	current.events.us_buildup = true
	assert.equal(Engine.events.canPlayEvent(current, data, 28), false)
	assert.equal(Engine.events.eventOpsValue(current, data, 53), 4)
	current.turn = 9
	current.action_round = 1
	assert.equal(Engine.events.eventOpsValue(current, data, 53), 0)
	current.action_round = 3
	assert.equal(Engine.events.eventOpsValue(current, data, 53), 4)
	Engine.events.playEvent(current, data, 53)
	assert.equal(Engine.events.canPlayEvent(current, data, 28), true)
	Engine.events.playEvent(current, data, 28)
	assert.equal(Engine.events.canPlayEvent(current, data, 84), false)

	const afterOverlord = game(2103)
	afterOverlord.events.overlord = true
	assert.equal(Engine.events.eventOpsValue(afterOverlord, data, 53), 0)
})

test("Wolfpacks affects the next Allied draw and ASW Victory prevents future Wolfpacks without erasing the current penalty", () => {
	const current = game(2104)
	const base = handLimit(current, "allied")
	Engine.events.playEvent(current, data, 70)
	assert.equal(handLimit(current, "allied"), base - 2)
	const vp = current.vp
	Engine.events.playEvent(current, data, 36)
	assert.equal(current.vp, vp - 1)
	assert.equal(handLimit(current, "allied"), base - 2)
	delete current.events.wolfpacks_pending
	assert.equal(Engine.events.canPlayEvent(current, data, 70), false)
})

test("temporary strategic-air hand penalties are consumed exactly once by the draw phase", () => {
	const current = game(2105)
	current.turn = 10
	current.action_round = 5
	current.events.us_buildup = true
	Engine.events.playEvent(current, data, 12)
	Engine.events.playEvent(current, data, 28)
	Engine.events.playEvent(current, data, 70)
	assert.equal(Engine.resources.temporaryHandLimitModifier(current, "axis"), -4)
	assert.equal(Engine.resources.temporaryHandLimitModifier(current, "allied"), -2)
	Engine.turn.completeDrawPhase(current)
	assert.equal(Engine.resources.temporaryHandLimitModifier(current, "axis"), 0)
	assert.equal(Engine.resources.temporaryHandLimitModifier(current, "allied"), 0)
})

test("IX Tac-Air is a Spring/Summer post-P-51 dual event and modifies only British and US attacks", () => {
	const current = game(2106)
	current.events.p51_mustang = true
	current.turn = 7
	assert.equal(Engine.events.canPlayEvent(current, data, 32), false)
	current.turn = 9
	assert.equal(Engine.events.canPlayEvent(current, data, 32), true)
	Engine.events.playEvent(current, data, 32)
	assert.equal(Engine.events.eventOpsValue(current, data, 32), 5)
	assert.deepEqual(current.event.attack_modifier, {
		attacker_side: "allied",
		nations: ["br", "us"],
		drm: 1,
		no_retreat: false,
	})
})

test("Operation Strangle is a pre-Overlord provisional Yellow Event that enforces French supply and Axis SR restrictions", () => {
	let current = rules.setup(2107, "Campaign", {})
	current.turn = 10
	current.action_round = 3
	current.phase = "action"
	current.state = "action_select"
	current.active = "Allied"
	current.action_history = { allied: [], axis: [] }
	current.hands.allied = [43]
	assert.equal(Engine.events.canPlayEvent(current, data, 43), false)
	current.events.p51_mustang = true
	assert.equal(Engine.events.eventOpsValue(current, data, 43), 3)

	const frenchPiece = data.pieces.find((entry) => entry?.side === "axis" && data.spaces[current.pieces[entry.id]]?.nation === "fr")
	assert.ok(frenchPiece)
	assert.equal(Engine.map.traceSupply(current, data, adjacency, "axis", current.pieces[frenchPiece.id], frenchPiece.nation), "full")
	assert.ok(Engine.map.legalSrPaths(current, data, adjacency, frenchPiece.id).size > 0)
	const outsidePiece = data.pieces.find((entry) => {
		if (entry?.side !== "axis" || !Number.isInteger(current.pieces[entry.id]) || data.spaces[current.pieces[entry.id]]?.nation === "fr") return false
		return [...Engine.map.legalSrPaths(current, data, adjacency, entry.id).values()].some((path) => path.some((spaceId) => data.spaces[spaceId]?.nation === "fr"))
	})
	assert.ok(outsidePiece)

	current = rules.action(current, "Allied", "play_event", 43)
	assert.equal(current.events.operation_strangle, true)
	assert.equal(current.state, "ops_activate")
	assert.equal(current.event.dual_ops, 3)
	assert.equal(current.removed.allied.includes(43), true)
	assert.equal(Engine.map.traceSupply(current, data, adjacency, "axis", current.pieces[frenchPiece.id], frenchPiece.nation), "limited")
	assert.equal(Engine.map.legalSrPaths(current, data, adjacency, frenchPiece.id).size, 0)
	for (const [destination, path] of Engine.map.legalSrPaths(current, data, adjacency, outsidePiece.id)) {
		assert.notEqual(data.spaces[destination]?.nation, "fr")
		assert.equal(
			path.some((spaceId) => data.spaces[spaceId]?.nation === "fr"),
			false,
		)
	}
	const frenchSpace = current.pieces[frenchPiece.id]
	current.control = data.spaces.map((entry) => (entry ? "allied" : null))
	current.control[frenchSpace] = "axis"
	assert.equal(Engine.map.traceSupply(current, data, adjacency, "axis", frenchSpace, frenchPiece.nation), "limited")

	current.turn = 9
	current.action_round = 1
	assert.equal(Engine.events.eventOpsValue(current, data, 43), 0)
	current.action_round = 3
	current.events.overlord = true
	assert.equal(Engine.events.eventOpsValue(current, data, 43), 0)
})
