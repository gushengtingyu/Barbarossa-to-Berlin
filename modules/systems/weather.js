"use strict"

function isSpringTurn(turn) {
	return [5, 9, 13, 17].includes(Number(turn))
}

function isSummerTurn(turn) {
	return [2, 6, 10, 14, 18].includes(Number(turn))
}

function isSpringThaw(game) {
	return isSpringTurn(game.turn) && [1, 2].includes(game.action_round)
}

function canPlayOpsCard(game) {
	return !isSpringThaw(game)
}

function isWinter42(game) {
	return game.turn === 4 && !game.events?.von_paulus_pause && !game.events?.cancel_winter_42
}

function isGermanInSovietUnion(game, data, pieceId) {
	const piece = data.pieces[pieceId]
	const location = game.pieces[pieceId]
	return isWinter42(game) && piece?.nation === "ge" && Number.isInteger(location) && data.spaces[location]?.nation === "su"
}

function formationIsWinter42German(game, data, pieceIds) {
	return pieceIds.length > 0 && pieceIds.every((pieceId) => isGermanInSovietUnion(game, data, pieceId))
}

module.exports = {
	canPlayOpsCard,
	formationIsWinter42German,
	isGermanInSovietUnion,
	isSpringThaw,
	isSpringTurn,
	isSummerTurn,
	isWinter42,
}
