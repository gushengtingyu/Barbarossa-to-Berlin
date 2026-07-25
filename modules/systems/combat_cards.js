"use strict"

const { ALLIED, AXIS, otherSide } = require("../core/constants.js")
const { clearUndo, log } = require("../core/state.js")
const Neutrals = require("./neutrals.js")
const Weather = require("./weather.js")

const CARDS = Object.freeze({
	8: { name: "筑垒盒式阵地", drm: "defender" },
	10: { name: "内务人民委员部鼓舞士气", drm: "defender" },
	17: { name: "朱可夫", drm: "both" },
	18: { name: "T-34", drm: "both" },
	20: { name: "空降", drm: "attacker", oncePerTurn: true },
	65: { name: "沙漠之狐", drm: "both" },
	73: { name: "魔鬼花园", terrain: true },
	85: { name: "凯塞林", drm: "defender" },
	96: { name: "黑豹", drm: "both" },
	97: { name: "虎式", drm: "defender" },
	98: { name: "铁拳", preLoss: true },
	99: { name: "国民突击队", drm: "defender" },
	102: { name: "莫德尔", drm: "defender" },
	103: { name: "海因里希", drm: "defender" },
	104: { name: "魏克斯", drm: "attacker" },
})

function isMechanized(game, data, pieceId) {
	const piece = data.pieces[pieceId]
	const allowance = Number(game.reduced.includes(pieceId) ? piece?.rmf : piece?.mf) || 0
	return allowance >= 4 && game.action?.activation_supply?.[pieceId] !== "oos" && !Weather.isGermanInSovietUnion(game, data, pieceId)
}

function participants(combat, side) {
	if (side === combat.attacker_side) return combat.attackers
	return [...new Set((combat.defenders || []).concat(combat.retreated_defenders || []))]
}

function isAttacker(combat, side) {
	return side === combat.attacker_side
}

function hasNation(data, pieces, nation) {
	return pieces.some((pieceId) => data.pieces[pieceId]?.nation === nation)
}

function hasMechanizedNation(game, data, pieces, nation) {
	return pieces.some((pieceId) => data.pieces[pieceId]?.nation === nation && isMechanized(game, data, pieceId))
}

function defenderIsOos(game, data, map, adjacency, combat) {
	return participants(combat, combat.defender_side).some((pieceId) => {
		const piece = data.pieces[pieceId]
		if (typeof map.pieceSupplyStatus === "function") return map.pieceSupplyStatus(game, data, adjacency, pieceId, "defense", game.pieces[pieceId]) === "oos"
		const side = typeof map.pieceSide === "function" ? map.pieceSide(game, data, pieceId) : Neutrals.effectivePieceSide(game, piece)
		return map.traceSupply(game, data, adjacency, side, game.pieces[pieceId], piece.nation) === "oos"
	})
}

function usedThisRound(game, side, cardId) {
	return game.combat_card_usage[side].some((entry) => entry.card_id === cardId && entry.turn === game.turn && entry.round === game.action_round)
}

function usedThisTurn(game, side, cardId) {
	return game.combat_card_usage[side].some((entry) => entry.card_id === cardId && entry.turn === game.turn)
}

function eligible(game, data, map, adjacency, combat, side, cardId) {
	const card = data.cards[cardId]
	if (!CARDS[cardId] || !card?.cc || card.side !== side) return false
	if (usedThisRound(game, side, cardId)) return false
	if (CARDS[cardId].oncePerTurn && usedThisTurn(game, side, cardId)) return false
	const attacking = isAttacker(combat, side)
	if (!attacking && defenderIsOos(game, data, map, adjacency, combat)) return false
	const units = participants(combat, side).filter((pieceId) => Number.isInteger(game.pieces[pieceId]) && game.pieces[pieceId] > 0)
	const enemies = participants(combat, otherSide(side)).filter((pieceId) => Number.isInteger(game.pieces[pieceId]) && game.pieces[pieceId] > 0)
	if (!units.length) return false
	const space = data.spaces[combat.defender_space]
	switch (cardId) {
		case 8:
			return !attacking && space?.terrain === "desert"
		case 10:
			return !attacking && hasNation(data, units, "su")
		case 17:
			return hasNation(data, units, "su")
		case 18:
			return hasMechanizedNation(game, data, units, "su")
		case 20:
			return attacking
		case 65:
			return space?.terrain === "desert" && hasMechanizedNation(game, data, units, "ge")
		case 73:
			return !attacking && space?.terrain === "desert"
		case 85:
			return !attacking && space?.nation === "it" && hasNation(data, units, "ge")
		case 96:
			return hasMechanizedNation(game, data, units, "ge")
		case 97:
			return !attacking && hasMechanizedNation(game, data, units, "ge")
		case 98:
			return !attacking && hasMechanizedNation(game, data, enemies, "su")
		case 99:
			return !attacking && space?.nation === "ge"
		case 102:
			return !attacking && hasNation(data, units, "ge")
		case 103:
			return !attacking && hasNation(data, units, "ge") && hasNation(data, enemies, "su")
		case 104:
			return attacking && hasNation(data, units, "ge") && hasNation(data, enemies, "su")
		default:
			return false
	}
}

