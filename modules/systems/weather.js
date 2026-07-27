"use strict"

function seasonForTurn(turn) {
	turn = Number(turn)
	if (turn === 1) return "spring"
	if (!Number.isInteger(turn) || turn < 2 || turn > 18) return null
	return ["winter", "spring", "summer", "fall"][turn % 4]
}

function isSpringTurn(turn) {
	return seasonForTurn(turn) === "spring"
}

function isSummerTurn(turn) {
	return seasonForTurn(turn) === "summer"
}

function isFallTurn(turn) {
	return seasonForTurn(turn) === "fall"
}

function isWinterTurn(turn) {
	return seasonForTurn(turn) === "winter"
}

function isSpringThaw(game) {
	return Number(game.turn) !== 1 && isSpringTurn(game.turn) && [1, 2].includes(game.action_round)
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
	isFallTurn,
	isGermanInSovietUnion,
	isSpringThaw,
	isSpringTurn,
	isSummerTurn,
	isWinterTurn,
	isWinter42,
	seasonForTurn,
}
