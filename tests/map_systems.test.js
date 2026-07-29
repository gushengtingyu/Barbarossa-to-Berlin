"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog } = require("./i18n_helpers.js")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine
const adjacency = Engine.map.buildAdjacency(data)

function space(name, nation = null) {
	return data.spaces.find((entry) => entry?.name === name && (!nation || entry.nation === nation)).id
}

function standFastPayments(game) {
	return (game.log || []).filter((entry) => entry?.key === "orders.log.stand_fast_payment")
}

test("movement uses the unit allowance and never traverses Sea SR nodes", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const memel = space("Memel")
	const panzer = Engine.map.friendlyPiecesInSpace(game, data, "axis", memel).find((pieceId) => data.pieces[pieceId].unit_type === "mechanized")
	const paths = Engine.map.legalMovePaths(game, data, adjacency, panzer)
	assert.equal(paths.has(memel), false)
	assert.ok([...paths.values()].some((path) => path.length >= 3))
	for (const path of paths.values())
		assert.equal(
			path.some((spaceId) => data.spaces[spaceId].kind === "sr"),
			false,
		)
})

test("Rule 10.1 charges one MP across regular and river connections, permits overstack transit, and rejects Sea SR shortcuts", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Origin", kind: "land", nation: "fr" }, { id: 2, name: "Crossing", kind: "land", nation: "fr" }, { id: 3, name: "Destination", kind: "land", nation: "fr" }],
		pieces: [
			null,
			{ id: 1, name: "BR mover", side: "allied", nation: "br", size: "scu", mf: 2, rmf: 2 },
			{ id: 2, name: "BR corps 1", side: "allied", nation: "br", size: "scu", mf: 3, rmf: 3 },
			{ id: 3, name: "BR corps 2", side: "allied", nation: "br", size: "scu", mf: 3, rmf: 3 },
			{ id: 4, name: "BR corps 3", side: "allied", nation: "br", size: "scu", mf: 3, rmf: 3 },
			{ id: 5, name: "GE corps", side: "axis", nation: "ge", size: "scu", mf: 3, rmf: 3 },
		],
	}
	const localAdjacency = [
		[],
		[
			{ to: 2, type: "river" },
			{ to: 3, type: "sr" },
		],
		[
			{ to: 1, type: "river" },
			{ to: 3, type: "regular" },
		],
		[
			{ to: 1, type: "sr" },
			{ to: 2, type: "regular" },
		],
	]
	const game = {
		turn: 8,
		action_round: 1,
		pieces: [null, 1, 2, 2, 2, 0],
		reduced: [],
		control: [null, "allied", "allied", "allied"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
		action: { attack_spaces: [], activation_supply: { 1: "full" } },
	}

	let paths = Engine.map.legalMovePaths(game, localData, localAdjacency, 1)
	assert.equal(paths.has(2), false)
	assert.deepEqual(paths.get(3), [2, 3])

	game.pieces[5] = 2
	paths = Engine.map.legalMovePaths(game, localData, localAdjacency, 1)
	assert.equal(paths.has(3), false)
})

test("Rule 10.1 permits a formation to revisit a space while it still has movement points", () => {
	const localData = {
		spaces: [null, { id: 1, kind: "land", nation: "fr" }, { id: 2, kind: "land", nation: "fr" }],
		pieces: [null, { id: 1, name: "BR Corps", side: "allied", nation: "br", size: "scu", mf: 2, rmf: 2 }],
	}
	const localAdjacency = [[], [{ to: 2, type: "regular" }], [{ to: 1, type: "regular" }]]
	const game = {
		turn: 8,
		action_round: 1,
		pieces: [null, 2],
		reduced: [],
		control: [null, "allied", "allied"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
		action: {
			attack_spaces: [],
			activation_supply: { 1: "full" },
		},
	}
	assert.deepEqual(Engine.map.legalMoveFormationSteps(game, localData, localAdjacency, [1], [1, 2]), [1])
})

test("Winter 42 German mechanized units in the USSR cannot convert movement or support an extra attack origin", () => {
	const localData = {
		spaces: [null, { id: 1, kind: "land", nation: "su" }, { id: 2, kind: "land", nation: "su" }],
		pieces: [null, { id: 1, side: "axis", nation: "ge", size: "lcu", mf: 4, rmf: 4 }],
	}
	const game = {
		turn: 4,
		action_round: 1,
		pieces: [null, 2],
		reduced: [],
		control: [null, "axis", "axis"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
		action: {
			attack_spaces: [2],
			activation_supply: { 1: "limited" },
		},
	}
	assert.equal(Engine.map.isMechanizedInSupply(game, localData, [[], [], []], 1), false)
	assert.equal(Engine.map.canEndFormationMovement(game, localData, [[], [], []], [1], 2), false)
	game.events.von_paulus_pause = true
	assert.equal(Engine.map.isMechanizedInSupply(game, localData, [[], [], []], 1), true)
	assert.equal(Engine.map.canEndFormationMovement(game, localData, [[], [], []], [1], 2), true)
})

test("stacking enforces the three-unit, Soviet, Yugoslav, and Hungary-Romania limits", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const destination = space("Vienna")
	const soviet = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "scu").id
	const german = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu").id
	const yugoslav = data.pieces.find((piece) => piece?.nation === "yu").id
	const hungarian = data.pieces.find((piece) => piece?.nation === "hu").id
	const romanian = data.pieces.find((piece) => piece?.nation === "ro").id
	game.pieces.fill(0)
	game.pieces[german] = destination
	assert.equal(Engine.map.canStack(game, data, soviet, destination), false)
	assert.equal(Engine.map.canStack(game, data, yugoslav, destination), false)
	game.pieces.fill(0)
	game.pieces[hungarian] = destination
	assert.equal(Engine.map.canStack(game, data, romanian, destination), false)
	const germanIds = data.pieces
		.filter((piece) => piece?.nation === "ge" && piece.size === "scu")
		.slice(0, 4)
		.map((piece) => piece.id)
	game.pieces.fill(0)
	for (const id of germanIds.slice(0, 3)) game.pieces[id] = destination
	assert.equal(Engine.map.canStack(game, data, germanIds[3], destination), false)
})

