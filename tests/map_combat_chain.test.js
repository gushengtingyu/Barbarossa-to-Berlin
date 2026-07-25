"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog } = require("./i18n_helpers.js")
const rules = require("../rules.js")
const Engine = require("../modules/engine.js")
const CombatStates = require("../modules/states/states_combat.js")
const { data } = require("../data.js")

function baseGame(pieceCount, spaceCount) {
	return {
		seed: 1,
		turn: 3,
		action_round: 1,
		pieces: Array(pieceCount).fill(0),
		reduced: [],
		control: Array(spaceCount).fill(null),
		trench: {},
		trench_owner: {},
		destroyed_forts: [],
		stand_fast: {},
		partisans: [],
		events: {},
		options: {},
		log: [],
	}
}

function multiSpaceFixture(originCount, spaceFilter = () => true, originFilter = () => true) {
	const adjacency = Engine.map.buildAdjacency(data)
	const restricted = new Set(["Leningrad", "Moscow", "Maikop", "Stalingrad", "Armavir", "Chelyabiinsk", "Sverdlovsk"])
	const target = data.spaces.find((space) => {
		if (!space || space.kind !== "land" || restricted.has(space.name) || !spaceFilter(space)) return false
		return (adjacency[space.id] || []).filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && !restricted.has(data.spaces[edge.to].name) && originFilter(data.spaces[edge.to])).length >= originCount
	})
	const origins = adjacency[target.id]
		.filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && !restricted.has(data.spaces[edge.to].name) && originFilter(data.spaces[edge.to]))
		.slice(0, originCount)
		.map((edge) => edge.to)
	return { target: target.id, origins }
}

function combatSelectionGame(seed, target, placements, { turn = 8, activationSupply = {} } = {}) {
	const defender = data.pieces.find((piece) => piece?.side === "allied").id
	const origins = [...new Set(placements.map(([, origin]) => origin))]
	const game = rules.setup(seed, "Campaign", {})
	game.pieces.fill(0)
	for (const [pieceId, origin] of placements) game.pieces[pieceId] = origin
	game.pieces[defender] = target
	game.control = data.spaces.map((space) => (space ? "axis" : null))
	game.control[target] = "allied"
	game.active = "Axis"
	game.state = "ops_combat"
	game.phase = "action"
	game.turn = turn
	game.action_round = 1
	game.events = {}
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [],
		attack_spaces: origins,
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
		activation_supply: Object.assign(Object.fromEntries(placements.map(([pieceId]) => [pieceId, "full"])), activationSupply),
	}
	return game
}

test("control entry removes enemy trenches, destroys enemy forts, and intact friendly forts give Limited Supply", () => {
	const localData = {
		spaces: [
			null,
			{
				id: 1,
				name: "Fort",
				kind: "land",
				nation: "fr",
				side: "allied",
				fort: true,
			},
			{
				id: 2,
				name: "Benghazi",
				kind: "land",
				nation: "ly",
				side: "axis",
			},
			{
				id: 3,
				name: "Tobruk",
				kind: "land",
				nation: "ly",
				side: "allied",
			},
		],
		pieces: [
			null,
			{
				id: 1,
				name: "GE corps",
				side: "axis",
				nation: "ge",
				size: "scu",
				mf: 3,
				rmf: 3,
			},
		],
	}
	const game = baseGame(2, 4)
	game.control[1] = "allied"
	game.control[2] = "axis"
	game.control[3] = "allied"
	game.trench = { 1: 1, 3: 1 }
	game.trench_owner = { 1: "allied", 3: "allied" }
	assert.equal(Engine.map.traceSupply(game, localData, [[], [], [], []], "allied", 1, "br"), "limited")
	Engine.map.enterSpace(game, localData, 1, 1)
	assert.equal(game.control[1], "axis")
	assert.equal(game.trench[1], undefined)
	assert.deepEqual(game.destroyed_forts, [1])
	assert.equal(Engine.map.traceSupply(game, localData, [[], [], [], []], "axis", 1, "ge"), "oos")
	Engine.map.setControl(game, localData, 2, "allied")
	assert.equal(game.trench[3], undefined)
})

