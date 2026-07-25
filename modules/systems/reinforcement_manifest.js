"use strict"

function cardPieceSlots(data, cardId) {
	if (!Number.isInteger(Number(cardId))) return []
	return (data.reinforcement_board?.slots || []).filter((slot) => slot.card_ids.includes(Number(cardId)))
}

function piecesForCard(data, cardId, matchesIdentity) {
	const assigned = cardPieceSlots(data, cardId)
		.map((slot) => data.pieces[slot.piece_id])
		.filter((piece) => piece && matchesIdentity(piece))
	return assigned.length ? assigned : data.pieces.filter((piece) => piece && matchesIdentity(piece))
}

module.exports = {
	cardPieceSlots,
	piecesForCard,
}