test("Rule 9.1 excludes Stalin from stacking, enemy-unit blocking, and Stand Fast unit tracking", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 31, {})
	const moscow = space("Moscow")
	const stalin = data.pieces.find((piece) => piece?.name === "Stalin").id
	const soviets = data.pieces
		.filter((piece) => piece?.nation === "su" && ["scu", "lcu"].includes(piece.size))
		.slice(0, 4)
		.map((piece) => piece.id)
	const german = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu").id
	const origin = adjacency[moscow].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").to

	game.pieces.fill(0)
	game.pieces[stalin] = moscow
	game.stalin_location = moscow
	for (const pieceId of soviets.slice(0, 2)) game.pieces[pieceId] = moscow
	assert.equal(Engine.map.canStack(game, data, soviets[2], moscow), true)
	game.pieces[soviets[2]] = moscow
	assert.equal(Engine.map.canStack(game, data, soviets[3], moscow), false)
	assert.deepEqual(
		Engine.map.friendlyPiecesInSpace(game, data, "allied", moscow).sort((a, b) => a - b),
		soviets.slice(0, 3).sort((a, b) => a - b),
	)

	for (const pieceId of soviets) game.pieces[pieceId] = 0
	game.pieces[german] = origin
	game.control[origin] = "axis"
	game.control[moscow] = "allied"
	game.action = { attack_spaces: [], activation_supply: { [german]: "full" } }
	assert.deepEqual(Engine.map.enemyPiecesInSpace(game, data, "axis", moscow), [])
	assert.equal(Engine.map.legalMoveDestinations(game, data, adjacency, german).includes(moscow), true)

	game.stand_fast[moscow] = "stalin"
	Engine.orders.recordStandFastUnits(game, data)
	assert.deepEqual(game.stand_fast_round_units[moscow], [])
})

test("Rule 9.1 rejects enemy-occupied entry at the shared map gateway without mutating either unit", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 32, {})
	const origin = space("Mozhaisk")
	const destination = space("Moscow")
	const german = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu").id
	const soviet = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "scu").id
	game.pieces.fill(0)
	game.pieces[german] = origin
	game.pieces[soviet] = destination

	assert.throws(() => Engine.map.enterSpace(game, data, german, destination), /enemy-occupied/)
	assert.equal(game.pieces[german], origin)
	assert.equal(game.pieces[soviet], destination)
})

test("activation groups British/Commonwealth together and charges Limited Supply per unit", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const cairo = space("Cairo")
	const british = data.pieces.find((piece) => piece?.nation === "br" && piece.size === "scu").id
	const commonwealth = data.pieces.find((piece) => piece?.nation === "cw" && piece.size === "scu").id
	game.pieces[british] = cairo
	game.pieces[commonwealth] = cairo
	assert.equal(Engine.map.activationCost(game, data, "allied", cairo, adjacency), 1)
	const tripoli = space("Tripoli")
	game.pieces[british] = tripoli
	game.pieces[commonwealth] = tripoli
	game.control[tripoli] = "allied"
	assert.equal(Engine.map.activationCost(game, data, "allied", tripoli, adjacency), 2)
})

test("Rule 13.3 charges Panzer Armee Afrika outside Libya unless it is in Full Supply", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Egypt", kind: "land", nation: "eg" }, { id: 2, name: "Sea SR", kind: "sr", nation: "sea" }, { id: 3, name: "Ruhr", kind: "land", nation: "ge", supply: "axis" }],
		pieces: [null, { id: 1, name: "GE Panzer Armee Afrika", side: "axis", nation: "ge", size: "lcu", traits: "panzer_armee_afrika" }],
	}
	const game = {
		pieces: [null, 1],
		control: [null, "axis", null, "axis"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
		turn: 1,
	}
	const limited = [
		[],
		[{ to: 2, type: "sr" }],
		[
			{ to: 1, type: "sr" },
			{ to: 3, type: "sr" },
		],
		[{ to: 2, type: "sr" }],
	]
	assert.equal(Engine.map.activationCost(game, localData, "axis", 1, limited), 2)

	const full = [[], [{ to: 3, type: "regular" }], [], [{ to: 1, type: "regular" }]]
	assert.equal(Engine.map.activationCost(game, localData, "axis", 1, full), 1)

	localData.spaces[1].nation = "ly"
	assert.equal(Engine.map.activationCost(game, localData, "axis", 1, limited), 1)
})

test("Rule 13.6 charges each Axis LCU whose supply must use a Caucasus gateway", () => {
	const localData = {
		spaces: [
			null,
			{ id: 1, name: "Caucasus Interior", kind: "land", nation: "su" },
			{ id: 2, name: "Maikop", kind: "land", nation: "su" },
			{ id: 3, name: "Ruhr", kind: "land", nation: "ge", supply: "axis" },
			{ id: 4, name: "Alternate Route", kind: "land", nation: "su" },
			{ id: 5, name: "SeaSR Baku", kind: "sr", nation: "sea" },
		],
		pieces: [null, { id: 1, name: "GE Army A", side: "axis", nation: "ge", size: "lcu" }, { id: 2, name: "GE Army B", side: "axis", nation: "ge", size: "lcu" }],
	}
	const game = {
		pieces: [null, 1, 1],
		control: [null, "axis", "axis", "axis", "axis", null],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
		turn: 1,
	}
	const landGateway = [
		[],
		[{ to: 2, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
		[],
		[],
	]
	assert.equal(Engine.map.activationCost(game, localData, "axis", 1, landGateway), 3)

	const alternate = landGateway.map((edges) => edges.slice())
	alternate[1].push({ to: 4, type: "regular" })
	alternate[4].push({ to: 1, type: "regular" }, { to: 3, type: "regular" })
	alternate[3].push({ to: 4, type: "regular" })
	assert.equal(Engine.map.activationCost(game, localData, "axis", 1, alternate), 1)

	game.pieces[2] = 0
	const seaGateway = [
		[],
		[{ to: 5, type: "sr" }],
		[],
		[{ to: 5, type: "sr" }],
		[],
		[
			{ to: 1, type: "sr" },
			{ to: 3, type: "sr" },
		],
	]
	assert.equal(Engine.map.activationCost(game, localData, "axis", 1, seaGateway), 2)
})

test("activation cancellation refunds OPS and clears the supply snapshot", () => {
	let game = rules.setup(18, "Campaign", {})
	const memel = space("Memel")
	const pieces = Engine.map.friendlyPiecesInSpace(game, data, "axis", memel)
	const cost = Engine.map.activationCost(game, data, "axis", memel, adjacency)
	game.active = "Axis"
	game.phase = "action"
	game.state = "ops_activate"
	game.action = {
		mode: "ops",
		points: cost + 1,
		move_spaces: [],
		attack_spaces: [],
		activation_cost: {},
		activation_supply: {},
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}

	game = rules.action(game, "Axis", "space", memel)
	assert.deepEqual(game.action.move_spaces, [memel])
	assert.equal(game.action.points, 1)
	assert.ok(pieces.every((pieceId) => game.action.activation_supply[pieceId]))
	const activeView = rules.view(game, "Axis")
	assert.ok(activeView.actions.deactivate.includes(memel))
	assert.equal(activeView.action.activation_costs, undefined)

	game = rules.action(game, "Axis", "deactivate", memel)
	assert.equal(game.action.points, cost + 1)
	assert.deepEqual(game.action.move_spaces, [])
	assert.deepEqual(game.action.attack_spaces, [])
	assert.ok(pieces.every((pieceId) => game.action.activation_supply[pieceId] === undefined))

	game = rules.action(game, "Axis", "space", memel)
	assert.equal(rules.view(game, "Axis").actions.continue, undefined)
	assert.equal(rules.view(game, "Axis").actions.done, 1)
	game = rules.action(game, "Axis", "done")
	assert.equal(game.state, "ops_move")
})

test("OPS activation offers only spaces with a real move, entrench, or combat continuation", () => {
	const game = rules.setup(19, "Campaign", {})
	const berlin = space("Berlin")
	const malta = space("Malta")
	const army = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && Number(piece.mf) > 0).id
	game.pieces.fill(0)
	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "axis" : null))
	game.pieces[army] = malta
	game.active = "Axis"
	game.phase = "action"
	game.state = "ops_activate"
	game.action = {
		mode: "ops",
		points: 5,
		move_spaces: [],
		attack_spaces: [],
		activation_cost: {},
		activation_supply: {},
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}

	let activeView = rules.view(game, "Axis")
	assert.equal(activeView.actions.space?.includes(malta) || false, false)
	assert.equal(activeView.actions.attack?.includes(malta) || false, false)
	const beforeForgery = JSON.stringify(game)
	assert.throws(() => rules.action(game, "Axis", "attack", malta), /illegal action/)
	assert.equal(JSON.stringify(game), beforeForgery)

	game.pieces[army] = berlin
	activeView = rules.view(game, "Axis")
	assert.ok(activeView.actions.space.includes(berlin))
	assert.equal(activeView.actions.attack?.includes(berlin) || false, false)
})

