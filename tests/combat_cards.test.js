"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const rules = require("../rules.js")
const Engine = require("../modules/engine.js")
const { data } = require("../data.js")

const fullSupplyMap = { traceSupply: () => "full" }
const noAdjacency = []

function pieceId(nation, mechanized) {
	const piece = data.pieces.find((candidate) => {
		if (!candidate || candidate.nation !== nation) return false
		const allowance = Number(candidate.mf) || 0
		return mechanized ? allowance >= 4 : allowance < 4
	})
	if (!piece) throw new Error(`missing ${nation} test piece`)
	return piece.id
}

function combatGame(attackerSide, attacker, defender, target) {
	const game = rules.setup(41, "Campaign", {})
	game.pieces.fill(0)
	game.reduced = []
	game.pieces[attacker] = 1
	game.pieces[defender] = target
	game.turn = 8
	game.action_round = 3
	game.combat = {
		origin_spaces: [1],
		defender_space: target,
		attackers: [attacker],
		defenders: [defender],
		retreated_defenders: [],
		attacker_side: attackerSide,
		defender_side: attackerSide === "axis" ? "allied" : "axis",
		cc_played: { allied: [], axis: [] },
		cc_from_hand: { allied: [], axis: [] },
	}
	return game
}

test("all fifteen combat cards use their printed formation, posture, and terrain conditions", () => {
	const suMech = pieceId("su", true)
	const geMech = pieceId("ge", true)
	const desert = data.spaces.find((space) => space?.terrain === "desert").id
	const italy = data.spaces.find((space) => space?.nation === "it").id
	const germany = data.spaces.find((space) => space?.nation === "ge").id

	let game = combatGame("allied", suMech, geMech, desert)
	game.hands.allied = [8, 10, 17, 18, 20]
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "allied"), [17, 18, 20])

	game = combatGame("axis", geMech, suMech, desert)
	game.hands.allied = [8, 10, 17, 18, 20]
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "allied"), [8, 10, 17, 18])

	game = combatGame("axis", geMech, suMech, desert)
	game.hands.axis = [65, 96, 104]
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "axis"), [65, 96, 104])

	game = combatGame("allied", suMech, geMech, desert)
	game.hands.axis = [65, 73, 96, 97, 98, 102, 103]
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "axis"), [65, 73, 96, 97, 98, 102, 103])

	game = combatGame("allied", suMech, geMech, italy)
	game.hands.axis = [85]
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "axis"), [85])

	game = combatGame("allied", suMech, geMech, germany)
	game.hands.axis = [99]
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "axis"), [99])
})

test("OOS defenders receive no combat cards and usage limits cover an action round and Paradrop's turn", () => {
	const suMech = pieceId("su", true)
	const geMech = pieceId("ge", true)
	const desert = data.spaces.find((space) => space?.terrain === "desert").id
	const game = combatGame("axis", geMech, suMech, desert)
	game.hands.allied = [8, 10, 17, 18, 20]
	assert.deepEqual(Engine.combatCards.available(game, data, { traceSupply: () => "oos" }, noAdjacency, game.combat, "allied"), [])
	game.combat.attacker_side = "allied"
	game.combat.defender_side = "axis"
	game.combat.attackers = [suMech]
	game.combat.defenders = [geMech]
	Engine.combatCards.play(game, data, "allied", 20)
	assert.equal(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "allied").includes(20), false)
	game.action_round++
	game.hands.allied.push(20)
	assert.equal(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "allied").includes(20), false)
})

test("Winter 42 removes German mechanized combat-card eligibility in the USSR unless VPP was played", () => {
	const suMech = pieceId("su", true)
	const geMech = pieceId("ge", true)
	const sovietSpace = data.spaces.find((space) => space?.nation === "su" && space.kind === "land").id
	const game = combatGame("allied", suMech, geMech, sovietSpace)
	game.turn = 4
	game.hands.axis = [96, 97, 102]
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "axis"), [102])
	game.events.von_paulus_pause = true
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "axis"), [96, 97, 102])
})

test("previously retreated defenders remain eligible for formation-based combat cards", () => {
	const suMech = pieceId("su", true)
	const geMech = pieceId("ge", true)
	const desert = data.spaces.find((space) => space?.terrain === "desert").id
	const game = combatGame("axis", geMech, suMech, desert)
	game.combat.retreated_defenders = [suMech]
	game.combat.defenders = []
	game.hands.allied = [8, 10, 17, 18]
	assert.deepEqual(Engine.combatCards.available(game, data, fullSupplyMap, noAdjacency, game.combat, "allied"), [8, 10, 17, 18])
})

test("combat-card prompts mark an empty legal choice set", () => {
	const suMech = pieceId("su", true)
	const geMech = pieceId("ge", true)
	const desert = data.spaces.find((space) => space?.terrain === "desert").id
	const game = combatGame("axis", geMech, suMech, desert)

	game.hands.axis = []
	game.active = "Axis"
	game.state = "combat_attacker_cc"
	assert.equal(rules.view(game, "Axis").prompt, "进攻方：打出战斗卡（无）。")

	game.hands.allied = []
	game.active = "Allied"
	game.state = "combat_defender_cc"
	assert.equal(rules.view(game, "Allied").prompt, "防守方：打出战斗卡（无）。")

	game.hands.axis = [65, 96, 104]
	game.active = "Axis"
	game.state = "combat_attacker_cc"
	assert.equal(rules.view(game, "Axis").prompt, "进攻方：打出战斗卡。")
})

test("combat card DRMs, Devil's Gardens, Panzerfaust, retention, discard, and removal are deterministic", () => {
	const suMech = pieceId("su", true)
	const geMech = pieceId("ge", true)
	const desert = data.spaces.find((space) => space?.terrain === "desert").id
	const game = combatGame("allied", suMech, geMech, desert)
	game.hands.allied = [17, 18]
	game.hands.axis = [73, 98, 102]
	for (const cardId of [17, 18]) Engine.combatCards.play(game, data, "allied", cardId)
	for (const cardId of [73, 98, 102]) Engine.combatCards.play(game, data, "axis", cardId)
	assert.equal(Engine.combatCards.drm(game.combat, "allied"), 2)
	assert.equal(Engine.combatCards.drm(game.combat, "axis"), 1)
	assert.equal(Engine.combatCards.attackerTerrainShift(game.combat), -1)
	assert.deepEqual(Engine.combatCards.panzerfaustTargets(game, data, game.combat), [suMech])

	game.combat.defender_loss = 2
	game.combat.attacker_loss = 1
	Engine.combatCards.finalize(game, data, game.combat)
	assert.deepEqual(
		game.combat_cards.allied.sort((a, b) => a - b),
		[17, 18],
	)
	assert.ok(game.discards.axis.includes(102))
	assert.ok(game.removed.axis.includes(73))
	assert.ok(game.removed.axis.includes(98))
	Engine.combatCards.discardAtEndOfTurn(game)
	assert.deepEqual(game.combat_cards.allied, [])
	assert.ok(game.discards.allied.includes(17))
	assert.ok(game.discards.allied.includes(18))
})

test("current games normalize additive combat-card containers", () => {
	const game = rules.setup(43, "Campaign", {})
	delete game.combat_cards
	delete game.combat_card_usage
	const normalized = rules.normalize_game(game)
	assert.deepEqual(normalized.combat_cards, { allied: [], axis: [] })
	assert.deepEqual(normalized.combat_card_usage, { allied: [], axis: [] })
	assert.equal(normalized.schema_version, 5)
	assert.equal(normalized.data_version, 1)
	assert.equal(normalized.ruleset_version, 1)
})
