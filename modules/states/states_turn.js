"use strict"

const Runtime = require("../runtime.js")
const I18n = require("../core/i18n.js")
const { playEventCard } = require("./states_action.js")
const Engine = Object.freeze({
	constants: require("../core/constants.js"),
	state: require("../core/state.js"),
	collaboration: require("../systems/collaboration.js"),
	cards: require("../systems/cards.js"),
	invasions: require("../systems/invasions.js"),
	logistics: require("../systems/logistics.js"),
	map: require("../systems/map.js"),
	neutrals: require("../systems/neutrals.js"),
	orders: require("../systems/orders.js"),
	replacements: require("../systems/replacements.js"),
	turn: Runtime.turn,
})

const { ALLIED, AXIS, roleForSide } = Engine.constants

const ORDER_RESULT_LABELS = Object.freeze({
	none: "无命令",
	okw_mo: "OKW强制攻势",
	hitler_orders: "希特勒命令",
	allied_mo: "西方盟军强制攻势",
	soviet_mo: "苏军强制攻势",
	stalin_orders: "斯大林命令",
})
const ORDER_RESULT_LABELS_EN = Object.freeze({
	none: "No Orders",
	okw_mo: "OKW Mandated Offensive",
	hitler_orders: "Hitler Orders",
	allied_mo: "Western Allied Mandated Offensive",
	soviet_mo: "Soviet Mandated Offensive",
	stalin_orders: "Stalin Orders",
})

function logOrderRoll(game, side, roll) {
	Engine.state.log(game, "turn.log.order_roll", {
		side: side === AXIS ? { "zh-CN": "轴心国", en: "Axis" } : { "zh-CN": "盟军", en: "Allied" },
		die: Engine.state.formatDie(side, roll.die),
		result: { "zh-CN": ORDER_RESULT_LABELS[roll.result], en: ORDER_RESULT_LABELS_EN[roll.result] },
	})
}

function logAttritionResult(game, resolved, capturingSide) {
	for (const pieceId of resolved.eliminated) Engine.state.log(game, "turn.log.attrition_eliminated", { piece: Engine.state.pieceLogRef(game, pieceId, resolved.eliminatedReduced.includes(pieceId)) })
	for (const spaceId of resolved.changedControl)
		Engine.state.log(game, "turn.log.attrition_control", {
			space: `s${spaceId}`,
			side: capturingSide === ALLIED ? { "zh-CN": "盟军", en: "Allied" } : { "zh-CN": "轴心国", en: "Axis" },
		})
	for (const pieceId of resolved.released) Engine.state.log(game, "turn.log.attrition_released", { piece: Engine.state.pieceLogRef(game, pieceId) })
}

function startAxisTurnOne(game) {
	game.phase = "action"
	game.action_round = 6
	game.orders = {
		axis: { result: "none", fulfilled: true },
		allied: { result: "stalin_orders", fulfilled: true },
		placing: "stalin",
		placements: [],
	}
	game.state = "turn1_stalin_orders"
	game.active = roleForSide(AXIS)
	Engine.state.log(game, "turn.log.place_initial_orders")
}

function ensureTurnOneStandFastSnapshot(game, data) {
	const missingSnapshot = Object.keys(game.stand_fast || {}).some((spaceId) => !Array.isArray(game.stand_fast_round_units?.[spaceId]))
	if (missingSnapshot) Engine.orders.recordStandFastUnits(game, data)
}

function finishAlliedMulligan(game, data, keepCardId = null) {
	for (const cardId of game.hands[ALLIED].slice()) if (cardId !== keepCardId) Engine.cards.discard(game, data, ALLIED, cardId)
	Engine.cards.drawTo(game, ALLIED, 7)
	delete game.mulligan_keep
	if (Engine.cards.hasAlliedInitialReinforcement(game, data)) startAxisTurnOne(game)
	else game.state = "allied_mulligan_exchange"
}

function beginTheaterChoice(game, pieceId, options, returnState, returnActive, reason = "eliminated") {
	game.theater_choice = {
		piece_id: pieceId,
		options: options.slice(),
		return_state: returnState,
		return_active: returnActive,
		reason,
	}
	game.state = "eliminated_theater_choice"
	game.active = roleForSide(ALLIED)
}