test("Rally activation actions record Rule 13.1 supply snapshots", () => {
	let game = rules.setup(13, "Campaign", {})
	const memel = space("Memel")
	const pieces = Engine.map.friendlyPiecesInSpace(game, data, "axis", memel)
	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "allied" : null))
	game.control[memel] = "axis"
	game.active = "Axis"
	game.phase = "action"
	game.state = "ops_activate"
	game.action = {
		mode: "ops",
		points: 5,
		move_spaces: [],
		attack_spaces: [],
		activation_supply: {},
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}

	assert.equal(rules.view(game, "Axis").actions.attack.includes(memel), true)
	game = rules.action(game, "Axis", "attack", memel)
	assert.deepEqual(
		pieces.map((pieceId) => game.action.activation_supply[pieceId]),
		pieces.map(() => "oos"),
	)
	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "axis" : null))
	for (const pieceId of pieces) assert.equal(Engine.map.activationSupplyStatus(game, data, adjacency, pieceId), "oos")
})

test("the last OPS activation advances immediately and movement uses compact logs", () => {
	let game = rules.setup(15, "Campaign", {})
	const memel = space("Memel")
	const pieceId = Engine.map.friendlyPiecesInSpace(game, data, "axis", memel).find((id) => Engine.map.legalMoveDestinations(game, data, adjacency, id).length)
	const activationCost = Engine.map.activationCost(game, data, "axis", memel, adjacency)
	game.active = "Axis"
	game.phase = "action"
	game.state = "ops_activate"
	game.action = {
		mode: "ops",
		points: activationCost,
		move_spaces: [],
		attack_spaces: [],
		activation_supply: {},
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	assert.equal(rules.view(game, "Axis").actions.continue, undefined)
	assert.equal(rules.view(game, "Axis").actions.done, 1)
	game = rules.action(game, "Axis", "space", memel)
	assert.equal(game.state, "ops_move")
	assert.ok(rules.view(game, "Axis").log.includes("*移动"))
	assert.ok(rules.view(game, "Axis").log.includes(`> s${memel}`))
	game = rules.action(game, "Axis", "piece", pieceId)
	const destination = rules.view(game, "Axis").actions.move[0]
	game = rules.action(game, "Axis", "move", destination)
	if (rules.view(game, "Axis").actions.stop) game = rules.action(game, "Axis", "stop")
	assert.ok(rules.view(game, "Axis").log.includes(`从 s${memel} 移动`))
	assert.ok(rules.view(game, "Axis").log.includes(`> ${Engine.state.pieceLogRef(game, pieceId)} -> s${destination}`))
	assert.ok(renderLog(game, "en").includes(`Moved from s${memel}`))
})

test("a movement group selects, moves, and stops multiple units together", () => {
	let game = rules.setup(16, "Campaign", {})
	const memel = space("Memel")
	const pieces = Engine.map.friendlyPiecesInSpace(game, data, "axis", memel)
	game.active = "Axis"
	game.phase = "action"
	game.state = "ops_move"
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [memel],
		attack_spaces: [],
		activation_supply: {},
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	Engine.map.recordActivationSupply(game, data, adjacency, "axis", memel)
	game = rules.action(game, "Axis", "piece", pieces[0])
	assert.ok(rules.view(game, "Axis").actions.piece.includes(pieces[1]))
	game = rules.action(game, "Axis", "piece", pieces[1])
	assert.deepEqual(game.action.move.pieces, pieces.slice(0, 2))
	const firstStep = rules.view(game, "Axis").actions.move.find((destination) => Engine.map.canStackFormation(game, data, pieces.slice(0, 2), destination))
	assert.ok(firstStep)
	assert.ok(adjacency[memel].some((edge) => edge.to === firstStep && edge.type !== "sr"))
	game = rules.action(game, "Axis", "move", firstStep)
	assert.equal(game.pieces[pieces[0]], firstStep)
	assert.equal(game.pieces[pieces[1]], firstStep)
	assert.equal(rules.view(game, "Axis").actions.stop, 1)
	game = rules.action(game, "Axis", "stop")
	assert.equal(game.state, "ops_move")
	assert.ok(game.action.moved.includes(pieces[0]))
	assert.ok(game.action.moved.includes(pieces[1]))
	const firstGroup = pieces.slice(0, 2).map((pieceId) => Engine.state.pieceLogRef(game, pieceId))
	assert.ok(renderLog(game).includes(`> ${firstGroup.join("、")} -> s${firstStep}`))
	assert.ok(renderLog(game, "en").includes(`> ${firstGroup.join(", ")} -> s${firstStep}`))
	assert.equal(game.log.filter((entry) => entry.key === "activation.log.move_group").length, 1)

	game = rules.action(game, "Axis", "piece", pieces[2])
	assert.ok(rules.view(game, "Axis").actions.move.includes(firstStep))
	game = rules.action(game, "Axis", "move", firstStep)
	game = rules.action(game, "Axis", "stop")
	assert.equal(game.log.filter((entry) => entry.key === "activation.log.move_from").length, 2)
	assert.equal(game.log.filter((entry) => entry.key === "activation.log.move_group").length, 2)
})

test("a completed move activation removes its marker before the combat step", () => {
	let game = rules.setup(20, "Campaign", {})
	const memel = space("Memel")
	const berlin = space("Berlin")
	const mover = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && Number(piece.mf) >= 4).id
	const attackHolder = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu").id
	game.pieces.fill(0)
	game.pieces[mover] = memel
	game.pieces[attackHolder] = berlin
	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "axis" : null))
	game.active = "Axis"
	game.phase = "action"
	game.state = "ops_move"
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [memel],
		attack_spaces: [berlin],
		activation_supply: {},
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	Engine.map.recordActivationSupply(game, data, adjacency, "axis", memel)
	game = rules.action(game, "Axis", "piece", mover)
	const destination = rules.view(game, "Axis").actions.move[0]
	game = rules.action(game, "Axis", "move", destination)
	game = rules.action(game, "Axis", "stop")
	assert.deepEqual(game.action.move_spaces, [])
	assert.equal(game.state, "ops_combat")
})