test("units may pass through a Combat marker but only supplied mechanized units may stop there", () => {
	const localData = {
		spaces: [
			null,
			{
				id: 1,
				name: "Berlin",
				kind: "land",
				nation: "ge",
				side: "axis",
				supply: "axis",
			},
			{
				id: 2,
				name: "Crossroads",
				kind: "land",
				nation: "ge",
				side: "axis",
			},
			{ id: 3, name: "Rear", kind: "land", nation: "ge", side: "axis" },
		],
		pieces: [
			null,
			{
				id: 1,
				name: "GE infantry",
				side: "axis",
				nation: "ge",
				size: "scu",
				mf: 3,
				rmf: 3,
			},
			{
				id: 2,
				name: "GE panzer",
				side: "axis",
				nation: "ge",
				size: "scu",
				mf: 4,
				rmf: 4,
			},
		],
	}
	const adjacency = [
		[],
		[{ to: 2, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
	]
	const game = baseGame(3, 4)
	game.pieces[1] = 1
	game.pieces[2] = 1
	game.control = [null, "axis", "axis", "axis"]
	game.action = { attack_spaces: [2] }
	const infantry = Engine.map.legalMovePaths(game, localData, adjacency, 1)
	assert.equal(infantry.has(2), false)
	assert.deepEqual(infantry.get(3), [2, 3])
	const panzer = Engine.map.legalMovePaths(game, localData, adjacency, 2)
	assert.deepEqual(panzer.get(2), [2])
})

test("Rule 13.1 locks attacker supply when its space is activated", () => {
	const localData = {
		spaces: [
			null,
			{
				id: 1,
				name: "Ruhr",
				kind: "land",
				nation: "ge",
				side: "axis",
				supply: "axis",
			},
			{ id: 2, name: "Front", kind: "land", nation: "ge", side: "axis" },
			{
				id: 3,
				name: "Basra",
				kind: "land",
				nation: "su",
				side: "allied",
				supply: "allied",
			},
		],
		pieces: [
			null,
			{
				id: 1,
				name: "GE panzer",
				side: "axis",
				nation: "ge",
				size: "scu",
				unit_type: "mechanized",
				mf: 4,
				rmf: 4,
				cf: 2,
				rcf: 1,
				lf: 1,
				rlf: 1,
			},
			{
				id: 2,
				name: "SU army",
				side: "allied",
				nation: "su",
				size: "scu",
				unit_type: "army",
				mf: 3,
				rmf: 3,
				cf: 1,
				rcf: 1,
				lf: 1,
				rlf: 1,
			},
		],
	}
	const adjacency = [
		[],
		[{ to: 2, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
	]
	const game = baseGame(3, 4)
	game.pieces[1] = 2
	game.pieces[2] = 3
	game.control = [null, "allied", "axis", "allied"]
	game.action = { attack_spaces: [2], activation_supply: {} }

	Engine.map.recordActivationSupply(game, localData, adjacency, "axis", 2)
	assert.equal(game.action.activation_supply[1], "oos")
	game.control[1] = "axis"
	assert.equal(Engine.map.traceSupply(game, localData, adjacency, "axis", 2, "ge"), "full")
	assert.equal(Engine.map.movementAllowance(game, localData, adjacency, 1), 2)
	assert.equal(Engine.map.isMechanizedInSupply(game, localData, adjacency, 1), false)

	const combat = {
		origin_spaces: [2],
		defender_space: 3,
		attackers: [1],
		defenders: [2],
	}
	Engine.combat.resolve(game, localData, Engine.map, adjacency, combat)
	assert.equal(combat.attacker_shift, -1)
	assert.equal(combat.defender_shift, 0)
})

test("Soviet entrenchment enforces supply, turn, terrain, level, counter limit, and Stalin DRM", () => {
	const localData = {
		spaces: [
			null,
			{
				id: 1,
				name: "Moscow",
				kind: "land",
				nation: "su",
				side: "allied",
				urban: true,
			},
			{
				id: 2,
				name: "Basra",
				kind: "land",
				nation: "su",
				side: "allied",
				urban: true,
				supply: "allied",
			},
			...Array.from({ length: 5 }, (_, index) => ({
				id: index + 3,
				name: `City ${index}`,
				kind: "land",
				nation: "su",
				side: "allied",
				urban: true,
			})),
			{
				id: 8,
				name: "Warsaw",
				kind: "land",
				nation: "ge",
				side: "axis",
				urban: false,
			},
		],
		pieces: [
			null,
			{
				id: 1,
				name: "SU Front",
				side: "allied",
				nation: "su",
				size: "lcu",
				mf: 3,
				rmf: 3,
			},
		],
	}
	const adjacency = Array.from({ length: 9 }, () => [])
	adjacency[1].push({ to: 2, type: "regular" })
	adjacency[2].push({ to: 1, type: "regular" })
	const game = baseGame(2, 8)
	game.pieces[1] = 1
	game.control.fill("allied", 1)
	game.action = { move_spaces: [1], moved: [], entrenching: [] }
	game.turn = 2
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), false)
	game.turn = 3
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), true)
	game.action.activation_supply = { 1: "oos" }
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), false)
	game.action.activation_supply = { 1: "full" }
	game.trench[1] = 1
	game.trench_owner[1] = "allied"
	game.turn = 7
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), false)
	game.turn = 8
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), true)
	game.pieces[1] = 8
	game.action = { move_spaces: [8], moved: [], entrenching: [], activation_supply: { 1: "full" } }
	game.turn = 7
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), false)
	game.turn = 8
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), true)
	game.pieces[1] = 1
	game.action = { move_spaces: [1], moved: [], entrenching: [], activation_supply: { 1: "full" } }
	game.trench = { 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 }
	game.trench_owner = {
		3: "allied",
		4: "allied",
		5: "allied",
		6: "allied",
		7: "allied",
	}
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), false)
	game.trench = { 3: 1, 4: 1, 5: 1, 6: 1, 8: 1 }
	game.trench_owner = {
		3: "allied",
		4: "allied",
		5: "allied",
		6: "allied",
		8: "allied",
	}
	assert.equal(Engine.map.canEntrench(game, localData, adjacency, 1), false)
	game.trench = {}
	game.trench_owner = {}
	game.seed = 3
	game.stalin_location = 1
	const moscow = Engine.map.resolveEntrenchAttempt(game, localData, {
		piece_id: 1,
		space_id: 1,
	})
	assert.deepEqual({ raw: moscow.raw, modified: moscow.modified, success: moscow.success }, { raw: 4, modified: 3, success: true })
	const other = {
		...game,
		seed: 3,
		trench: {},
		trench_owner: {},
		stalin_location: 1,
	}
	const basra = Engine.map.resolveEntrenchAttempt(other, localData, {
		piece_id: 1,
		space_id: 2,
	})
	assert.deepEqual({ raw: basra.raw, modified: basra.modified, success: basra.success }, { raw: 4, modified: 4, success: false })
})