function enterReplacementSegment(game, side, data, adjacency) {
	if (side === ALLIED) {
		const unknown = Engine.replacements.unclassifiedWesternLcus(game, data)
		if (unknown.length) {
			beginTheaterChoice(game, unknown[0], ["med", "nwe"], "allied_replacements", roleForSide(ALLIED), "released_or_legacy")
			return
		}
	} else Engine.replacements.applyWehrkreisPenalty(game, data, Engine.map, adjacency)
	game.state = side === ALLIED ? "allied_replacements" : "axis_replacements"
	game.active = roleForSide(side)
	if (Engine.replacements.legalReplacementPieces(game, data, Engine.map, adjacency, side).length) return
	Engine.replacements.discardUnspentRp(game, side)
	if (side === ALLIED) enterReplacementSegment(game, AXIS, data, adjacency)
	else Engine.turn.startDrawPhase(game)
}

function finishTheaterChoice(game, theater, data, adjacency) {
	const choice = game.theater_choice
	Engine.replacements.recordEliminatedTheater(game, choice.piece_id, theater)
	Engine.state.log(game, "turn.log.eliminated_theater", {
		piece: Engine.state.pieceLogRef(game, choice.piece_id),
		theater: theater === "med" ? { "zh-CN": "地中海", en: "Mediterranean" } : { "zh-CN": "西北欧", en: "Northwest Europe" },
	})
	game.state = choice.return_state
	game.active = choice.return_active
	game.theater_choice = null
	if (game.state === "allied_replacements") enterReplacementSegment(game, ALLIED, data, adjacency)
}