test("a slower unit automatically drops from a moving group while faster units continue", () => {
	let game = rules.setup(17, "Campaign", {})
	const memel = space("Memel")
	const konigsberg = space("Konigsberg")
	const slow = data.pieces.find((piece) => piece?.name === "GE 1FJ Army").id
	const fast = data.pieces.find((piece) => piece?.name === "GE Armor SCU").id
	game.pieces[slow] = memel
	game.pieces[fast] = memel
	game.active = "Axis"
	game.phase = "action"
	game.state = "ops_move"
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [memel],
		attack_spaces: [],
		activation_supply: { [slow]: "full", [fast]: "full" },
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	game = rules.action(game, "Axis", "piece", slow)
	game = rules.action(game, "Axis", "piece", fast)
	assert.ok(rules.view(game, "Axis").actions.move.includes(konigsberg))
	game = rules.action(game, "Axis", "move", konigsberg)
	assert.ok(game.action.moved.includes(slow))
	assert.deepEqual(game.action.move.pieces, [fast])
	assert.equal(game.action.move.current, konigsberg)
	assert.ok(rules.view(game, "Axis").actions.move.length > 0)
	assert.ok(renderLog(game).includes(`> ${Engine.state.pieceLogRef(game, slow)} -> s${konigsberg}`))
	assert.equal(game.log.filter((entry) => entry.key === "activation.log.move_from").length, 1)
	assert.equal(game.log.filter((entry) => entry.key === "activation.log.move_group").length, 1)
	assert.equal(rules.view(game, "Axis").actions.stop, 1)
	game = rules.action(game, "Axis", "stop")
	assert.ok(renderLog(game).includes(`> ${Engine.state.pieceLogRef(game, fast)} -> s${konigsberg}`))
	assert.equal(game.log.filter((entry) => entry.key === "activation.log.move_from").length, 1)
	assert.equal(game.log.filter((entry) => entry.key === "activation.log.move_group").length, 2)
})

test("movement return restores the unit-selection checkpoint without replay noise", () => {
	let game = rules.setup(14, "Campaign", {})
	const memel = space("Memel")
	const pieceId = Engine.map.friendlyPiecesInSpace(game, data, "axis", memel).find((id) => Engine.map.legalMoveDestinations(game, data, adjacency, id).length)
	game.active = "Axis"
	game.phase = "action"
	game.state = "ops_move"
	game.action = {
		mode: "ops",
		points: 0,
		move_spaces: [memel],
		attack_spaces: [],
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	assert.equal(rules.view(game, "Axis").actions.continue, undefined)
	game.action.attack_spaces.push(memel)
	assert.equal(rules.view(game, "Axis").actions.continue, undefined)
	assert.equal(rules.view(game, "Axis").actions.done, 1)
	game.action.attack_spaces.length = 0
	const actionLogLength = game.action_log.length
	game = rules.action(game, "Axis", "piece", pieceId)
	assert.equal(game.state, "ops_move_piece")
	assert.equal(game.action.piece, pieceId)
	game = rules.action(game, "Axis", "pass")
	assert.equal(game.state, "ops_move")
	assert.equal(game.action.piece, null)
	assert.equal(game.action_log.length, actionLogLength)
})

test("national restrictions keep the Hungarian 3rd Army in Hungary", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const army = data.pieces.find((piece) => piece?.name.includes("HU 3 Army")).id
	const paths = Engine.map.legalMovePaths(game, data, adjacency, army)
	for (const destination of paths.keys()) assert.equal(data.spaces[destination].nation, "hu")
})

test("Sea SR permits an SCU to cross the reviewed Mediterranean network but not an LCU", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const tripoli = space("Tripoli")
	const scu = Engine.map.friendlyPiecesInSpace(game, data, "axis", tripoli).find((pieceId) => data.pieces[pieceId].size === "scu")
	const paths = Engine.map.legalSrPaths(game, data, adjacency, scu)
	assert.equal(paths.has(space("Syracuse")), true)
	const lcu = data.pieces.find((piece) => piece?.side === "axis" && piece.size === "lcu").id
	game.pieces[lcu] = tripoli
	assert.equal(Engine.map.legalSrPaths(game, data, adjacency, lcu).has(space("Syracuse")), false)
})

