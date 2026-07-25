"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { ALLIED, AXIS } = Engine.constants
const { data } = Engine

function card(side, number) {
	return data.cards.find((entry) => entry?.side === side && entry.num === number).id
}

function preparedDrawGame(turn, entryTurn) {
	const game = Engine.setup.createInitialState(data, "Campaign", 211, {})
	const alliedBlitz = Engine.cards.blitzkriegCards(data, ALLIED)
	const axisBlitz = Engine.cards.blitzkriegCards(data, AXIS)
	game.turn = turn
	game.events.us_entry = true
	game.events.us_entry_turn = entryTurn
	game.hands[ALLIED] = [alliedBlitz[0]]
	game.hands[AXIS] = [axisBlitz[0]]
	game.decks[ALLIED] = alliedBlitz.slice(1, -1)
	game.decks[AXIS] = axisBlitz.slice(1, -1)
	game.discards[ALLIED] = [alliedBlitz.at(-1)]
	game.discards[AXIS] = [axisBlitz.at(-1)]
	Engine.turn.startDrawPhase(game)
	return game
}

test("Rules 17.2 and 7.8 record U.S. entry and unlock US Build-Up on the following turn", () => {
	const fdr = card(ALLIED, 6)
	const buildup = card(ALLIED, 9)
	const hitler = card(AXIS, 8)
	const allied = Engine.setup.createInitialState(data, "Campaign", 201, {})
	allied.turn = 2
	assert.equal(Engine.events.canPlayEvent(allied, data, fdr), false)
	allied.turn = 3
	assert.equal(Engine.events.canPlayEvent(allied, data, fdr), true)
	Engine.events.playEvent(allied, data, fdr)
	assert.equal(allied.events.us_entry, true)
	assert.equal(allied.events.us_entry_turn, 3)
	assert.equal(allied.events.us_entry_source, fdr)
	assert.equal(Engine.events.canPlayEvent(allied, data, buildup), false)
	allied.turn = 4
	assert.equal(Engine.events.canPlayEvent(allied, data, buildup), true)
	Engine.events.playEvent(allied, data, buildup)
	assert.equal(allied.events.us_buildup, true)

	const axis = Engine.setup.createInitialState(data, "Campaign", 203, {})
	axis.turn = 3
	axis.vp = 7
	Engine.events.playEvent(axis, data, hitler)
	assert.equal(axis.events.us_entry, true)
	assert.equal(axis.events.us_entry_turn, 3)
	assert.equal(axis.events.us_entry_source, hitler)
	assert.equal(axis.vp, 8)
})

test("Rule 7.8 adds both Total War decks three turns after U.S. entry with both optional hand picks", () => {
	let game = preparedDrawGame(6, 3)
	game = rules.action(game, "Allied", "continue")
	game = rules.action(game, "Axis", "continue")
	assert.equal(game.state, "total_war_allied_pick")
	assert.equal(game.active, "Allied")

	const alliedChoice = rules.view(game, "Allied").actions.card[0]
	assert.equal(data.cards[alliedChoice].deck, "blitzkrieg")
	game = rules.action(game, "Allied", "card", alliedChoice)
	assert.equal(game.state, "total_war_axis_pick")
	assert.equal(game.active, "Axis")

	const totalerKrieg = card(AXIS, 26)
	assert.deepEqual(rules.view(game, "Axis").actions.card, [totalerKrieg])
	game = rules.action(game, "Axis", "card", totalerKrieg)

	assert.equal(game.events.total_war_decks, true)
	assert.equal(game.state, "end_voluntary_elimination")
	assert.equal(game.active, "Allied")
	assert.equal(game.hands[ALLIED].includes(alliedChoice), true)
	assert.equal(game.hands[AXIS].includes(totalerKrieg), true)
	assert.equal(game.hands[ALLIED].length, Engine.turn.handLimit(game, ALLIED))
	assert.equal(game.hands[AXIS].length, Engine.turn.handLimit(game, AXIS))
	assert.deepEqual(game.discards, { [ALLIED]: [], [AXIS]: [] })

	for (const side of [ALLIED, AXIS]) {
		const cards = game.hands[side].concat(game.decks[side], game.removed[side])
		assert.equal(new Set(cards).size, 55)
		assert.equal(cards.length, 55)
		assert.equal(
			Engine.cards.totalWarCards(data, side).every((cardId) => cards.includes(cardId)),
			true,
		)
	}
})

test("Rule 7.8 does not add Total War cards before the third post-entry draw phase", () => {
	let game = preparedDrawGame(5, 3)
	game = rules.action(game, "Allied", "continue")
	game = rules.action(game, "Axis", "continue")
	assert.equal(game.state, "end_voluntary_elimination")
	assert.equal(game.events.total_war_decks, undefined)
	for (const side of [ALLIED, AXIS])
		assert.equal(
			Engine.cards.totalWarCards(data, side).some((cardId) => game.decks[side].includes(cardId) || game.hands[side].includes(cardId)),
			false,
		)
})
