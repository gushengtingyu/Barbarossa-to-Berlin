"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
const { clearUndo } = require("../core/state.js")
const { shuffle } = require("../core/random.js")

function findCard(data, side, number) {
	return data.cards.find((card) => card?.side === side && card.num === number)?.id
}

function blitzkriegCards(data, side) {
	return data.cards.filter((card) => card?.side === side && card.deck === "blitzkrieg").map((card) => card.id)
}

function totalWarCards(data, side) {
	return data.cards.filter((card) => card?.side === side && card.deck === "total_war").map((card) => card.id)
}

function totalWarDue(game) {
	const entryTurn = Number(game.events?.us_entry_turn) || 0
	return entryTurn > 0 && !game.events.total_war_decks && game.turn >= entryTurn + 3
}

function alliedTotalWarChoices(game, data) {
	const candidates = game.decks[ALLIED].concat(game.discards[ALLIED])
	return [...new Set(candidates)].filter((cardId) => data.cards[cardId]?.deck === "blitzkrieg")
}

function removeFromPile(pile, cardId) {
	const index = pile.indexOf(cardId)
	if (index < 0) return false
	pile.splice(index, 1)
	return true
}

function takeAlliedTotalWarCard(game, data, cardId) {
	cardId = Number(cardId)
	if (!alliedTotalWarChoices(game, data).includes(cardId)) throw new Error(`invalid Allied Total War hand card: ${cardId}`)
	if (!removeFromPile(game.decks[ALLIED], cardId)) removeFromPile(game.discards[ALLIED], cardId)
	game.hands[ALLIED].push(cardId)
	game.total_war_allied_pick = cardId
	return cardId
}

function totalerKriegCard(data) {
	return findCard(data, AXIS, 26)
}

function takeTotalerKrieg(game, data) {
	const cardId = totalerKriegCard(data)
	if (!cardId || game.hands[AXIS].includes(cardId) || game.removed[AXIS].includes(cardId)) throw new Error("Totaler Krieg is unavailable")
	game.hands[AXIS].push(cardId)
	game.total_war_axis_pick = cardId
	return cardId
}

function addTotalWarDecks(game, data) {
	if (game.events.total_war_decks) return false
	for (const side of [ALLIED, AXIS]) {
		const excluded = new Set(game.hands[side].concat(game.removed[side]))
		const pool = game.decks[side].concat(game.discards[side], totalWarCards(data, side))
		game.decks[side] = [...new Set(pool)].filter((cardId) => !excluded.has(cardId))
		game.discards[side] = []
		shuffle(game, game.decks[side])
	}
	game.events.total_war_decks = true
	clearUndo(game)
	return true
}

function createInitialDecks(game, data, axisOpeningCard) {
	const otherOpeningCard = findCard(data, AXIS, axisOpeningCard === findCard(data, AXIS, 1) ? 2 : 1)
	game.decks[AXIS] = blitzkriegCards(data, AXIS).filter((cardId) => cardId !== axisOpeningCard)
	game.decks[ALLIED] = blitzkriegCards(data, ALLIED)
	shuffle(game, game.decks[AXIS])
	shuffle(game, game.decks[ALLIED])
	game.hands[AXIS] = [axisOpeningCard]
	game.hands[ALLIED] = []
	drawTo(game, AXIS, 7)
	drawTo(game, ALLIED, 7)
	if (!game.decks[AXIS].includes(otherOpeningCard) && !game.hands[AXIS].includes(otherOpeningCard)) throw new Error("unchosen Axis opening card was lost")
	clearUndo(game)
}

function drawTo(game, side, size, reshuffleDiscards = false) {
	while (game.hands[side].length < size) {
		if (!game.decks[side].length) {
			if (!reshuffleDiscards || !game.discards[side].length) break
			game.decks[side] = game.discards[side].splice(0)
			shuffle(game, game.decks[side])
		}
		game.hands[side].push(game.decks[side].pop())
	}
}

function removeFromHand(game, side, cardId) {
	const index = game.hands[side].indexOf(cardId)
	if (index < 0) throw new Error(`card ${cardId} is not in ${side} hand`)
	game.hands[side].splice(index, 1)
}

function discard(game, data, side, cardId, asEvent = false) {
	removeFromHand(game, side, cardId)
	if (asEvent && data.cards[cardId]?.remove) game.removed[side].push(cardId)
	else game.discards[side].push(cardId)
}

function cardOps(data, cardId) {
	return Number(data.cards[cardId]?.ops) || 1
}

function axisRpCardLimit(turn) {
	if (turn >= 12) return 1
	if (turn >= 8) return 2
	return Infinity
}

function canPlayRpCard(game, side) {
	if (game.turn === 1) return false
	const history = game.action_history?.[side] || []
	if (history.at(-1) === "rp") return false
	if (side === AXIS && history.filter((mode) => mode === "rp").length >= axisRpCardLimit(game.turn)) return false
	return true
}

function replacementPointsForCard(game, data, side, cardId) {
	const card = data.cards[cardId]
	if (!card || card.side !== side) throw new Error(`card ${cardId} does not belong to ${side}`)
	if (side === AXIS) return { ge: Number(card.rp_ge) || 0, axis: Number(card.rp_axis) || 0 }
	let su = Number(card.rp_su) || 0
	const moscow = data.spaces.find((space) => space?.name === "Moscow")?.id
	if (game.control[moscow] === AXIS || game.stalin_location !== moscow) su = Math.max(0, su - 1)
	return {
		br: Number(card.rp_br) || 0,
		usa: game.events.us_entry ? Number(card.rp_usa) || 0 : 0,
		su,
	}
}

function applyReplacementCard(game, data, side, cardId) {
	const points = replacementPointsForCard(game, data, side, cardId)
	for (const [bucket, value] of Object.entries(points)) game.rp[bucket] += value
	return points
}

function hasAlliedInitialReinforcement(game, data) {
	return [2, 24].some((number) => game.hands[ALLIED].includes(findCard(data, ALLIED, number)))
}

module.exports = {
	addTotalWarDecks,
	alliedTotalWarChoices,
	blitzkriegCards,
	applyReplacementCard,
	axisRpCardLimit,
	canPlayRpCard,
	cardOps,
	createInitialDecks,
	discard,
	drawTo,
	findCard,
	hasAlliedInitialReinforcement,
	replacementPointsForCard,
	removeFromHand,
	takeAlliedTotalWarCard,
	takeTotalerKrieg,
	totalerKriegCard,
	totalWarCards,
	totalWarDue,
}