test("Rule 12.2 permits only regular and Sea SR connections, never river connections", () => {
	const localData = {
		spaces: [
			null,
			{ id: 1, name: "Origin", kind: "land", nation: "ge", supply: "axis" },
			{ id: 2, name: "Across river", kind: "land", nation: "ge", supply: "axis" },
			{ id: 3, name: "By rail", kind: "land", nation: "ge", supply: "axis" },
		],
		pieces: [null, { id: 1, name: "GE corps", side: "axis", nation: "ge", size: "scu", unit_type: "infantry" }],
	}
	const localAdjacency = [
		[],
		[
			{ to: 2, type: "river" },
			{ to: 3, type: "regular" },
		],
		[{ to: 1, type: "river" }],
		[{ to: 1, type: "regular" }],
	]
	const game = {
		turn: 5,
		pieces: [null, 1],
		control: [null, "axis", "axis", "axis"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
	}

	const paths = Engine.map.legalSrPaths(game, localData, localAdjacency, 1)
	assert.equal(paths.has(2), false)
	assert.deepEqual(paths.get(3), [3])
})

test("Rule 12.5 North Africa limit blocks Sea SR only into Tunisia or Libya", () => {
	const localData = {
		spaces: [
			null,
			{ id: 1, name: "Origin", kind: "land", nation: "it", supply: "axis" },
			{ id: 2, name: "Sea", kind: "sr", nation: "sea" },
			{ id: 3, name: "Egypt", kind: "land", nation: "eg", supply: "axis" },
			{ id: 4, name: "Tunisia", kind: "land", nation: "tn", supply: "axis" },
			{ id: 5, name: "Libya", kind: "land", nation: "ly", supply: "axis" },
		],
		pieces: [
			null,
			{ id: 1, name: "Moving Panzer corps", side: "axis", nation: "ge", size: "scu", unit_type: "mechanized" },
			{ id: 2, name: "Panzer corps 1", side: "axis", nation: "ge", size: "scu", unit_type: "mechanized" },
			{ id: 3, name: "Panzer corps 2", side: "axis", nation: "ge", size: "scu", unit_type: "mechanized" },
		],
	}
	const localAdjacency = [
		[],
		[{ to: 2, type: "sr" }],
		[
			{ to: 1, type: "sr" },
			{ to: 3, type: "sr" },
			{ to: 4, type: "sr" },
		],
		[{ to: 2, type: "sr" }],
		[{ to: 2, type: "sr" }],
		[],
	]
	const game = {
		turn: 5,
		pieces: [null, 1, 4, 5],
		control: [null, "axis", null, "axis", "axis", "axis"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
	}

	const paths = Engine.map.legalSrPaths(game, localData, localAdjacency, 1)
	assert.equal(paths.has(3), true)
	assert.equal(paths.has(4), false)
})

test("Rule 12.2 allows on-map units to SR into a compatible active Beach Head", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 31, {})
	const rennes = space("Rennes")
	const beach = space("Beachhead H")
	const british = data.pieces.find((piece) => piece?.nation === "br" && piece.size === "scu").id
	const american = data.pieces.find((piece) => piece?.nation === "us" && piece.size === "scu").id
	game.turn = 10
	game.pieces.fill(0)
	game.pieces[british] = rennes
	game.pieces[american] = rennes
	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "allied" : null))
	game.beachheads[beach] = { type: "br" }

	assert.equal(Engine.map.legalSrPaths(game, data, adjacency, british).has(beach), true)
	assert.equal(Engine.map.legalSrPaths(game, data, adjacency, american).has(beach), false)
})

test("Rule 12.3 permits SR into or out of a desert, but never through it", () => {
	const localData = {
		spaces: [
			null,
			{ id: 1, name: "Supply", kind: "land", nation: "ly", supply: "axis" },
			{ id: 2, name: "Approach", kind: "land", nation: "ly" },
			{ id: 3, name: "Desert", kind: "land", nation: "ly", terrain: "desert", supply: "axis" },
			{ id: 4, name: "Beyond", kind: "land", nation: "ly", supply: "axis" },
		],
		pieces: [null, { id: 1, name: "GE corps", side: "axis", nation: "ge", size: "scu", unit_type: "infantry" }],
	}
	const localAdjacency = [
		[],
		[{ to: 2, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[
			{ to: 2, type: "regular" },
			{ to: 4, type: "regular" },
		],
		[{ to: 3, type: "regular" }],
	]
	const game = {
		turn: 5,
		pieces: [null, 1],
		control: [null, "axis", "axis", "axis", "axis"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
	}

	let paths = Engine.map.legalSrPaths(game, localData, localAdjacency, 1)
	assert.equal(paths.has(3), true)
	assert.equal(paths.has(4), false)
	game.pieces[1] = 3
	paths = Engine.map.legalSrPaths(game, localData, localAdjacency, 1)
	assert.equal(paths.has(1), true)
})

test("Rule 12.3 keeps Limited Supply SCUs out of Reserve and OOS units out of SR", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Origin", kind: "land", nation: "ge" }, { id: 2, name: "Sea", kind: "sr", nation: "sea" }, { id: 3, name: "Source", kind: "land", nation: "ge", supply: "axis" }],
		pieces: [null, { id: 1, name: "GE corps", side: "axis", nation: "ge", size: "scu", unit_type: "infantry" }],
	}
	const localAdjacency = [
		[],
		[{ to: 2, type: "sr" }],
		[
			{ to: 1, type: "sr" },
			{ to: 3, type: "sr" },
		],
		[{ to: 2, type: "sr" }],
	]
	const game = {
		turn: 5,
		pieces: [null, 1],
		control: [null, "axis", null, "axis"],
		events: {},
		options: {},
		partisans: [],
		destroyed_forts: [],
	}
	assert.equal(Engine.map.traceSupply(game, localData, localAdjacency, "axis", 1, "ge"), "limited")
	assert.equal(Engine.map.legalSrPaths(game, localData, localAdjacency, 1).has("reserve:axis"), false)

	const fullData = { ...localData, spaces: localData.spaces.slice() }
	fullData.spaces[1] = { ...fullData.spaces[1], supply: "axis" }
	assert.equal(Engine.map.traceSupply(game, fullData, localAdjacency, "axis", 1, "ge"), "full")
	assert.equal(Engine.map.legalSrPaths(game, fullData, localAdjacency, 1).has("reserve:axis"), true)
	const disconnectedAdjacency = localAdjacency.map((edges) => edges.slice())
	disconnectedAdjacency[1] = []
	assert.equal(Engine.map.traceSupply(game, localData, disconnectedAdjacency, "axis", 1, "ge"), "oos")
	assert.equal(Engine.map.legalSrPaths(game, localData, disconnectedAdjacency, 1).size, 0)
})

test("Rule 12.5 freezes Soviet LCUs while Germany controls Moscow", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 31, {})
	const front = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "lcu").id
	const moscow = space("Moscow")
	const sverdlovsk = space("Sverdlovsk")
	game.turn = 5
	game.pieces[front] = sverdlovsk
	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "allied" : null))
	game.control[moscow] = "axis"
	assert.equal(Engine.map.legalSrPaths(game, data, adjacency, front).size, 0)
	game.control[moscow] = "allied"
	assert.ok(Engine.map.legalSrPaths(game, data, adjacency, front).size > 0)
})