test("multi-space combat requires a participating mechanized unit in every additional origin", () => {
	const adjacency = Engine.map.buildAdjacency(data)
	const restricted = new Set(["Leningrad", "Moscow", "Maikop", "Stalingrad", "Armavir", "Chelyabiinsk", "Sverdlovsk"])
	const target = data.spaces.find((space) => space?.kind === "land" && !restricted.has(space.name) && (adjacency[space.id] || []).filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").length >= 2)
	const neighbors = adjacency[target.id]
		.filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land")
		.slice(0, 2)
		.map((edge) => edge.to)
	const primaryPiece = data.pieces.find((piece) => piece?.side === "axis" && piece.unit_type !== "mechanized").id
	const mechanized = data.pieces.find((piece) => piece?.side === "axis" && piece.unit_type === "mechanized" && Number(piece.mf) >= 4).id
	const defender = data.pieces.find((piece) => piece?.side === "allied").id
	let game = rules.setup(11, "Campaign", {})
	game.pieces.fill(0)
	game.pieces[primaryPiece] = neighbors[0]
	game.pieces[mechanized] = neighbors[1]
	game.pieces[defender] = target.id
	game.control = data.spaces.map((space) => (space ? "axis" : null))
	game.control[target.id] = "allied"
	game.active = "Axis"
	game.state = "ops_combat"
	game.phase = "action"
	game.turn = 8
	game.action_round = 1
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [],
		attack_spaces: neighbors,
		moved: [],
		sr_moved: [],
		attacked: [neighbors[0]],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	const undoBeforeSelection = game.undo.length
	assert.ok(rules.view(game, "Axis").actions.piece.includes(primaryPiece))
	game = rules.action(game, "Axis", "piece", primaryPiece)
	assert.equal(game.undo.length, undoBeforeSelection + 1)
	assert.ok(rules.view(game, "Axis").actions.space.includes(target.id))
	assert.ok(rules.view(game, "Axis").actions.piece.includes(mechanized))
	game = rules.action(game, "Axis", "piece", mechanized)
	assert.equal(game.undo.length, undoBeforeSelection + 1)
	assert.deepEqual(game.combat.origin_spaces, neighbors)
	const before = JSON.stringify(game)
	assert.throws(() => rules.action(game, "Axis", "confirm"), /illegal action/)
	assert.equal(JSON.stringify(game), before)
	game = rules.action(game, "Axis", "undo")
	assert.equal(game.combat, undefined)
	game = rules.action(game, "Axis", "piece", primaryPiece)
	game = rules.action(game, "Axis", "piece", mechanized)
	game = rules.action(game, "Axis", "space", target.id)
	assert.equal(game.state, "combat_confirm")
	const confirmationPrompt = rules.view(game, "Axis").prompt
	assert.match(confirmationPrompt, /^确认进攻.+：\d+ CF VS \d+ CF。$/)
	assert.doesNotMatch(confirmationPrompt, /LCU|SCU|列|基础火力|集团军表|军团表/)
	game = rules.action(game, "Axis", "cancel")
	assert.equal(game.state, "ops_combat")
	assert.deepEqual(game.combat.attackers, [primaryPiece, mechanized])
	game = rules.action(game, "Axis", "space", target.id)
	game = rules.action(game, "Axis", "confirm")
	assert.equal(game.state, "combat_attacker_cc")
	game = rules.action(game, "Axis", "continue")
	game = rules.action(game, "Allied", "continue")
	assert.ok(renderLog(game).includes("**进攻方开火：**"))
	assert.ok(renderLog(game).includes("**防守方开火：**"))
	assert.doesNotMatch(renderLog(game).join("\n"), /(?:进攻方|防守方)开火（/)
})

test("multi-space combat automatically chooses the primary origin regardless of click order", () => {
	const { target, origins } = multiSpaceFixture(2)
	const infantry = data.pieces.find((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type !== "mechanized").id
	const mechanized = data.pieces.find((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type === "mechanized" && Number(piece.mf) >= 4).id

	function selectInOrder(seed, order) {
		let game = combatSelectionGame(seed, target, [
			[infantry, origins[0]],
			[mechanized, origins[1]],
		])
		for (const pieceId of order) {
			assert.ok(rules.view(game, "Axis").actions.piece.includes(pieceId))
			game = rules.action(game, "Axis", "piece", pieceId)
		}
		assert.ok(rules.view(game, "Axis").actions.space.includes(target))
		game = rules.action(game, "Axis", "space", target)
		return game
	}

	const infantryFirst = selectInOrder(21, [infantry, mechanized])
	const mechanizedFirst = selectInOrder(22, [mechanized, infantry])
	assert.deepEqual(infantryFirst.combat.origin_spaces, [origins[0], origins[1]])
	assert.deepEqual(mechanizedFirst.combat.origin_spaces, infantryFirst.combat.origin_spaces)
})

test("all-mechanized multi-space combat uses a stable primary-origin tie break", () => {
	const { target, origins } = multiSpaceFixture(2)
	const mechanized = data.pieces.filter((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type === "mechanized" && Number(piece.mf) >= 4).slice(0, 2)
	const placements = [
		[mechanized[0].id, origins[0]],
		[mechanized[1].id, origins[1]],
	]
	const expectedOrigins = origins.slice().sort((a, b) => a - b)

	for (const [seed, order] of [
		[28, mechanized],
		[29, mechanized.slice().reverse()],
	]) {
		let game = combatSelectionGame(seed, target, placements)
		for (const piece of order) game = rules.action(game, "Axis", "piece", piece.id)
		game = rules.action(game, "Axis", "space", target)
		assert.deepEqual(game.combat.origin_spaces, expectedOrigins)
	}
})

test("multi-space combat permits completable intermediate selections and select-all supplies the required mechanized unit", () => {
	const { target, origins } = multiSpaceFixture(2)
	const infantry = data.pieces.filter((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type !== "mechanized").slice(0, 2)
	const mechanized = data.pieces.find((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type === "mechanized" && Number(piece.mf) >= 4)
	let game = combatSelectionGame(23, target, [
		[infantry[0].id, origins[0]],
		[infantry[1].id, origins[1]],
		[mechanized.id, origins[1]],
	])

	game = rules.action(game, "Axis", "piece", infantry[0].id)
	assert.ok(rules.view(game, "Axis").actions.piece.includes(infantry[1].id))
	game = rules.action(game, "Axis", "piece", infantry[1].id)
	let actions = rules.view(game, "Axis").actions
	assert.equal(actions.space, undefined)
	assert.ok(actions.piece.includes(mechanized.id))
	assert.equal(actions.select_all, 1)

	game = rules.action(game, "Axis", "select_all")
	actions = rules.view(game, "Axis").actions
	assert.ok(actions.space.includes(target))
	assert.deepEqual(game.combat.origin_spaces, [origins[0], origins[1]])

	game = rules.action(game, "Axis", "piece", infantry[0].id)
	assert.deepEqual(game.combat.origin_spaces, [origins[1]])
	assert.ok(rules.view(game, "Axis").actions.space.includes(target))
})

test("three-origin combat still requires participating mechanized units in two origins", () => {
	const { target, origins } = multiSpaceFixture(3)
	const infantry = data.pieces.filter((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type !== "mechanized").slice(0, 2)
	const mechanized = data.pieces.filter((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type === "mechanized" && Number(piece.mf) >= 4).slice(0, 2)
	let game = combatSelectionGame(24, target, [
		[infantry[0].id, origins[0]],
		[mechanized[0].id, origins[1]],
		[infantry[1].id, origins[2]],
		[mechanized[1].id, origins[2]],
	])

	for (const pieceId of [infantry[1].id, mechanized[0].id, infantry[0].id]) {
		assert.ok(rules.view(game, "Axis").actions.piece.includes(pieceId))
		game = rules.action(game, "Axis", "piece", pieceId)
	}
	assert.equal(rules.view(game, "Axis").actions.space, undefined)
	assert.ok(rules.view(game, "Axis").actions.piece.includes(mechanized[1].id))
	game = rules.action(game, "Axis", "piece", mechanized[1].id)
	assert.ok(rules.view(game, "Axis").actions.space.includes(target))
	assert.deepEqual(game.combat.origin_spaces, [origins[0], ...origins.slice(1).sort((a, b) => a - b)])
})

test("an origin cannot be added when no qualifying mechanized unit can complete the attack", () => {
	const { target, origins } = multiSpaceFixture(2)
	const infantry = data.pieces.filter((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type !== "mechanized").slice(0, 2)
	let game = combatSelectionGame(25, target, [
		[infantry[0].id, origins[0]],
		[infantry[1].id, origins[1]],
	])

	game = rules.action(game, "Axis", "piece", infantry[0].id)
	assert.equal(rules.view(game, "Axis").actions.piece.includes(infantry[1].id), false)
})

test("OOS and Winter 1942 German mechanized units cannot complete a multi-space attack", () => {
	const infantry = data.pieces.filter((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type !== "mechanized").slice(0, 2)
	const mechanized = data.pieces.find((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type === "mechanized" && Number(piece.mf) >= 4)
	const western = multiSpaceFixture(2)
	let game = combatSelectionGame(
		26,
		western.target,
		[
			[infantry[0].id, western.origins[0]],
			[infantry[1].id, western.origins[1]],
			[mechanized.id, western.origins[1]],
		],
		{ activationSupply: { [mechanized.id]: "oos" } },
	)
	game = rules.action(game, "Axis", "piece", infantry[0].id)
	assert.equal(rules.view(game, "Axis").actions.piece.includes(infantry[1].id), false)
	assert.equal(rules.view(game, "Axis").actions.piece.includes(mechanized.id), false)

	const soviet = multiSpaceFixture(
		2,
		(space) => space.nation === "su",
		(space) => space.nation === "su",
	)
	game = combatSelectionGame(
		27,
		soviet.target,
		[
			[infantry[0].id, soviet.origins[0]],
			[infantry[1].id, soviet.origins[1]],
			[mechanized.id, soviet.origins[1]],
		],
		{ turn: 4 },
	)
	game = rules.action(game, "Axis", "piece", infantry[0].id)
	assert.equal(rules.view(game, "Axis").actions.piece.includes(infantry[1].id), false)
	assert.equal(rules.view(game, "Axis").actions.piece.includes(mechanized.id), false)
})

test("combat confirmation revalidates a restored multi-space selection", () => {
	const { target, origins } = multiSpaceFixture(2)
	const infantry = data.pieces.filter((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type !== "mechanized").slice(0, 2)
	const mechanized = data.pieces.find((piece) => piece?.side === "axis" && piece.nation === "ge" && piece.unit_type === "mechanized" && Number(piece.mf) >= 4)
	let game = combatSelectionGame(30, target, [
		[infantry[0].id, origins[0]],
		[infantry[1].id, origins[1]],
		[mechanized.id, origins[1]],
	])
	game = rules.action(game, "Axis", "piece", infantry[0].id)
	game = rules.action(game, "Axis", "piece", mechanized.id)
	game = rules.action(game, "Axis", "space", target)
	assert.equal(game.state, "combat_confirm")

	game.combat.attackers = [infantry[0].id, infantry[1].id]
	assert.throws(() => rules.action(game, "Axis", "confirm"), /illegal multi-space combat/)
})

test("single-origin combat selects units and target without intermediate steps", () => {
	const adjacency = Engine.map.buildAdjacency(data)
	const target = data.spaces.find((space) => space?.kind === "land" && (adjacency[space.id] || []).some((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land"))
	const origin = adjacency[target.id].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").to
	const attacker = data.pieces.find((piece) => piece?.side === "axis").id
	const defender = data.pieces.find((piece) => piece?.side === "allied").id
	let game = rules.setup(12, "Campaign", {})
	game.pieces.fill(0)
	game.pieces[attacker] = origin
	game.pieces[defender] = target.id
	game.control = data.spaces.map((space) => (space ? "axis" : null))
	game.control[target.id] = "allied"
	game.active = "Axis"
	game.state = "ops_combat"
	game.phase = "action"
	game.turn = 8
	game.action_round = 1
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [],
		attack_spaces: [origin],
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	game = rules.action(game, "Axis", "piece", attacker)
	assert.equal(game.state, "ops_combat")
	assert.ok(rules.view(game, "Axis").actions.space.includes(target.id))
	game = rules.action(game, "Axis", "space", target.id)
	assert.equal(game.state, "combat_confirm")
	game = rules.action(game, "Axis", "cancel")
	assert.equal(game.state, "ops_combat")
	assert.deepEqual(game.combat.attackers, [attacker])
})

test("retreat path priorities cover friendly supply, Partisans, first-turn Soviets, and failed retreat elimination", () => {
	const localData = {
		spaces: [
			null,
			{
				id: 1,
				name: "Origin",
				kind: "land",
				nation: "eg",
				side: "allied",
			},
			{
				id: 2,
				name: "Suez",
				kind: "land",
				nation: "eg",
				side: "allied",
				supply: "allied",
			},
			{ id: 3, name: "Open", kind: "land", nation: "eg", side: "axis" },
			{ id: 4, name: "Rear", kind: "land", nation: "su", side: "allied" },
		],
		pieces: [
			null,
			{
				id: 1,
				name: "BR corps",
				side: "allied",
				nation: "br",
				size: "scu",
			},
			{
				id: 2,
				name: "GE corps",
				side: "axis",
				nation: "ge",
				size: "scu",
			},
			{
				id: 3,
				name: "SU Army",
				side: "allied",
				nation: "su",
				size: "scu",
			},
		],
	}
	const adjacency = [
		[],
		[
			{ to: 2, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
			{ to: 4, type: "regular" },
		],
		[
			{ to: 1, type: "regular" },
			{ to: 2, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
	]
	const game = baseGame(4, 5)
	game.pieces[1] = 1
	game.control = [null, "allied", "allied", "axis", "allied"]
	game.combat = {
		defender_space: 1,
		defender_side: "allied",
		retreat_distance: 1,
	}
	assert.deepEqual(CombatStates.preferredRetreatPaths(game, localData, adjacency, 1), [[2]])
	game.pieces[1] = 0
	game.pieces[2] = 1
	game.control = [null, "axis", "axis", "axis", "axis"]
	game.partisans = [2]
	game.combat = {
		defender_space: 1,
		defender_side: "axis",
		retreat_distance: 1,
	}
	assert.deepEqual(CombatStates.preferredRetreatPaths(game, localData, adjacency, 2), [[3]])
	game.pieces[2] = 0
	game.pieces[3] = 1
	game.turn = 1
	game.partisans = []
	game.control = [null, "allied", "allied", "allied", "allied"]
	game.combat = {
		defender_space: 1,
		defender_side: "allied",
		retreat_distance: 2,
	}
	assert.ok(CombatStates.preferredRetreatPaths(game, localData, adjacency, 3).every((path) => path[path.length - 1] === 4))
	game.turn = 3
	game.combat = {
		defender_space: 1,
		defender_side: "allied",
		attacker_side: "axis",
		retreat_distance: 1,
		retreat_pending: [3],
		defenders: [3],
	}
	game.state = "combat_retreat"
	CombatStates.prepareRetreat(game, localData, [[], [], [], [], []])
	assert.equal(game.pieces[3], "eliminated:allied")
	assert.equal(game.state, "combat_retreat")
	assert.deepEqual(game.combat.retreat_pending, [])
})

test("Rule 11.44 prefers friendly control at each retreat step instead of counting the whole path", () => {
	const localData = {
		spaces: [
			null,
			{ id: 1, name: "Origin", kind: "land", nation: "eg" },
			{ id: 2, name: "Friendly first", kind: "land", nation: "eg" },
			{ id: 3, name: "Enemy first", kind: "land", nation: "eg" },
			{ id: 4, name: "Enemy second", kind: "land", nation: "eg" },
			{ id: 5, name: "Friendly second", kind: "land", nation: "eg" },
		],
		pieces: [
			null,
			{
				id: 1,
				name: "BR corps",
				side: "allied",
				nation: "br",
				size: "scu",
			},
		],
	}
	const adjacency = [
		[],
		[
			{ to: 2, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[
			{ to: 1, type: "regular" },
			{ to: 4, type: "regular" },
		],
		[
			{ to: 1, type: "regular" },
			{ to: 5, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
		[{ to: 3, type: "regular" }],
	]
	const game = baseGame(2, 6)
	game.pieces[1] = 1
	game.control = [null, "allied", "allied", "axis", "axis", "allied"]
	game.combat = {
		defender_space: 1,
		defender_side: "allied",
		retreat_distance: 2,
	}

	assert.deepEqual(CombatStates.preferredRetreatPaths(game, localData, adjacency, 1), [[2, 4]])
})

test("OOS defenders retain ordinary terrain while only Soviets retain trench benefits", () => {
	const localData = {
		spaces: [
			null,
			{ id: 1, name: "Attack", kind: "land", nation: "ge" },
			{
				id: 2,
				name: "Mountain",
				kind: "land",
				nation: "su",
				terrain: "mountain",
			},
		],
		pieces: [
			null,
			{
				id: 1,
				name: "GE Army",
				side: "axis",
				nation: "ge",
				size: "lcu",
				cf: 5,
				lf: 3,
				rcf: 3,
				rlf: 3,
			},
			{
				id: 2,
				name: "BR Army",
				side: "allied",
				nation: "br",
				size: "lcu",
				cf: 5,
				lf: 3,
				rcf: 3,
				rlf: 3,
			},
			{
				id: 3,
				name: "SU Front",
				side: "allied",
				nation: "su",
				size: "lcu",
				cf: 5,
				lf: 3,
				rcf: 3,
				rlf: 3,
			},
		],
	}
	const map = {
		traceSupply: (game, data, adjacency, side) => (side === "allied" ? "oos" : "full"),
		isFortIntactForSide: () => false,
	}
	const western = {
		...baseGame(4, 3),
		seed: 5,
		pieces: [0, 1, 2, 0],
		trench: { 2: 1 },
		trench_owner: { 2: "allied" },
	}
	const westernCombat = {
		origin_spaces: [1],
		defender_space: 2,
		attackers: [1],
		defenders: [2],
	}
	Engine.combat.resolve(western, localData, map, [[], [], []], westernCombat)
	assert.equal(westernCombat.attacker_shift, -1)
	assert.equal(westernCombat.defender_shift, -1)
	assert.equal(Engine.combat.canCancelRetreat(western, localData, map, [[], [], []], westernCombat), true)
	const soviet = {
		...baseGame(4, 3),
		seed: 5,
		pieces: [0, 1, 0, 2],
		trench: { 2: 1 },
		trench_owner: { 2: "allied" },
	}
	const sovietCombat = {
		origin_spaces: [1],
		defender_space: 2,
		attackers: [1],
		defenders: [3],
	}
	Engine.combat.resolve(soviet, localData, map, [[], [], []], sovietCombat)
	assert.equal(sovietCombat.attacker_shift, -2)
	assert.equal(sovietCombat.defender_shift, 0)
	assert.equal(Engine.combat.canCancelRetreat(soviet, localData, map, [[], [], []], sovietCombat), true)
})

test("the Soviet Southwest Front must take the first attacking loss", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 7, {})
	const southwest = data.pieces.find((piece) => piece?.name === "SU Southwest Front").id
	const other = data.pieces.find((piece) => piece?.nation === "su" && piece.id !== southwest && Number(piece.lf) <= 3).id
	game.pieces[southwest] = 1
	game.pieces[other] = 1
	const combat = {
		attackers: [southwest, other],
		defenders: [],
		southwest_loss_taken: false,
	}
	assert.deepEqual(Engine.combat.legalLossChoices(game, data, combat, "attackers", 3), [southwest])
})

test("the Soviet Southwest Front uses its mechanized face and becomes the infantry Front when eliminated", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 7, {})
	const southwest = data.pieces.find((piece) => piece?.name === "SU Southwest Front").id
	const infantry = data.pieces.find((piece) => piece?.name === "SU Southwest Front (Infantry)").id
	assert.deepEqual([data.pieces[southwest].cf, data.pieces[southwest].lf, data.pieces[southwest].mf], [5, 3, 4])
	assert.equal(data.pieces[southwest].image_full, "SU_SW Mech.jpg")
	game.pieces[southwest] = 1
	Engine.combat.setReduced(game, southwest, true)
	const outcome = Engine.combat.applyStepLoss(game, data, { attackers: [southwest], defenders: [] }, southwest)
	assert.equal(game.pieces[southwest], "removed")
	assert.equal(game.pieces[infantry], "eliminated:allied")
	assert.equal(outcome.replacement, infantry)
})

test("Rally exposes deterministic entrenchment actions and read-only public engineering fields", () => {
	const moscow = data.spaces.find((space) => space?.name === "Moscow").id
	const front = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "lcu").id
	let game = rules.setup(3, "Campaign", {})
	game.pieces.fill(0)
	game.pieces[front] = moscow
	game.active = "Allied"
	game.state = "ops_move"
	game.phase = "action"
	game.turn = 3
	game.action_round = 1
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [moscow],
		attack_spaces: [],
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	const publicView = rules.view(game, "Allied")
	assert.ok(publicView.actions.entrench.includes(front))
	publicView.trench_owner[moscow] = "axis"
	publicView.destroyed_forts.push(moscow)
	assert.notEqual(game.trench_owner[moscow], "axis")
	assert.equal(game.destroyed_forts.includes(moscow), false)
	game = rules.action(game, "Allied", "entrench", front)
	assert.equal(game.action.moved.includes(front), true)
	assert.equal(game.state, "ops_entrench_roll")
	game.action.after_entrench = "combat"
	game = rules.action(game, "Allied", "roll")
	assert.equal(game.state, "ops_combat")
	assert.ok(rules.view(game, "Allied").log.some((entry) => new RegExp(`s${moscow}掘壕检定：W[1-6]`).test(entry)))
})

test("multiple Soviet entrench attempts resolve one player-selected space at a time", () => {
	const moscow = data.spaces.find((space) => space?.name === "Moscow").id
	const leningrad = data.spaces.find((space) => space?.name === "Leningrad").id
	const fronts = data.pieces.filter((piece) => piece?.nation === "su" && piece.size === "lcu").slice(0, 2)
	let game = rules.setup(21, "Campaign", {})
	game.pieces.fill(0)
	game.pieces[fronts[0].id] = moscow
	game.pieces[fronts[1].id] = leningrad
	game.control = data.spaces.map((space) => (space?.kind === "land" ? "allied" : null))
	game.active = "Allied"
	game.state = "ops_entrench_roll"
	game.phase = "action"
	game.turn = 3
	game.trench = {}
	game.trench_owner = {}
	game.trench_kind = {}
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [],
		attack_spaces: [],
		activation_supply: {
			[fronts[0].id]: "full",
			[fronts[1].id]: "full",
		},
		moved: [fronts[0].id, fronts[1].id],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [
			{ piece_id: fronts[0].id, space_id: moscow },
			{ piece_id: fronts[1].id, space_id: leningrad },
		],
		after_entrench: "combat",
		piece: null,
	}
	const firstSpace = Math.max(moscow, leningrad)
	const secondSpace = Math.min(moscow, leningrad)

	assert.deepEqual(rules.view(game, "Allied").actions.space, [secondSpace, firstSpace])
	game = rules.action(game, "Allied", "space", firstSpace)
	assert.equal(game.state, "ops_entrench_roll")
	assert.deepEqual(
		game.action.entrenching.map((attempt) => attempt.space_id),
		[secondSpace],
	)
	assert.equal(rules.view(game, "Allied").log.filter((entry) => /掘壕检定/.test(entry)).length, 1)
	assert.match(rules.view(game, "Allied").prompt, new RegExp(data.spaces[secondSpace].name))

	game = rules.action(game, "Allied", "roll")
	assert.equal(game.state, "ops_combat")
	assert.deepEqual(game.action.entrenching, [])
	assert.equal(rules.view(game, "Allied").log.filter((entry) => /掘壕检定/.test(entry)).length, 2)
	assert.equal(game.action.after_entrench, undefined)
})

test("sequential Soviet entrenchment is replay-deterministic from the same seed and state", () => {
	const moscow = data.spaces.find((space) => space?.name === "Moscow").id
	const leningrad = data.spaces.find((space) => space?.name === "Leningrad").id
	const fronts = data.pieces.filter((piece) => piece?.nation === "su" && piece.size === "lcu").slice(0, 2)
	const original = rules.setup(22, "Campaign", {})
	original.pieces.fill(0)
	original.pieces[fronts[0].id] = moscow
	original.pieces[fronts[1].id] = leningrad
	original.control = data.spaces.map((space) => (space?.kind === "land" ? "allied" : null))
	original.active = "Allied"
	original.state = "ops_entrench_roll"
	original.phase = "action"
	original.turn = 3
	original.trench = {}
	original.trench_owner = {}
	original.trench_kind = {}
	original.action = {
		mode: "ops",
		points: 0,
		move_spaces: [],
		attack_spaces: [],
		activation_supply: {
			[fronts[0].id]: "full",
			[fronts[1].id]: "full",
		},
		moved: [fronts[0].id, fronts[1].id],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [
			{ piece_id: fronts[1].id, space_id: leningrad },
			{ piece_id: fronts[0].id, space_id: moscow },
		],
		after_entrench: "combat",
		piece: null,
	}
	let first = JSON.parse(JSON.stringify(original))
	let second = JSON.parse(JSON.stringify(original))

	first = rules.action(first, "Allied", "space", leningrad)
	second = rules.action(second, "Allied", "space", leningrad)
	assert.deepEqual(second, first)
	first = rules.action(first, "Allied", "roll")
	second = rules.action(second, "Allied", "roll")
	assert.deepEqual(second, first)
})

test("end-of-turn trench removal alternates roles before advancing the turn", () => {
	let game = rules.setup(9, "Campaign", {})
	const alliedTrench = Number(Object.keys(game.trench).find((spaceId) => game.trench_owner[spaceId] === "allied"))
	const axisTrench = Number(Object.keys(game.trench).find((spaceId) => game.trench_owner[spaceId] === "axis"))
	game.active = "Allied"
	game.state = "end_remove_trenches"
	game.phase = "end"
	game.turn = 3
	game.end_removal_side = "allied"
	assert.ok(rules.view(game, "Allied").actions.space.includes(alliedTrench))
	assert.equal(rules.view(game, "Axis").actions, undefined)
	game = rules.action(game, "Allied", "space", alliedTrench)
	assert.equal(game.trench[alliedTrench], undefined)
	game = rules.action(game, "Allied", "done")
	assert.equal(game.active, "Axis")
	assert.ok(rules.view(game, "Axis").actions.space.includes(axisTrench))
	game = rules.action(game, "Axis", "done")
	assert.equal(game.turn, 4)
})

test("units that already retreated this round do not add defensive strength", () => {
	const adjacency = Engine.map.buildAdjacency(data)
	const target = data.spaces.find((space) => space?.kind === "land" && (adjacency[space.id] || []).some((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land"))
	const origin = adjacency[target.id].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").to
	const attacker = data.pieces.filter((piece) => piece?.side === "axis").sort((a, b) => Number(b.cf) - Number(a.cf))[0].id
	const defenders = data.pieces
		.filter((piece) => piece?.side === "allied")
		.slice(0, 2)
		.map((piece) => piece.id)
	let game = rules.setup(13, "Campaign", {})
	game.pieces.fill(0)
	game.pieces[attacker] = origin
	game.pieces[defenders[0]] = target.id
	game.pieces[defenders[1]] = target.id
	game.control = data.spaces.map((space) => (space ? "axis" : null))
	game.control[target.id] = "allied"
	game.active = "Axis"
	game.state = "ops_combat"
	game.phase = "action"
	game.turn = 8
	game.action_round = 2
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [],
		attack_spaces: [origin],
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	game.retreat_history = [{ turn: 8, round: 2, pieces: [defenders[0]], path: [target.id] }]
	game = rules.action(game, "Axis", "piece", attacker)
	game = rules.action(game, "Axis", "space", target.id)
	assert.deepEqual(game.combat.retreated_defenders, [defenders[0]])
	assert.deepEqual(game.combat.defenders, [defenders[1]])
	game = rules.action(game, "Axis", "confirm")
	game = rules.action(game, "Axis", "continue")
	game = rules.action(game, "Allied", "continue")
	assert.equal(game.combat.defender_strength, Engine.combat.combatStrength(game, data, defenders[1]))
	if (game.combat.defender_loss >= 1) assert.equal(Engine.combat.isOnMap(game, defenders[0]), false)
})

test("defending units may retreat to different destinations", () => {
	const adjacency = Engine.map.buildAdjacency(data)
	const target = data.spaces.find((space) => space?.kind === "land" && (adjacency[space.id] || []).filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").length >= 2)
	const defenders = data.pieces
		.filter((piece) => piece?.nation === "ge" && piece.size === "scu")
		.slice(0, 2)
		.map((piece) => piece.id)
	let game = rules.setup(17, "Campaign", {})
	game.pieces.fill(0)
	for (const pieceId of defenders) game.pieces[pieceId] = target.id
	game.control = data.spaces.map((space) => (space ? "axis" : null))
	game.active = "Axis"
	game.state = "combat_retreat"
	game.phase = "action"
	game.turn = 8
	game.action_round = 2
	game.action = {
		mode: "ops",
		attack_spaces: [],
		attacked: [],
		defended: [],
		used_pieces: [],
	}
	game.combat = {
		origin_spaces: [],
		defender_space: target.id,
		attackers: [],
		defenders,
		attacker_side: "allied",
		defender_side: "axis",
		retreat_distance: 1,
		retreat_pending: defenders.slice(),
		retreat_paths: {},
		retreat_vacated: [target.id],
	}
	game = rules.action(game, "Axis", "piece", defenders[0])
	const firstChoices = rules.view(game, "Axis").actions.move
	assert.ok(firstChoices.length >= 2)
	const firstOrigin = game.pieces[defenders[0]]
	game = rules.action(game, "Axis", "move", firstChoices[0])
	assert.equal(rules.view(game, "Axis").actions.undo, 1)
	game = rules.action(game, "Axis", "undo")
	assert.equal(game.pieces[defenders[0]], firstOrigin)
	assert.equal(game.state, "combat_retreat_piece")
	game = rules.action(game, "Axis", "move", firstChoices[0])
	game = rules.action(game, "Axis", "piece", defenders[1])
	const secondChoices = rules.view(game, "Axis").actions.move
	const secondDestination = secondChoices.find((spaceId) => spaceId !== firstChoices[0])
	assert.ok(secondDestination)
	game = rules.action(game, "Axis", "move", secondDestination)
	assert.equal(game.state, "combat_retreat")
	assert.equal(rules.view(game, "Axis").actions.done, 1)
	assert.equal(rules.view(game, "Axis").actions.undo, 1)
	assert.notEqual(game.pieces[defenders[0]], game.pieces[defenders[1]])
	game = rules.action(game, "Axis", "done")
	assert.equal(game.state, "combat_advance")
	assert.equal(game.undo.length, 0)
})

test("combat advance selects and moves a unit group in one action", () => {
	let game = rules.setup(18, "Campaign", {})
	const memel = data.spaces.find((space) => space?.name === "Memel").id
	const konigsberg = data.spaces.find((space) => space?.name === "Konigsberg").id
	const attackers = data.pieces
		.filter((piece) => piece?.nation === "ge" && !piece.name.includes("1FJ"))
		.slice(0, 3)
		.map((piece) => piece.id)
	game.pieces.fill(0)
	for (const pieceId of attackers) game.pieces[pieceId] = memel
	game.control = data.spaces.map((space) => (space ? "axis" : null))
	game.active = "Axis"
	game.state = "combat_advance"
	game.phase = "action"
	game.turn = 8
	game.action_round = 2
	game.action = {
		mode: "ops",
		move_spaces: [],
		attack_spaces: [memel],
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	game.combat = {
		origin_spaces: [memel],
		defender_space: konigsberg,
		attackers,
		defenders: [],
		advanced: [],
		retreat_paths: {},
		attacker_side: "axis",
		defender_side: "allied",
	}
	game = rules.action(game, "Axis", "piece", attackers[0])
	assert.equal(game.state, "combat_advance")
	assert.deepEqual(game.combat.advance_pieces, [attackers[0]])
	assert.equal(rules.view(game, "Axis").actions.done, undefined)
	assert.ok(rules.view(game, "Axis").actions.piece.includes(attackers[1]))
	game = rules.action(game, "Axis", "piece", attackers[1])
	assert.deepEqual(game.combat.advance_pieces, attackers.slice(0, 2))
	assert.ok(rules.view(game, "Axis").actions.move.includes(konigsberg))
	game = rules.action(game, "Axis", "move", konigsberg)
	assert.equal(game.state, "combat_advance")
	assert.equal(game.pieces[attackers[0]], konigsberg)
	assert.equal(game.pieces[attackers[1]], konigsberg)
	assert.equal(game.pieces[attackers[2]], memel)
	assert.ok(renderLog(game).includes(`*推进：s${konigsberg}`))
	assert.ok(renderLog(game).includes(`> ${Engine.state.pieceLogRef(game, attackers[0])}`))
	assert.ok(renderLog(game).includes(`> ${Engine.state.pieceLogRef(game, attackers[1])}`))
})

test("Axis strategic-objective attack restrictions follow persistent events and Nordlicht's play round", () => {
	const names = Object.fromEntries(data.spaces.filter(Boolean).map((space) => [space.name, space.id]))
	const game = {
		turn: 5,
		action_round: 2,
		events: {},
		control: data.spaces.map((space) => space?.side || null),
	}
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", names.Leningrad), false)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", names.Moscow), false)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", names.Maikop), false)
	game.events.nordlicht = true
	game.events.taifun = true
	game.events.fall_blau = true
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", names.Leningrad), true)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", names.Moscow), true)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", names.Maikop), true)
	game.events.nordlicht_round = { turn: 5, round: 2 }
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", names.Moscow), false)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "axis", names.Leningrad), true)
	assert.equal(Engine.combat.mayAttackSpace(game, data, "allied", names.Moscow), true)
})

test("additive engineering fields normalize within the current schema", () => {
	const game = rules.setup(19, "Campaign", {})
	delete game.trench_owner
	delete game.destroyed_forts
	const normalized = rules.normalize_game(game)
	assert.equal(normalized.schema_version, 5)
	assert.equal(normalized.data_version, 1)
	assert.equal(normalized.ruleset_version, 1)
	assert.deepEqual(normalized.destroyed_forts, [])
	for (const spaceId of Object.keys(normalized.trench)) assert.equal(normalized.trench_owner[spaceId], normalized.control[spaceId])
})