function register(registerState) {
	registerState("axis_setup_occupied_france", {
		prompt(result, game, role, { data }) {
			result.prompt("turn.setup.deploy_armies")
			result.action(
				"space",
				data.spaces.map((space, spaceId) => (space?.kind === "land" && space.nation === "fr" && space.side === AXIS && !game.setup_choice.occupied_france.spaces.includes(spaceId) ? spaceId : null)).filter(Boolean),
			)
		},
		space(game, role, noun) {
			const choice = game.setup_choice.occupied_france
			const pieceId = choice.pieces[choice.spaces.length]
			const spaceId = Number(noun)
			game.pieces[pieceId] = spaceId
			choice.spaces.push(spaceId)
			if (choice.spaces.length === choice.pieces.length) game.state = "axis_opening_choice"
		},
	})

	registerState("axis_opening_choice", {
		prompt(result, game) {
			result.prompt("turn.opening.choose")
			result.action("card", game.opening_cards.slice())
		},
		card(game, role, noun, { data }) {
			game.axis_opening_card = Number(noun)
			Engine.cards.createInitialDecks(game, data, game.axis_opening_card)
			if (Engine.cards.hasAlliedInitialReinforcement(game, data)) startAxisTurnOne(game)
			else {
				game.state = "allied_mulligan"
				game.active = roleForSide(ALLIED)
			}
		},
	})

	registerState("allied_mulligan", {
		undo: false,
		prompt(result, game) {
			result.prompt("turn.draw.redraw")
			result.action("card", game.hands[ALLIED].slice())
			result.action("discard_all")
			result.action("pass")
		},
		card(game, role, noun, { data }) {
			finishAlliedMulligan(game, data, Number(noun))
		},
		discard_all(game, role, noun, { data }) {
			finishAlliedMulligan(game, data)
		},
		pass(game) {
			startAxisTurnOne(game)
		},
	})

	registerState("allied_mulligan_exchange", {
		undo: false,
		prompt(result, game, role, { data }) {
			result.prompt("turn.draw.exchange")
			result.action(
				"card",
				game.hands[ALLIED].filter((cardId) => Engine.cards.cardOps(data, cardId) >= 3),
			)
			result.action("pass")
		},
		card(game, role, noun, { data }) {
			const discarded = Number(noun)
			const reinforcement = Engine.cards.findCard(data, ALLIED, 24)
			Engine.cards.discard(game, data, ALLIED, discarded)
			const deckIndex = game.decks[ALLIED].indexOf(reinforcement)
			if (deckIndex < 0) throw new Error("Allied card 24 is unavailable for mandatory exchange")
			game.decks[ALLIED].splice(deckIndex, 1)
			game.hands[ALLIED].push(reinforcement)
			Engine.state.clearUndo(game)
			startAxisTurnOne(game)
		},
		pass(game) {
			startAxisTurnOne(game)
		},
	})

	registerState("axis_turn1_event", {
		prompt(result, game) {
			result.prompt("turn.opening.play")
			result.action("play_event", [game.axis_opening_card])
			if (!Engine.neutrals.isAtWar(game, "tu")) result.action("declare_turkey")
			if (!Engine.neutrals.isAtWar(game, "sw")) result.action("declare_sweden")
		},
		play_event(game, role, noun, context) {
			ensureTurnOneStandFastSnapshot(game, context.data)
			return playEventCard(game, role, noun, context)
		},
		declare_turkey(game, role, noun, { data }) {
			ensureTurnOneStandFastSnapshot(game, data)
			Engine.neutrals.declareWar(game, data, "tu", AXIS, "axis_turn1_event")
		},
		declare_sweden(game, role, noun, { data }) {
			ensureTurnOneStandFastSnapshot(game, data)
			Engine.neutrals.declareWar(game, data, "sw", AXIS, "axis_turn1_event")
		},
	})

	registerState("turn1_stalin_orders", {
		inactive: { "zh-CN": "放置斯大林命令", en: "to place Stalin Orders" },
		undo: true,
		prompt(result, game, role, { data, adjacency }) {
			const count = Math.min(game.orders.placements.length, 3)
			const spaces = count < 3 ? Engine.orders.eligibleStandFast(game, data, Engine.map, Engine.logistics, adjacency, "stalin") : []
			result.prompt("turn.setup.place_stalin", { count })
			if (spaces.length) result.action("space", spaces)
			if (count >= 3 || !spaces.length) result.action("continue")
		},
		space(game, role, noun) {
			if (game.orders.placements.length >= 3) return
			const spaceId = Number(noun)
			game.stand_fast[spaceId] = "stalin"
			game.orders.placements.push(spaceId)
		},
		continue(game, role, noun, { data }) {
			Engine.orders.recordStandFastUnits(game, data)
			game.state = "axis_turn1_event"
			Engine.state.clearUndo(game)
		},
	})

	registerState("orders_axis", {
		inactive: { "zh-CN": "结算轴心国命令", en: "to resolve Axis Orders" },
		prompt(result) {
			result.prompt("turn.orders.roll_axis")
			result.action("continue")
		},
		continue(game, role, noun, { data, adjacency }) {
			const roll = Engine.orders.rollAxis(game, data, adjacency)
			Engine.state.clearUndo(game)
			logOrderRoll(game, AXIS, roll)
			if (roll.result === "hitler_orders") {
				game.orders.placing = "hitler"
				game.orders.placements = []
				game.state = "orders_stand_fast"
				game.active = roleForSide(ALLIED)
			} else {
				game.state = "orders_allied"
				game.active = roleForSide(ALLIED)
			}
		},
	})

	registerState("orders_allied", {
		inactive: { "zh-CN": "结算盟军命令", en: "to resolve Allied Orders" },
		prompt(result) {
			result.prompt("turn.orders.roll_allied")
			result.action("continue")
		},
		continue(game, role, noun, { data, adjacency }) {
			const roll = Engine.orders.rollAllied(game, data, adjacency)
			Engine.state.clearUndo(game)
			logOrderRoll(game, ALLIED, roll)
			if (roll.result === "stalin_orders") {
				game.orders.placing = "stalin"
				game.orders.placements = []
				game.state = "orders_stand_fast"
				game.active = roleForSide(AXIS)
			} else Engine.turn.startAfterOrders(game)
		},
	})

	registerState("orders_stand_fast", {
		inactive: { "zh-CN": "放置坚守标记", en: "to place Stand Fast markers" },
		undo: true,
		prompt(result, game, role, { data, adjacency }) {
			const count = Math.min(game.orders.placements.length, 3)
			const spaces = count < 3 ? Engine.orders.eligibleStandFast(game, data, Engine.map, Engine.logistics, adjacency, game.orders.placing) : []
			result.prompt("turn.orders.place", {
				leader: game.orders?.placing === "hitler" ? { "zh-CN": "希特勒", en: "Hitler" } : { "zh-CN": "斯大林", en: "Stalin" },
				count,
			})
			if (spaces.length) result.action("space", spaces)
			result.action("continue")
		},
		space(game, role, noun) {
			if (game.orders.placements.length >= 3) return
			const spaceId = Number(noun)
			game.stand_fast[spaceId] = game.orders.placing
			game.orders.placements.push(spaceId)
		},
		continue(game) {
			if (game.orders.placing === "hitler") {
				game.state = "orders_allied"
				game.active = roleForSide(ALLIED)
			} else Engine.turn.startAfterOrders(game)
		},
	})

	registerState("axis_attrition", {
		inactive: { "zh-CN": "结算损耗", en: "to resolve attrition" },
		prompt(result) {
			result.prompt("turn.attrition.axis")
			result.action("apply_attrition")
		},
		apply_attrition(game, role, noun, { data, adjacency }) {
			const resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, AXIS)
			logAttritionResult(game, resolved, ALLIED)
			if (game.resume_allied_action_after_axis_attrition) {
				delete game.resume_allied_action_after_axis_attrition
				Engine.turn.startAction(game, ALLIED, game.action_round)
			} else {
				game.state = "allied_attrition"
				game.active = roleForSide(ALLIED)
			}
			Engine.state.clearUndo(game)
		},
	})

	registerState("allied_attrition", {
		inactive: { "zh-CN": "结算损耗", en: "to resolve attrition" },
		prompt(result) {
			result.prompt("turn.attrition.allied")
			result.action("apply_attrition")
		},
		apply_attrition(game, role, noun, { data, adjacency }) {
			const resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, ALLIED)
			Engine.invasions.removeUnsupportedBeachheads(game, data, adjacency)
			logAttritionResult(game, resolved, AXIS)
			Engine.neutrals.awardTurkeyRp(game)
			Engine.replacements.awardAxisVariantRp(game)
			Engine.state.logH1(game, "turn.phase.replacement")
			game.phase = "replacement"
			enterReplacementSegment(game, ALLIED, data, adjacency)
			Engine.state.clearUndo(game)
		},
	})

	for (const [state, side, next] of [
		["allied_replacements", ALLIED, "axis_replacements"],
		["axis_replacements", AXIS, null],
	]) {
		registerState(state, {
			prompt(result, game, role, { data, adjacency }) {
				result.prompt(side === ALLIED ? "turn.replacement.allied" : "turn.replacement.axis")
				const pieces = Engine.replacements.legalReplacementPieces(game, data, Engine.map, adjacency, side)
				if (side === ALLIED) pieces.push(...Engine.replacements.unclassifiedWesternLcus(game, data))
				if (pieces.length) result.action("piece", pieces)
				result.action("done")
			},
			piece(game, role, noun, { data, adjacency }) {
				const pieceId = Number(noun)
				if (side === ALLIED && Engine.replacements.unclassifiedWesternLcus(game, data).includes(pieceId)) {
					beginTheaterChoice(game, pieceId, ["med", "nwe"], state, roleForSide(ALLIED), "released_or_legacy")
					return
				}
				if (side === AXIS) Engine.replacements.applyWehrkreisPenalty(game, data, Engine.map, adjacency)
				const replaced = Engine.replacements.replaceStep(game, data, Engine.map, adjacency, side, pieceId)
				if (replaced.placement_required) {
					game.replacement = {
						side,
						piece_id: pieceId,
						return_state: state,
					}
					game.state = "replacement_place_lcu"
				} else enterReplacementSegment(game, side, data, adjacency)
			},
			done(game, role, noun, { data, adjacency }) {
				if (side === AXIS) Engine.replacements.applyWehrkreisPenalty(game, data, Engine.map, adjacency)
				Engine.replacements.discardUnspentRp(game, side)
				if (next) enterReplacementSegment(game, AXIS, data, adjacency)
				else Engine.turn.startDrawPhase(game)
				Engine.state.clearUndo(game)
			},
		})
	}

	registerState("replacement_place_lcu", {
		prompt(result, game, role, { data, adjacency }) {
			result.prompt("turn.replacement.location")
			result.action("space", Engine.replacements.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, game.replacement.piece_id))
			if (Engine.replacements.canRebuildLcuInAlliedReserve(game, data, game.replacement.piece_id)) result.action("reserve")
			result.action("pass")
		},
		space(game, role, noun, { data, adjacency }) {
			const replacement = game.replacement
			Engine.replacements.placeRebuiltLcu(game, data, Engine.map, adjacency, replacement.side, replacement.piece_id, Number(noun))
			game.replacement = null
			enterReplacementSegment(game, replacement.side, data, adjacency)
		},
		reserve(game, role, noun, { data, adjacency }) {
			const replacement = game.replacement
			Engine.replacements.placeRebuiltLcuInAlliedReserve(game, data, Engine.map, adjacency, replacement.piece_id)
			game.replacement = null
			enterReplacementSegment(game, replacement.side, data, adjacency)
		},
		pass(game) {
			game.state = game.replacement.return_state
			game.replacement = null
		},
	})

	registerState("eliminated_theater_choice", {
		undo: false,
		prompt(result, game, role, { data }) {
			const choice = game.theater_choice
			const piece = data.pieces[choice?.piece_id]
			result.prompt("turn.eliminated_theater", { piece: piece?.name || `#${choice?.piece_id}` })
			if (choice?.options?.includes("med")) result.action("med")
			if (choice?.options?.includes("nwe")) result.action("nwe")
		},
		med(game, role, noun, { data, adjacency }) {
			finishTheaterChoice(game, "med", data, adjacency)
		},
		nwe(game, role, noun, { data, adjacency }) {
			finishTheaterChoice(game, "nwe", data, adjacency)
		},
	})

	for (const [state, side] of [
		["draw_discard_allied", ALLIED],
		["draw_discard_axis", AXIS],
	]) {
		registerState(state, {
			prompt(result, game) {
				const totalWarNote = Engine.cards.totalWarDue(game) ? "；总体战选牌需要空位" : ""
				result.prompt("turn.cards.discard", {
					note: totalWarNote ? { "zh-CN": totalWarNote, en: " (before adding Total War!)" } : "",
				})
				result.action("card", game.hands[side].slice())
				if (game.hands[side].length <= Engine.turn.handLimit(game, side)) result.action("continue")
			},
			card(game, role, noun, { data }) {
				Engine.cards.discard(game, data, side, Number(noun))
			},
			continue(game) {
				Engine.turn.finishDrawForSide(game, side)
			},
		})
	}

	function startAxisTotalWarChoice(game) {
		game.state = "total_war_axis_pick"
		Engine.turn.setActive(game, AXIS)
	}

	function finishTotalWarPreparation(game, data) {
		Engine.cards.addTotalWarDecks(game, data)
		Engine.state.log(game, "turn.log.deck_transition")
		Engine.turn.completeDrawPhase(game)
	}

	registerState("total_war_allied_pick", {
		undo: false,
		prompt(result, game, role, { data }) {
			result.prompt("turn.cards.blitz")
			if (game.hands[ALLIED].length < Engine.turn.handLimit(game, ALLIED)) result.action("card", Engine.cards.alliedTotalWarChoices(game, data))
			result.action("pass")
		},
		card(game, role, noun, { data }) {
			const cardId = Engine.cards.takeAlliedTotalWarCard(game, data, Number(noun))
			Engine.state.log(game, "turn.log.card_added", { side: { "zh-CN": "盟军", en: "The Allies" }, card: `c${cardId}` })
			startAxisTotalWarChoice(game)
		},
		pass(game) {
			startAxisTotalWarChoice(game)
		},
	})

	registerState("total_war_axis_pick", {
		undo: false,
		prompt(result, game, role, { data }) {
			result.prompt("turn.cards.total_war")
			if (game.hands[AXIS].length < Engine.turn.handLimit(game, AXIS)) result.action("card", [Engine.cards.totalerKriegCard(data)])
			result.action("pass")
		},
		card(game, role, noun, { data }) {
			const cardId = Engine.cards.takeTotalerKrieg(game, data)
			if (Number(noun) !== cardId) throw new Error(`invalid Totaler Krieg card: ${noun}`)
			Engine.state.log(game, "turn.log.card_added", { side: { "zh-CN": "轴心国", en: "The Axis" }, card: `c${cardId}` })
			finishTotalWarPreparation(game, data)
		},
		pass(game, role, noun, { data }) {
			finishTotalWarPreparation(game, data)
		},
	})

	registerState("end_voluntary_elimination", {
		prompt(result, game, role, { data, adjacency }) {
			const pieces = Engine.replacements.voluntaryEliminationCandidates(game, data, Engine.map, adjacency)
			result.prompt("turn.voluntary_elimination")
			if (pieces.length) result.action("piece", pieces)
			result.action("done")
		},
		piece(game, role, noun, { data, adjacency }) {
			Engine.replacements.voluntarilyEliminate(game, data, Engine.map, adjacency, Number(noun))
		},
		done(game) {
			game.state = "end_remove_trenches"
			game.end_removal_side = ALLIED
		},
	})

	registerState("end_remove_trenches", {
		prompt(result, game, role, { data, adjacency }) {
			const side = game.end_removal_side
			result.prompt(side === ALLIED ? "turn.trench.remove_allied" : "turn.trench.remove_axis")
			const trenches = Object.keys(game.trench || {})
				.map(Number)
				.filter((spaceId) => game.trench_owner?.[spaceId] === side)
			const beaches = side === ALLIED ? Engine.invasions.removableBeachheads(game, data, Engine.map, adjacency) : []
			const spaces = [...new Set(trenches.concat(beaches))]
			if (spaces.length) result.action("space", spaces)
			result.action("done")
		},
		space(game, role, noun, { data }) {
			const spaceId = Number(noun)
			if (Engine.invasions.activeBeachhead(game, spaceId)) Engine.invasions.removeBeachhead(game, data, spaceId, "由盟军自愿撤除")
			else Engine.map.removeTrench(game, spaceId)
		},
		done(game) {
			if (game.end_removal_side === ALLIED) {
				game.end_removal_side = AXIS
				Engine.turn.setActive(game, AXIS)
			} else {
				delete game.end_removal_side
				Engine.turn.finishTurn(game)
			}
		},
	})

	registerState("review_rollback_proposal", {
		undo: false,
		prompt(result, game) {
			const proposal = Engine.collaboration.publicRollbackProposal(game)
			result.prompt("turn.collaboration.rollback", { proposer: proposal.proposer, name: proposal.name })
			result.action("accept")
			result.action("reject")
		},
		accept(game, role) {
			return Engine.collaboration.acceptRollback(game, role)
		},
		reject(game, role) {
			return Engine.collaboration.rejectRollback(game, role)
		},
	})

	registerState("flag_supply_warnings", {
		undo: false,
		prompt(result, game, role, { data }) {
			const count = game.supply_warnings?.length || 0
			result.prompt("turn.collaboration.flag", { count })
			result.action("space", Engine.collaboration.legalWarningSpaces(data))
			result.action("done")
		},
		space(game, role, noun, { data }) {
			Engine.collaboration.toggleSupplyWarning(game, Number(noun), data)
		},
		done(game) {
			Engine.collaboration.finishSupplyWarnings(game)
		},
	})

	registerState("review_supply_warnings", {
		undo: false,
		prompt(result, game, role, { data }) {
			const names = (game.supply_warnings || []).map((spaceId) => data.spaces[spaceId]?.name || `#${spaceId}`)
			result.prompt("turn.collaboration.acknowledge", { spaces: I18n.list(names) })
			result.action("done")
		},
		done(game) {
			Engine.collaboration.finishSupplyWarningReview(game)
		},
	})

	registerState("game_over", {
		undo: false,
		prompt(result, game) {
			result.prompt(game.victory || { key: "core.game_over", params: {} })
		},
	})
}

module.exports = { register, startAxisTurnOne }