test("the Leningrad-Tikhvin Corridor of Death is SR-only and follows Sea SR unit limits", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const leningrad = space("Leningrad")
	const tikhvin = space("Tikhvin Volkhov")
	const scu = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "scu").id
	const lcu = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "lcu").id
	const localData = { ...data, spaces: data.spaces.slice() }
	localData.spaces[tikhvin] = {
		...data.spaces[tikhvin],
		fort: true,
		side: "allied",
	}
	game.pieces.fill(0)
	game.pieces[scu] = leningrad
	game.pieces[lcu] = leningrad
	game.turn = 5
	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "axis" : null))
	game.control[leningrad] = "allied"
	game.control[tikhvin] = "allied"
	game.control[space("Moscow")] = "allied"
	assert.equal(
		[...Engine.map.legalMovePaths(game, localData, adjacency, scu).values()].some((path) => path.length === 1 && path[0] === tikhvin),
		false,
	)
	assert.deepEqual(Engine.map.legalSrPaths(game, localData, adjacency, scu).get(tikhvin), [tikhvin])
	assert.equal(Engine.map.legalSrPaths(game, localData, adjacency, lcu).has(tikhvin), false)
})

test("Full Supply SCUs may SR between the map and Reserve while LCUs may not", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const reserveScu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu" && game.pieces[piece.id] === "reserve:axis").id
	const berlin = space("Berlin")
	assert.equal(Engine.map.legalSrPaths(game, data, adjacency, reserveScu).has(berlin), true)
	Engine.map.movePieceAlongPath(game, data, reserveScu, [berlin])
	assert.equal(Engine.map.legalSrPaths(game, data, adjacency, reserveScu).has("reserve:axis"), true)
	const lcu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu").id
	game.pieces[lcu] = "reserve:axis"
	assert.equal(Engine.map.legalSrPaths(game, data, adjacency, lcu).size, 0)
})

test("shared SR search context preserves legal-destination results", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 31, {})
	game.turn = 5
	const context = Engine.map.createSrSearchContext(game, data, adjacency)
	for (const piece of data.pieces.filter(Boolean)) {
		const expected = Engine.map.legalSrPaths(game, data, adjacency, piece.id).size > 0
		assert.equal(Engine.map.hasLegalSrDestination(game, data, adjacency, piece.id, context), expected, piece.name)
	}
})

test("Axis units cannot use SR in the Soviet Union on turns 1-4", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const pieceId = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu").id
	const location = space("Brest Litovsk")
	game.pieces[pieceId] = location
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.turn = 4
	assert.equal(Engine.map.legalSrPaths(game, data, adjacency, pieceId).size, 0)
	game.turn = 5
	assert.ok(Engine.map.legalSrPaths(game, data, adjacency, pieceId).size > 0)
})

test("Rally SR actions enumerate and execute Reserve Box entry destinations", () => {
	let game = rules.setup(10, "Campaign", {})
	const pieceId = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu" && game.pieces[piece.id] === "reserve:axis").id
	game.state = "sr_piece"
	game.phase = "action"
	game.active = "Axis"
	game.turn = 2
	game.action_round = 1
	game.action = { mode: "sr", points: 1, sr_moved: [], piece: null }
	assert.equal(rules.view(game, "Axis").actions.piece.includes(pieceId), true)
	game = rules.action(game, "Axis", "piece", pieceId)
	const berlin = space("Berlin")
	assert.equal(rules.view(game, "Axis").actions.move.includes(berlin), true)
	game = rules.action(game, "Axis", "move", berlin)
	assert.equal(game.pieces[pieceId], berlin)
	assert.equal(game.state, "action_select")
	assert.equal(game.action, null)
	assert.ok(renderLog(game).some((entry) => entry === "*战略调整"))
	assert.ok(renderLog(game).some((entry) => entry.includes(Engine.state.pieceLogRef(game, pieceId)) && entry.includes(`s${berlin}`)))
})

test("Rule 12.1 charges LCUs three SR points and Rule 7.4 prevents consecutive SR cards", () => {
	const game = rules.setup(11, "Campaign", {})
	game.turn = 5
	game.phase = "action"
	game.state = "sr_piece"
	game.active = "Axis"
	game.action_round = 2
	game.action = { mode: "sr", points: 2, sr_moved: [], sr_reserve_entries: {}, piece: null }
	const context = Engine.map.createSrSearchContext(game, data, adjacency)
	const lcu = data.pieces.find((piece) => piece?.side === "axis" && piece.size === "lcu" && Engine.map.hasLegalSrDestination(game, data, adjacency, piece.id, context)).id
	assert.equal(rules.view(game, "Axis").actions.piece.includes(lcu), false)
	game.action.points = 3
	assert.equal(rules.view(game, "Axis").actions.piece.includes(lcu), true)
	game.action.sr_moved.push(lcu)
	assert.equal(rules.view(game, "Axis").actions.piece.includes(lcu), false)

	game.state = "action_select"
	game.action = null
	game.hands.axis = [data.cards.find((card) => card?.side === "axis").id]
	game.action_history.axis = ["sr"]
	assert.equal(rules.view(game, "Axis").actions.play_sr, undefined)
	game.action_history.axis = ["sr", "ops"]
	assert.ok(rules.view(game, "Axis").actions.play_sr.length > 0)
})

test("Rule 12.4 permits one German Reserve SCU into each non-urban Wehrkreis per SR action", () => {
	let game = rules.setup(12, "Campaign", {})
	const saar = space("Saar")
	const reserveScus = data.pieces
		.filter((piece) => piece?.nation === "ge" && piece.size === "scu" && game.pieces[piece.id] === "reserve:axis")
		.slice(0, 2)
		.map((piece) => piece.id)
	assert.equal(reserveScus.length, 2)
	game.state = "sr_piece"
	game.phase = "action"
	game.active = "Axis"
	game.action = {
		mode: "sr",
		points: 2,
		sr_moved: [],
		sr_reserve_entries: {},
		piece: null,
	}

	assert.equal(rules.view(game, "Axis").actions.piece.includes(reserveScus[0]), true)
	game = rules.action(game, "Axis", "piece", reserveScus[0])
	assert.equal(rules.view(game, "Axis").actions.move.includes(saar), true)
	game = rules.action(game, "Axis", "move", saar)
	assert.equal(game.pieces[reserveScus[0]], saar)
	assert.equal(game.action.sr_reserve_entries[saar], 1)

	game = rules.action(game, "Axis", "piece", reserveScus[1])
	assert.equal(rules.view(game, "Axis").actions.move.includes(saar), false)
})

test("Time of Mud and Sunny Italy optional rules alter only their specified windows", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {
		time_of_mud: true,
		sunny_italy: true,
	})
	const panzer = data.pieces.find((piece) => piece?.nation === "ge" && piece.unit_type === "mechanized" && piece.size === "lcu").id
	const sovietSpace = space("Brest Litovsk")
	game.control = data.spaces.map((entry) => (entry ? "axis" : null))
	game.pieces[panzer] = sovietSpace
	game.control[sovietSpace] = "axis"
	game.turn = 3
	game.action_round = 2
	assert.equal(Engine.map.movementAllowance(game, data, adjacency, panzer), 3)
	game.action_round = 4
	assert.ok(Engine.map.movementAllowance(game, data, adjacency, panzer) > 3)
	const naples = space("Naples")
	game.control[naples] = "allied"
	game.turn = 3
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "allied", naples, "br"), "limited")
	game.turn = 6
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "allied", naples, "br"), "full")
})