function available(game, data, map, adjacency, combat, side) {
	const candidates = game.hands[side].concat(game.combat_cards[side])
	return [...new Set(candidates)].filter((cardId) => eligible(game, data, map, adjacency, combat, side, cardId))
}

function play(game, data, side, cardId) {
	cardId = Number(cardId)
	const fromHand = game.hands[side].includes(cardId)
	if (fromHand) game.hands[side].splice(game.hands[side].indexOf(cardId), 1)
	game.combat.cc_played[side].push(cardId)
	if (fromHand) game.combat.cc_from_hand[side].push(cardId)
	game.combat_card_usage[side].push({
		card_id: cardId,
		turn: game.turn,
		round: game.action_round,
	})
	clearUndo(game)
	log(
		game,
		"combat.log.card_played",
		{
			role: side === game.combat.attacker_side ? { "zh-CN": "进攻方", en: "Attacker" } : { "zh-CN": "防守方", en: "Defender" },
			card: `c${cardId}`,
		},
		"detail2",
	)
}

function played(combat, side, cardId) {
	return combat.cc_played?.[side]?.includes(cardId) || false
}

function drm(combat, side) {
	const position = isAttacker(combat, side) ? "attacker" : "defender"
	return (combat.cc_played?.[side] || []).reduce((sum, cardId) => {
		const effect = CARDS[cardId]?.drm
		return sum + (effect === "both" || effect === position ? 1 : 0)
	}, 0)
}

function attackerTerrainShift(combat) {
	return played(combat, combat.defender_side, 73) ? -1 : 0
}

function panzerfaustTargets(game, data, combat) {
	if (!played(combat, AXIS, 98)) return []
	return combat.attackers.filter((pieceId) => Number.isInteger(game.pieces[pieceId]) && game.pieces[pieceId] > 0 && data.pieces[pieceId]?.nation === "su" && isMechanized(game, data, pieceId))
}

function finalize(game, data, combat) {
	const winningSide = combat.defender_loss > combat.attacker_loss ? combat.attacker_side : combat.attacker_loss > combat.defender_loss ? combat.defender_side : null
	for (const side of [ALLIED, AXIS]) {
		for (const cardId of combat.cc_played?.[side] || []) {
			const retainedIndex = game.combat_cards[side].indexOf(cardId)
			if (data.cards[cardId]?.remove) {
				if (retainedIndex >= 0) game.combat_cards[side].splice(retainedIndex, 1)
				if (!game.removed[side].includes(cardId)) game.removed[side].push(cardId)
			} else if (side === winningSide) {
				if (retainedIndex < 0) game.combat_cards[side].push(cardId)
			} else {
				if (retainedIndex >= 0) game.combat_cards[side].splice(retainedIndex, 1)
				if (!game.discards[side].includes(cardId)) game.discards[side].push(cardId)
			}
		}
	}
}

function discardAtEndOfTurn(game) {
	game.combat_cards ||= { [ALLIED]: [], [AXIS]: [] }
	for (const side of [ALLIED, AXIS]) {
		game.combat_cards[side] ||= []
		for (const cardId of game.combat_cards[side]) if (!game.discards[side].includes(cardId)) game.discards[side].push(cardId)
		game.combat_cards[side] = []
	}
}

module.exports = {
	CARDS,
	attackerTerrainShift,
	available,
	discardAtEndOfTurn,
	drm,
	eligible,
	finalize,
	isMechanized,
	panzerfaustTargets,
	play,
	played,
}
