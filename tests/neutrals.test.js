"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog } = require("./i18n_helpers.js")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine
const adjacency = Engine.map.buildAdjacency(data)

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

function piece(nation, size, name = null) {
	return data.pieces.find((entry) => entry?.nation === nation && entry.size === size && (!name || entry.name === name)).id
}

test("Rule 17.3 blocks Vichy territory until activation and enables the two Axis SR exceptions", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 17, {})
	const german = piece("ge", "scu")
	const italian = piece("it", "scu")
	const marseille = space("Marseille")
	const tunis = space("Tunis")

	assert.equal(Engine.restrictions.mayEnter(game, data, adjacency, german, marseille), false)
	assert.equal(Engine.neutrals.activateVichy(game), true)
	assert.equal(Engine.restrictions.mayEnter(game, data, adjacency, german, marseille), true)
	assert.equal(game.control[marseille], "neutral")

	game.turn = 5
	game.pieces[german] = space("Dijon")
	game.pieces[italian] = space("Syracuse")
	assert.deepEqual(Engine.map.legalSrPaths(game, data, adjacency, german).get(marseille), [space("Lyon"), marseille])
	assert.deepEqual(Engine.map.legalSrPaths(game, data, adjacency, italian).get(tunis), [space("SeaSR Malta"), tunis])
	Engine.map.movePieceAlongPath(game, data, german, [space("Lyon"), marseille])
	assert.equal(game.control[space("Lyon")], "axis")
	assert.equal(game.control[marseille], "axis")
	assert.equal(game.vp, 8)
	assert.match(renderLog(game).at(-1), new RegExp(`s${marseille}.*VP\\+1`))
})

test("Axis declaration of war on Turkey applies the pre-Casablanca penalty and gives deployment control to Allied", () => {
	let game = rules.setup(19, "Campaign", {})
	game.state = "action_select"
	game.phase = "action"
	game.active = "Axis"
	game.action_round = 2

	assert.equal(rules.view(game, "Axis").actions.declare_turkey, 1)
	game = rules.action(game, "Axis", "declare_turkey")
	assert.equal(game.vp, 4)
	assert.equal(game.state, "neutral_deployment")
	assert.equal(game.active, "Allied")
	assert.equal(game.neutrals.tu.controller, "allied")
	assert.equal(Engine.map.pieceSide(game, data, piece("tu", "lcu", "TU 1 Army")), "allied")
	assert.equal(game.pieces[piece("tu", "scu")], "setup_choice:turkey")
	assert.equal(data.pieces.filter((entry) => entry?.nation === "tu" && game.pieces[entry.id] === "reserve:allied").length, 2)

	const deploymentPieces = game.neutral_deployment.pieces.slice()
	for (let deploymentIndex = 0; deploymentIndex < deploymentPieces.length; deploymentIndex++) {
		const actions = rules.view(game, "Allied").actions
		assert.ok(actions.space.length > 0)
		assert.throws(() => rules.action(game, "Allied", "space", space("Stockholm")), /illegal action/)
		game = rules.action(game, "Allied", "space", actions.space[0])
	}
	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Axis")
	assert.equal(
		deploymentPieces.every((pieceId) => data.spaces[game.pieces[pieceId]]?.nation === "tu"),
		true,
	)
	assert.equal(rules.view(game, "Axis").actions.declare_turkey, undefined)
})

test("Sweden is controlled by the non-declaring side, has no deployment choice, and loses Casablanca iron treatment after war", () => {
	let game = rules.setup(23, "Campaign", {})
	game.state = "action_select"
	game.phase = "action"
	game.active = "Allied"
	const neutralIron = Engine.resources.alliedIronCount(game, data, Engine.map)
	game.events.casablanca = true
	assert.equal(Engine.resources.alliedIronCount(game, data, Engine.map), neutralIron + 1)

	game = rules.action(game, "Allied", "declare_sweden")
	assert.equal(game.state, "action_select")
	assert.equal(game.active, "Allied")
	assert.equal(game.neutrals.sw.controller, "axis")
	assert.equal(Engine.map.pieceSide(game, data, piece("sw", "lcu")), "axis")
	assert.equal(game.pieces[piece("sw", "scu")], "reserve:axis")
	assert.equal(Engine.resources.alliedIronCount(game, data, Engine.map), neutralIron)

	const axisGame = Engine.setup.createInitialState(data, "Campaign", 24, {})
	Engine.neutrals.declareWar(axisGame, data, "sw", "axis")
	assert.equal(axisGame.vp, 6)
})

test("Turkish units are always fully supplied at home, cannot leave, and receive two replacement points per turn", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 29, {})
	Engine.neutrals.declareWar(game, data, "tu", "axis")
	const army = piece("tu", "lcu", "TU 1 Army")
	const istanbul = space("Istanbul")
	const ankara = space("Ankara")
	const foreign = adjacency[istanbul].map((edge) => edge.to).find((spaceId) => data.spaces[spaceId]?.nation !== "tu")

	assert.equal(Engine.logistics.supplyStatus(game, data, Engine.map, adjacency, army), "full")
	assert.equal(Engine.restrictions.mayEnter(game, data, adjacency, army, space("Bursa")), true)
	assert.equal(Engine.restrictions.mayEnter(game, data, adjacency, army, foreign), false)
	assert.equal(Engine.neutrals.awardTurkeyRp(game), 2)
	assert.equal(Engine.neutrals.awardTurkeyRp(game), 0)
	assert.equal(game.rp.tu, 2)

	game.pieces[army] = "eliminated:allied"
	Engine.combat.setReduced(game, army, false)
	assert.equal(Engine.logistics.legalReplacementPieces(game, data, Engine.map, adjacency, "allied").includes(army), true)
	assert.deepEqual(
		Engine.logistics
			.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, army)
			.slice()
			.sort((a, b) => a - b),
		[istanbul, ankara].sort((a, b) => a - b),
	)
	const replacement = Engine.logistics.replaceStep(game, data, Engine.map, adjacency, "allied", army)
	assert.equal(replacement.placement_required, true)
	Engine.logistics.placeRebuiltLcu(game, data, Engine.map, adjacency, "allied", army, istanbul)
	assert.equal(game.rp.tu, 1)
	assert.equal(Engine.combat.isReduced(game, army), true)
})

test("Swedish units cannot receive replacements", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 31, {})
	Engine.neutrals.declareWar(game, data, "sw", "axis")
	const swedishUnits = data.pieces.filter((entry) => entry?.nation === "sw").map((entry) => entry.id)
	for (const pieceId of swedishUnits) game.pieces[pieceId] = "eliminated:allied"
	game.rp.axis = 10
	game.rp.ge = 10
	assert.equal(
		Engine.logistics.legalReplacementPieces(game, data, Engine.map, adjacency, "allied").some((pieceId) => swedishUnits.includes(pieceId)),
		false,
	)
})