test("Rule 13.2 limits Naples supply into France without weakening it elsewhere", () => {
	const localData = {
		spaces: [null, { id: 1, name: "French origin", kind: "land", nation: "fr" }, { id: 2, name: "Italian origin", kind: "land", nation: "it" }, { id: 3, name: "Naples", kind: "land", nation: "it", supply: "allied" }],
	}
	const localAdjacency = [
		[],
		[{ to: 3, type: "regular" }],
		[{ to: 3, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 2, type: "regular" },
		],
	]
	const game = {
		beachheads: {},
		control: [null, "allied", "allied", "allied"],
		destroyed_forts: [],
		events: {},
		options: {},
		partisans: [],
		turn: 6,
	}
	assert.equal(Engine.map.traceSupply(game, localData, localAdjacency, "allied", 1, "br"), "limited")
	assert.equal(Engine.map.traceSupply(game, localData, localAdjacency, "allied", 2, "br"), "full")
})

test("Rule 13.1 blocks supply through an empty enemy-controlled land space", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Unit", kind: "land", nation: "ge" }, { id: 2, name: "Gap", kind: "land", nation: "ge" }, { id: 3, name: "Ruhr", kind: "land", nation: "ge", supply: "axis" }],
	}
	const localAdjacency = [
		[],
		[{ to: 2, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
	]
	const game = {
		beachheads: {},
		control: [null, "axis", "allied", "axis"],
		destroyed_forts: [],
		events: {},
		options: {},
		partisans: [],
		turn: 6,
	}
	assert.equal(Engine.map.traceSupply(game, localData, localAdjacency, "axis", 1, "ge"), "oos")
	game.control[2] = "axis"
	assert.equal(Engine.map.traceSupply(game, localData, localAdjacency, "axis", 1, "ge"), "full")
})

test("Rule 13.1 exposes current OOS immediately while preserving the activation-time supply snapshot", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 73, {})
	const memel = space("Memel")
	const pieceId = Engine.map.friendlyPiecesInSpace(game, data, "axis", memel).find((id) => Number(data.pieces[id]?.mf) >= 3)
	const printedMovement = Number(data.pieces[pieceId].mf)
	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "axis" : null))
	game.action = { activation_supply: {} }

	Engine.map.recordActivationSupply(game, data, adjacency, "axis", memel)
	assert.equal(game.action.activation_supply[pieceId], "full")
	assert.equal(rules.view(game, "Axis").oos.includes(pieceId), false)

	game.control = data.spaces.map((entry) => (entry?.kind === "land" ? "allied" : null))
	game.control[memel] = "axis"
	assert.equal(Engine.map.pieceSupplyStatus(game, data, adjacency, pieceId), "oos")
	assert.equal(Engine.map.movementAllowance(game, data, adjacency, pieceId), printedMovement)

	const publicView = rules.view(game, "Axis")
	assert.ok(publicView.oos.includes(pieceId))
	assert.equal(Object.hasOwn(game, "oos"), false)
})

test("Rule 13.42 bars an OOS Soviet LCU from entrenching using its activation-time supply snapshot", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 74, {})
	const leningrad = space("Leningrad")
	const moscow = space("Moscow")
	const front = Engine.map.friendlyPiecesInSpace(game, data, "allied", leningrad).find((id) => data.pieces[id]?.nation === "su" && data.pieces[id]?.size === "lcu")
	game.turn = 3
	game.pieces[front] = moscow
	game.control[moscow] = "allied"
	game.action = {
		move_spaces: [moscow],
		moved: [],
		entrenching: [],
		activation_supply: { [front]: "oos" },
	}

	assert.equal(Engine.map.canEntrench(game, data, adjacency, front), false)
	game.action.activation_supply[front] = "full"
	assert.equal(Engine.map.canEntrench(game, data, adjacency, front), true)
})

test("Stand Fast exits charge VP unless the first destination is enemy-controlled", () => {
	const makeGame = () => Engine.setup.createInitialState(data, "Campaign", 3, {})
	const origin = space("Bialystok")
	const pieceId = Engine.map.friendlyPiecesInSpace(makeGame(), data, "allied", origin)[0]

	let game = makeGame()
	let paths = Engine.map.legalMovePaths(game, data, adjacency, pieceId)
	let [destination, path] = paths.entries().next().value
	game.stand_fast[origin] = "stalin"
	Engine.map.movePieceAlongPath(game, data, pieceId, path)
	assert.equal(game.vp, 8)
	assert.equal(game.stand_fast[origin], undefined)
	assert.equal(game.pieces[pieceId], destination)
	assert.equal(standFastPayments(game).length, 1)
	assert.deepEqual(standFastPayments(game)[0].params, {
		order: { key: "ui.order.stalin_orders", params: {} },
		space: `s${origin}`,
		cost: 1,
		delta: "+1",
		vp: 8,
	})
	assert.ok(renderLog(game).includes(`在s${origin}忽略斯大林命令：支付1 VP，轴心国VP+1，当前8。`))
	assert.ok(renderLog(game, "en").includes(`Ignoring Stalin Orders at s${origin} costs 1 VP: Axis VP +1; now 8.`))

	game = makeGame()
	paths = Engine.map.legalMovePaths(game, data, adjacency, pieceId)
	;[destination, path] = paths.entries().next().value
	game.stand_fast[origin] = "stalin"
	game.control[path[0]] = "axis"
	Engine.map.movePieceAlongPath(game, data, pieceId, path)
	assert.equal(game.vp, 7)
	assert.equal(game.stand_fast[origin], undefined)
	assert.deepEqual(standFastPayments(game), [])
})

test("Stand Fast ignores later arrivals until the next Action Round snapshot", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 33, {})
	const origin = space("Bialystok")
	const [arrivalSource, laterExit, subjectExit] = adjacency[origin]
		.filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && !data.spaces[edge.to]?.vp)
		.slice(0, 3)
		.map((edge) => edge.to)
	const [subject, laterArrival] = data.pieces
		.filter((piece) => piece?.nation === "su" && piece.size === "scu")
		.slice(0, 2)
		.map((piece) => piece.id)
	game.pieces.fill(0)
	game.pieces[subject] = origin
	game.pieces[laterArrival] = arrivalSource
	for (const spaceId of [origin, arrivalSource, laterExit, subjectExit]) game.control[spaceId] = "allied"
	game.stand_fast[origin] = "stalin"
	Engine.turn.startAction(game, "axis", 1)

	assert.deepEqual(game.stand_fast_round_units[origin], [subject])
	Engine.map.movePieceAlongPath(game, data, laterArrival, [origin])
	Engine.map.movePieceAlongPath(game, data, laterArrival, [laterExit])
	assert.equal(game.vp, 7)
	assert.equal(game.stand_fast[origin], "stalin")
	assert.deepEqual(game.stand_fast_round_units[origin], [subject])
	assert.deepEqual(standFastPayments(game), [])

	Engine.map.movePieceAlongPath(game, data, subject, [subjectExit])
	assert.equal(game.vp, 8)
	assert.equal(game.stand_fast[origin], undefined)
	assert.equal(Object.hasOwn(game.stand_fast_round_units, origin), false)
	assert.equal(standFastPayments(game).length, 1)
})

test("a later arrival becomes subject to Stand Fast in the next Action Round", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 34, {})
	const origin = space("Bialystok")
	const [arrivalSource, destination] = adjacency[origin]
		.filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && !data.spaces[edge.to]?.vp)
		.slice(0, 2)
		.map((edge) => edge.to)
	const [original, laterArrival] = data.pieces
		.filter((piece) => piece?.nation === "su" && piece.size === "scu")
		.slice(0, 2)
		.map((piece) => piece.id)
	game.pieces.fill(0)
	game.pieces[original] = origin
	game.pieces[laterArrival] = arrivalSource
	for (const spaceId of [origin, arrivalSource, destination]) game.control[spaceId] = "allied"
	game.stand_fast[origin] = "stalin"
	Engine.turn.startAction(game, "axis", 1)
	Engine.map.movePieceAlongPath(game, data, laterArrival, [origin])
	assert.deepEqual(game.stand_fast_round_units[origin], [original])

	Engine.turn.startAction(game, "axis", 2)
	assert.deepEqual(game.stand_fast_round_units[origin], [original, laterArrival])
	Engine.map.movePieceAlongPath(game, data, laterArrival, [destination])
	assert.equal(game.vp, 8)
	assert.equal(game.stand_fast[origin], undefined)
	assert.equal(standFastPayments(game).length, 1)
})

test("mixed formations charge Stand Fast independently of unit order", () => {
	const origin = space("Bialystok")
	const destination = adjacency[origin].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && !data.spaces[edge.to]?.vp).to
	const pieces = data.pieces
		.filter((piece) => piece?.nation === "su" && piece.size === "scu")
		.slice(0, 2)
		.map((piece) => piece.id)

	for (const formation of [pieces, pieces.slice().reverse()]) {
		const game = Engine.setup.createInitialState(data, "Campaign", 35, {})
		game.pieces.fill(0)
		game.pieces[pieces[0]] = origin
		game.control[origin] = "allied"
		game.control[destination] = "allied"
		game.stand_fast[origin] = "stalin"
		Engine.turn.startAction(game, "axis", 1)
		game.pieces[pieces[1]] = origin

		Engine.map.moveFormationStep(game, data, adjacency, formation, [origin], destination)
		assert.equal(game.vp, 8)
		assert.equal(game.stand_fast[origin], undefined)
		assert.equal(standFastPayments(game).length, 1)
	}
})

test("Hitler Stand Fast charges Axis VP once and logs only paid exits", () => {
	const origin = space("Berlin")
	const destination = adjacency[origin].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && !data.spaces[edge.to]?.vp).to
	const pieceId = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu").id
	const cases = [
		{ name: "paid", destinationControl: "axis", options: {}, expectedVp: 6, expectedLogs: 1 },
		{ name: "enemy-controlled", destinationControl: "allied", options: {}, expectedVp: 7, expectedLogs: 0 },
		{ name: "combat advance", destinationControl: "axis", options: { freeStandFastExit: true }, expectedVp: 7, expectedLogs: 0 },
	]

	for (const scenario of cases) {
		const game = Engine.setup.createInitialState(data, "Campaign", 36, {})
		game.pieces.fill(0)
		game.pieces[pieceId] = origin
		game.control[origin] = "axis"
		game.control[destination] = scenario.destinationControl
		game.stand_fast[origin] = "hitler"
		Engine.turn.startAction(game, "axis", 1)

		Engine.map.movePieceAlongPath(game, data, pieceId, [destination], scenario.options)
		assert.equal(game.vp, scenario.expectedVp, scenario.name)
		assert.equal(game.stand_fast[origin], undefined, scenario.name)
		assert.equal(standFastPayments(game).length, scenario.expectedLogs, scenario.name)
		if (scenario.expectedLogs) {
			assert.deepEqual(standFastPayments(game)[0].params, {
				order: { key: "ui.order.hitler_orders", params: {} },
				space: `s${origin}`,
				cost: 1,
				delta: "-1",
				vp: 6,
			})
		}
	}
})

test("Stand Fast remains after free exits until every unit present at the Action Round start has left", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const origin = space("Bialystok")
	const destinations = adjacency[origin]
		.filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land")
		.slice(0, 2)
		.map((edge) => edge.to)
	const pieces = data.pieces
		.filter((piece) => piece?.nation === "su" && piece.size === "scu")
		.slice(0, 2)
		.map((piece) => piece.id)
	assert.equal(destinations.length, 2)
	game.pieces.fill(0)
	for (const pieceId of pieces) game.pieces[pieceId] = origin
	game.stand_fast[origin] = "stalin"
	for (const destination of destinations) game.control[destination] = "axis"
	Engine.turn.startAction(game, "axis", 1)

	assert.deepEqual(game.stand_fast_round_units[origin], pieces)
	Engine.map.movePieceAlongPath(game, data, pieces[0], [destinations[0]])
	assert.equal(game.vp, 7)
	assert.equal(game.stand_fast[origin], "stalin")
	Engine.map.movePieceAlongPath(game, data, pieces[1], [destinations[1]])
	assert.equal(game.vp, 7)
	assert.equal(game.stand_fast[origin], undefined)
})

test("combat advance exits a Stand Fast space without paying VP", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 3, {})
	const origin = space("Bialystok")
	const destination = adjacency[origin].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").to
	const pieceId = data.pieces.find((piece) => piece?.side === "allied" && piece.size === "scu").id
	game.pieces.fill(0)
	game.pieces[pieceId] = origin
	game.stand_fast[origin] = "stalin"
	game.control[destination] = "allied"
	Engine.turn.startAction(game, "axis", 1)

	Engine.map.movePieceAlongPath(game, data, pieceId, [destination], {
		freeStandFastExit: true,
	})
	assert.equal(game.vp, 7)
	assert.equal(game.stand_fast[origin], undefined)
})
