"use strict"

/* global view, send_action, action_button */

const BTB = globalThis.BTB_DATA
const spaceElements = []
const pieceElements = new Map()
const markerElements = new Map()
const trackMarkerElements = new Map()
const eventMarkerElements = new Map()
const cardElements = new Map()
const reinforcementCardHotspots = []
const reinforcementSlotElements = new Map()
const reinforcementTokenElements = []
const offMapHotspots = []
const offMapPoolActions = []
const currentMarkerStacks = new Map()
const currentTrackStacks = new Map()
const currentStacks = new Map()
const currentOffMapStacks = new Map()
const CARD_MENU_ACTIONS = ["play_event", "play_ops", "play_sr", "play_rp"]
const SPACE_ACTIONS = ["space", "attack", "deactivate", "move"]
const STATE_ACTION_LABELS = Object.freeze({
	event_panzer_refit: { continue: "ui.action.finish_refit" },
	event_hedgehogs: { continue: "ui.action.finish_placement" },
	event_atlantic_wall: { continue: "ui.action.finish_placement" },
	event_east_wall: { continue: "ui.action.finish_placement" },
	event_final_production_surge: { continue: "ui.action.finish_refit" },
	event_banzai: { continue: "ui.action.confirm_removal" },
	event_extra_attack_prompt: { yes: "ui.action.activate", no: "ui.action.end_action" },
	event_extra_attack_target: { cancel: "ui.action.back" },
	event_axis_marker_space: { done: "ui.action.skip_placement" },
	event_axis_marker_type: { pass: "ui.action.back" },
	turn1_stalin_orders: { continue: "ui.action.finish_placement" },
	orders_stand_fast: { continue: "ui.action.finish_placement" },
	orders_axis: { continue: "ui.action.roll" },
	orders_allied: { continue: "ui.action.roll" },
	draw_discard_allied: { continue: "ui.action.done" },
	draw_discard_axis: { continue: "ui.action.done" },
	ops_activate: { done: "ui.action.done" },
	ops_move: { done: "ui.action.done" },
	ops_entrench_roll: { roll: "ui.action.roll" },
	ops_move_piece: { stop: "ui.action.stop", pass: "ui.action.back" },
	sr_piece: { done: "ui.action.end_action" },
	sr_destination: { pass: "ui.action.back" },
	sr_stalin_destination: { pass: "ui.action.back" },
	ops_combat: { cancel_selection: "ui.action.cancel_selection", done: "ui.action.end_action" },
	combat_confirm: { confirm: "ui.action.confirm_attack", cancel: "ui.action.back_to_selection" },
	combat_attacker_cc: { continue: "ui.action.done" },
	combat_defender_cc: { continue: "ui.action.done" },
	combat_retreat_option: { continue: "ui.action.retreat" },
	combat_retreat: { done: "ui.action.finish_retreat" },
	combat_advance: { stop: "ui.action.stop_advance", done: "ui.action.end_advance" },
})
const PIECE_SIZES = Object.freeze({ lcu: 58, scu: 46 })
const REINFORCEMENT_PIECE_SIZES = Object.freeze({ lcu: 75, scu: 60 })
const GENERAL_TRACK = Object.freeze({ x: 128, zeroY: 2101, stepY: 85 })
const TURN_TRACK = Object.freeze({
	columns: [2989, 3095, 3201, 3308],
	rows: [1105, 1208, 1311, 1416, 1517],
})
const REINFORCEMENT_BOARD = BTB.reinforcement_board || Object.freeze({ width: 1320, height: 1020, slots: [], tokens: [], card_areas: [] })
const REINFORCEMENT_SLOTS = new Map((REINFORCEMENT_BOARD.slots || []).map((slot) => [Number(slot.piece_id), slot]))
const PRINTED_REDUCED_REINFORCEMENTS = new Set((BTB.reinforcement_catalog || []).flatMap((spec) => (spec.units || []).filter((unit) => unit.reduced).map((unit) => unit.piece_id)))
const OFF_MAP_BOXES = Object.freeze({
	axis_eliminated: [2942, 454, 402, 232],
	axis_reserve: [2856, 720, 489, 232],
	allied_reserve: [2828, 1641, 516, 232],
	allied_eliminated: [2829, 1907, 515, 232],
})
const ORDER_TRACKS = Object.freeze({
	allied: Object.freeze({
		allied_mo: [350, 1846],
		soviet_mo: [430, 1846],
		stalin_orders: [510, 1846],
	}),
	axis: Object.freeze({
		none: [3119, 357],
		okw_mo: [3192, 357],
		hitler_orders: [3264, 357],
	}),
})
const ACTION_TRACKS = Object.freeze({
	allied: Object.freeze({
		br_reinf: [278, 2092],
		su_reinf: [350, 2092],
		usa_reinf: [423, 2092],
		allied_invasion: [495, 2092],
		ops: [575, 2092],
		other_event: [648, 2092],
		one_ops: [719, 2092],
		partisans: [790, 2092],
		sr: [282, 1973],
		rp: [363, 1973],
	}),
	axis: Object.freeze({
		ge_reinf: [3023, 99],
		axis_reinf: [3096, 99],
		ops: [3174, 99],
		other_event: [3245, 99],
		one_ops: [3316, 99],
		sr: [3238, 218],
		rp: [3315, 218],
	}),
})
const EVENT_MARKER_SPECS = Object.freeze([
	["barbarossa", "axis", "Barbarossa.jpg", "ui.event_marker.barbarossa"],
	["von_paulus_pause", "axis", "Von Paulus Pause.jpg", "ui.event_marker.von_paulus_pause"],
	["lend_lease", "allied", "Lend-Lease.jpg", "ui.event_marker.lend_lease"],
	["sorge", "allied", "Sorge.jpg", "ui.event_marker.sorge"],
	["us_buildup", "allied", "US Buildup.jpg", "ui.event_marker.us_buildup"],
	["maquis", "allied", "Maquis.jpg", "ui.event_marker.maquis"],
	["speer", "axis", "Speer.jpg", "ui.event_marker.speer"],
	["romania_defects", "allied", "Romania Defects.jpg", "ui.event_marker.romania_defects"],
	["torch", "allied", "Torch.jpg", "ui.event_marker.torch"],
	["sledgehammer", "allied", "Sledgehammer.jpg", "ui.event_marker.sledgehammer"],
	["overlord", "allied", "Overlord.jpg", "ui.event_marker.overlord"],
	["round_up", "allied", "Round Up.jpg", "ui.event_marker.round_up"],
])
const RP_LABEL_KEYS = Object.freeze({ ge: "ui.rp.ge", axis: "ui.rp.axis", br: "ui.rp.br", usa: "ui.rp.usa", su: "ui.rp.su", tu: "ui.rp.tu" })
const ORDER_LABEL_KEYS = Object.freeze({
	none: "ui.order.none",
	okw_mo: "ui.order.okw_mo",
	hitler_orders: "ui.order.hitler_orders",
	allied_mo: "ui.order.allied_mo",
	soviet_mo: "ui.order.soviet_mo",
	stalin_orders: "ui.order.stalin_orders",
})
const ACTION_TRACK_LABEL_KEYS = Object.freeze({
	br_reinf: "ui.action_track.br_reinf",
	su_reinf: "ui.action_track.su_reinf",
	usa_reinf: "ui.action_track.usa_reinf",
	allied_invasion: "ui.action_track.allied_invasion",
	ops: "ui.action_track.ops",
	other_event: "ui.action_track.other_event",
	one_ops: "ui.action_track.one_ops",
	partisans: "ui.action_track.partisans",
	sr: "ui.action_track.sr",
	rp: "ui.action_track.rp",
	ge_reinf: "ui.action_track.ge_reinf",
	axis_reinf: "ui.action_track.axis_reinf",
})
const MOTION_MS = Object.freeze({ card: 100, board: 200, attract: 1000 })
let cardLanguage = "CN"
let uiLocale = "zh-CN"
let focusedStack = null
let focusedTrackStack = null
let focusedOffMapStack = null
let counterStyle = "bevel"
let mouseFocus = 0
let shownSupplyQuery = null
let legalActionSource = null
let reinforcementBoardElement = null
const legalActionSets = new Map()
const spaceIntentCache = new Map()
const staticUiText = new Map()

function uiText(key, params) {
	if (params !== undefined) return BTBI18N.render(uiLocale, key, params)
	const cacheKey = `${uiLocale}\0${key}`
	if (!staticUiText.has(cacheKey)) staticUiText.set(cacheKey, BTBI18N.render(uiLocale, key))
	return staticUiText.get(cacheKey)
}

function includesId(collection, id) {
	return Array.isArray(collection) && (collection.includes(id) || collection.includes(String(id)))
}

function pieceSize(piece) {
	return PIECE_SIZES[piece?.size] || PIECE_SIZES.scu
}

function reinforcementPieceSize(piece) {
	return REINFORCEMENT_PIECE_SIZES[piece?.size] || REINFORCEMENT_PIECE_SIZES.scu
}

function setPieceDimensions(element, size) {
	const value = `${size}px`
	if (element.style.width !== value) element.style.width = value
	if (element.style.height !== value) element.style.height = value
}

function stackPieceRank(piece, reduced) {
	return (piece?.size === "scu" ? 2 : 0) + (reduced ? 1 : 0)
}

function stackMarkerRank(type) {
	if (type === "oos") return 5
	return type === "move" || type === "combat" ? 4 : -1
}

function compareStackEntries(a, b) {
	return a[3] - b[3] || b[0] - a[0]
}

function rebuildInteractionCache() {
	legalActionSource = view?.actions
	legalActionSets.clear()
	spaceIntentCache.clear()
	for (const [verb, nouns] of Object.entries(view?.actions || {})) {
		if (Array.isArray(nouns)) legalActionSets.set(verb, new Set(nouns.map(String)))
	}
}

function idSet(...collections) {
	const result = new Set()
	for (const collection of collections) {
		if (!Array.isArray(collection)) continue
		for (const id of collection) result.add(String(id))
	}
	return result
}

function setMapCounterPosition(element, x, y) {
	const left = `${x}px`
	const top = `${y}px`
	if (element.style.left !== left) element.style.left = left
	if (element.style.top !== top) element.style.top = top
}

function cardAsset(cardId) {
	const card = BTB.cards[cardId]
	if (!card) return ""
	return `cards.${cardLanguage}/card_${card.side}_${String(card.num).padStart(2, "0")}.webp`
}

function cardDisplayName(card) {
	if (!card) return ""
	return cardLanguage === "CN" ? card.name_zh || card.name : card.name
}

function pieceAsset(piece, reduced) {
	return `images/${encodeURIComponent(reduced && piece.image_reduced ? piece.image_reduced : piece.image_full)}`
}

function isLegal(verb, noun) {
	if (legalActionSource !== view?.actions) rebuildInteractionCache()
	return legalActionSets.get(verb)?.has(String(noun)) || false
}

function isAvailable(verb) {
	return view?.actions?.[verb] === 1
}

function cardMenuActions(cardId) {
	return CARD_MENU_ACTIONS.filter((action) => isLegal(action, cardId))
}

function legalSpaceVerbs(spaceId) {
	return SPACE_ACTIONS.filter((verb) => isLegal(verb, spaceId))
}

function spaceClickIntent(spaceId) {
	if (legalActionSource !== view?.actions) rebuildInteractionCache()
	if (spaceIntentCache.has(spaceId)) return spaceIntentCache.get(spaceId)
	const verbs = legalSpaceVerbs(spaceId)
	let intent
	if (!verbs.length) intent = { type: "none", verbs }
	else if (verbs.length === 1) intent = { type: "action", verb: verbs[0], verbs }
	else intent = { type: "choice", verbs }
	spaceIntentCache.set(spaceId, intent)
	return intent
}

function reinforcementMoveTarget(zoneId) {
	const match = /^(allied|axis)_reserve$/.exec(String(zoneId))
	return match ? `reserve:${match[1]}` : null
}

function sideCardIds(groups) {
	return [...new Set([...(groups?.allied || []), ...(groups?.axis || [])])]
}

function combatCardDisplay(viewState = view) {
	const played = sideCardIds(viewState?.combat?.cc_played)
	const playedSet = new Set(played)
	const retained = sideCardIds(viewState?.combat_cards).filter((cardId) => !playedSet.has(cardId))
	return { played, retained }
}

function replacementPointSummary(rp) {
	const entries = Object.entries(RP_LABEL_KEYS)
		.map(([key, labelKey]) => [uiText(labelKey), Number(rp?.[key]) || 0])
		.filter((entry) => entry[1] > 0)
	return entries.length ? `RP · ${entries.map(([label, value]) => `${label} ${value}`).join(" · ")}` : ""
}

function generalTrackPoint(value) {
	const bounded = Math.max(0, Math.min(9, Number(value) || 0))
	return [GENERAL_TRACK.x, GENERAL_TRACK.zeroY - bounded * GENERAL_TRACK.stepY]
}

function turnTrackPoint(turn) {
	const index = Math.max(0, Math.min(17, (Number(turn) || 1) - 1))
	return [TURN_TRACK.columns[index % 4], TURN_TRACK.rows[Math.floor(index / 4)]]
}

function currentActionSide(viewState) {
	if (viewState?.active === "Allied") return "allied"
	if (viewState?.active === "Axis") return "axis"
	return null
}

function actionTrackEntries(side, viewState = view) {
	const entries = Array.from(viewState?.action_track?.[side] || []).slice(0, 6)
	if (currentActionSide(viewState) === side && viewState?.action?.track && entries.length < 6) entries.push(viewState.action.track)
	return entries
}

function eventMarkerDescriptors(viewState = view) {
	const events = viewState?.events || {}
	const markers = EVENT_MARKER_SPECS.filter(([key]) => events[key]).map(([key, side, asset, titleKey]) => ({ key, side, asset, title: uiText(titleKey) }))
	if (events.us_entry_source === 6) markers.push({ key: "us_entry", side: "allied", asset: "FDR Declares War.jpg", title: uiText("ui.event_marker.fdr_declares_war") })
	else if (events.us_entry_source === 63) markers.push({ key: "us_entry", side: "axis", asset: "Hitler Declares War.jpg", title: uiText("ui.event_marker.hitler_declares_war") })
	if (viewState?.invasion_usage?.turn === viewState?.turn && viewState.invasion_usage.used) markers.push({ key: "allied_invasion", side: "allied", asset: "Allied Invasion.jpg", title: uiText("ui.event_marker.allied_invasion_used") })
	return markers
}

function trackMarkerDescriptors(viewState = view) {
	const markers = []
	const add = (key, asset, title, point, size = 51) => markers.push({ key, asset, title, x: point[0], y: point[1], size })
	const vp = Math.max(0, Number(viewState?.vp) || 0)
	add("turn", "Game Turn.jpg", uiText("ui.track.turn", { turn: viewState?.turn || 1 }), turnTrackPoint(viewState?.turn))
	const evacuationTurn = Number(viewState?.events?.industrial_evacuation_turn) || 0
	const tankArmyTurn = evacuationTurn + 4
	if (viewState?.events?.industrial_evacuation && evacuationTurn > 0 && tankArmyTurn <= 18)
		add("event:industrial_evacuation", "Industrial Evacuation.jpg", uiText("ui.track.industrial_evacuation", { turn: tankArmyTurn }), turnTrackPoint(tankArmyTurn))
	add("vp:ones", "VPx1.jpg", uiText("ui.track.vp_ones", { value: vp % 10 }), generalTrackPoint(vp % 10), 63)
	add("vp:tens", "VPx10.jpg", uiText("ui.track.vp_tens", { value: Math.floor(vp / 10) }), generalTrackPoint(Math.floor(vp / 10)), 63)
	add("hand:axis", "Axis Hand.jpg", uiText("ui.track.hand_limit", { side: uiText("core.role.axis"), count: viewState?.hand_limit?.axis ?? 7 }), generalTrackPoint(viewState?.hand_limit?.axis ?? 7))
	add("hand:allied", "Allied Hand.jpg", uiText("ui.track.hand_limit", { side: uiText("core.role.allied"), count: viewState?.hand_limit?.allied ?? 7 }), generalTrackPoint(viewState?.hand_limit?.allied ?? 7))

	const rpMarkers = [
		["ge", "GE Repl.jpg", "GE Repl +10.jpg", "ui.track.rp_ge"],
		["axis", "Axis Repl.jpg", null, "ui.track.rp_axis"],
		["br", "BR Repl.jpg", null, "ui.track.rp_br"],
		["usa", "US Repl.jpg", null, "ui.track.rp_usa"],
		["su", "SU Repl.jpg", "SU Repl +10.jpg", "ui.track.rp_su"],
	]
	for (const [key, baseAsset, plusAsset, labelKey] of rpMarkers) {
		const value = Math.max(0, Number(viewState?.rp?.[key]) || 0)
		const plusTen = Boolean(plusAsset && value >= 10)
		add(`rp:${key}`, plusTen ? plusAsset : baseAsset, uiText("ui.track.rp", { label: uiText(labelKey), value }), generalTrackPoint(plusTen ? value - 10 : value))
	}

	const axisOrders = viewState?.orders?.axis || {
		result: "none",
		fulfilled: true,
	}
	const alliedOrders = viewState?.orders?.allied || {
		result: "stalin_orders",
		fulfilled: true,
	}
	add(
		"orders:axis",
		axisOrders.fulfilled ? "Axis Orders Complete.jpg" : "Axis Order.jpg",
		uiText("ui.track.orders", { side: uiText("core.role.axis"), order: uiText(ORDER_LABEL_KEYS[axisOrders.result]) }),
		ORDER_TRACKS.axis[axisOrders.result] || ORDER_TRACKS.axis.none,
	)
	add(
		"orders:allied",
		alliedOrders.fulfilled ? "Allied Orders Complete.jpg" : "Allied Orders.jpg",
		uiText("ui.track.orders", { side: uiText("core.role.allied"), order: uiText(ORDER_LABEL_KEYS[alliedOrders.result]) }),
		ORDER_TRACKS.allied[alliedOrders.result] || ORDER_TRACKS.allied.stalin_orders,
	)

	for (const side of ["allied", "axis"]) {
		const label = uiText(side === "allied" ? "core.role.allied" : "core.role.axis")
		for (const [index, track] of actionTrackEntries(side, viewState).entries()) {
			const point = ACTION_TRACKS[side][track]
			if (!point) continue
			add(`action:${side}:${index + 1}`, `${side === "allied" ? "Allied" : "Axis"} Action_${index + 1}.jpg`, uiText("ui.track.action", { side: label, round: index + 1, action: uiText(ACTION_TRACK_LABEL_KEYS[track]) }), point)
		}
	}
	return markers
}

function cardQueryGroups(query, params) {
	if (query === "discard") return [{ title: uiText("ui.cards.my_discard"), cards: Array.isArray(params) ? params : [] }]
	if (query === "removed")
		return [
			{
				title: uiText("ui.cards.removed_side", { side: uiText("core.role.allied") }),
				cards: Array.isArray(params?.allied) ? params.allied : [],
			},
			{
				title: uiText("ui.cards.removed_side", { side: uiText("core.role.axis") }),
				cards: Array.isArray(params?.axis) ? params.axis : [],
			},
		]
	return null
}

function sideLabel(side) {
	if (side === "allied") return uiText("core.role.allied")
	if (side === "axis") return uiText("core.role.axis")
	return uiText("ui.side.neutral")
}

function spaceStatusText(space, viewState = view) {
	if (!space) return ""
	const terrainLabels = {
		clear: "ui.terrain.clear",
		desert: "ui.terrain.desert",
		mountain: "ui.terrain.mountain",
		forest: "ui.terrain.forest",
		swamp: "ui.terrain.swamp",
	}
	const kindLabels = { sr: "ui.space.sr", beach: "ui.space.beach" }
	const control = viewState?.control?.[space.id] || space.side
	const parts = [space.name, uiText("ui.space.control", { side: sideLabel(control) })]
	if (kindLabels[space.kind]) parts.push(uiText(kindLabels[space.kind]))
	if (terrainLabels[space.terrain]) parts.push(uiText(terrainLabels[space.terrain]))
	if (space.urban) parts.push(uiText("ui.space.urban"))
	if (Number(space.vp) > 0) parts.push(`VP ${space.vp}`)
	if (space.capital) parts.push(uiText("ui.space.capital"))
	if (space.port) parts.push(uiText("ui.space.port"))
	if (space.resource) parts.push(space.resource === "oil" ? uiText("ui.space.oil") : space.resource === "iron" ? uiText("ui.space.iron") : String(space.resource))
	if (space.supply) parts.push(uiText("ui.space.supply_source"))
	if (space.wehrkreis) parts.push(uiText("ui.space.wehrkreis"))
	if (space.fort) parts.push(uiText(includesId(viewState?.destroyed_forts, space.id) ? "ui.space.fort_destroyed" : "ui.space.fort"))
	const trench = Number(viewState?.trench?.[space.id]) || 0
	if (trench) parts.push(uiText("ui.space.trench", { level: trench }))
	if (Boolean(viewState?.stand_fast?.[space.id]) || includesId(viewState?.stand_fast, space.id)) parts.push(uiText("ui.space.stand_fast"))
	if (includesId(viewState?.partisans, space.id)) parts.push(uiText("ui.space.partisans"))
	const pieceCount = Object.entries(viewState?.pieces || {}).filter(([pieceId, location]) => {
		const piece = BTB.pieces?.[Number(pieceId)]
		return location === space.id && piece && piece.size !== "marker"
	}).length
	if (pieceCount) parts.push(uiText("ui.space.unit_count", { count: pieceCount }))
	return parts.join(" · ")
}

function pieceStatusText(pieceId, viewState = view) {
	const piece = BTB.pieces[pieceId]
	if (!piece) return ""
	const reduced = includesId(viewState?.reduced, pieceId)
	const cf = reduced ? piece.rcf : piece.cf
	const lf = reduced ? piece.rlf : piece.lf
	const mf = reduced ? piece.rmf : piece.mf
	const location = viewState?.pieces?.[pieceId]
	let locationName = uiText("ui.piece.off_map")
	if (Number.isInteger(location)) locationName = BTB.spaces?.[location]?.name || uiText("ui.piece.space", { id: location })
	else if (String(location).startsWith("reserve:")) locationName = uiText("ui.piece.reserve")
	else if (String(location).startsWith("eliminated:")) locationName = uiText("ui.piece.eliminated")
	else if (String(location).startsWith("turn_track:")) locationName = uiText("ui.piece.turn_track")
	else if (location === "available" || String(location).startsWith("setup_choice:")) locationName = uiText("ui.piece.available")
	if (piece.cf === undefined) return uiText("ui.piece.marker_status", { name: piece.name, side: sideLabel(piece.side), location: locationName })
	return uiText("ui.piece.status", { name: piece.name, reduced: reduced ? uiText("ui.piece.reduced") : "", side: sideLabel(piece.side), cf, lf, mf, location: locationName })
}

function supplyStatusCounts(result) {
	const counts = { full: 0, limited: 0, oos: 0 }
	for (const status of Object.values(result?.pieces || {})) if (Object.hasOwn(counts, status)) counts[status]++
	return counts
}

function outOfSupplySpaceIds(viewState = view) {
	const result = new Set()
	for (const pieceId of viewState?.oos || []) {
		const location = viewState?.pieces?.[pieceId]
		if (Number.isInteger(location) && location > 0) result.add(location)
	}
	return result
}

function occupiedUnitSpaceIds(viewState = view) {
	const result = new Set()
	for (const [pieceIdText, location] of Object.entries(viewState?.pieces || {})) {
		if (!Number.isInteger(location) || location <= 0 || !BTB.spaces?.[location]) continue
		const piece = BTB.pieces?.[Number(pieceIdText)]
		if (!piece || piece.size === "marker") continue
		result.add(location)
	}
	return result
}

function controlMarkerDescriptor(space, viewState = view) {
	const control = viewState?.control?.[space.id]
	if (!["allied", "axis"].includes(control) || control === space.side) return null
	return {
		type: "control",
		asset: control === "allied" ? "Allied Control.jpg" : "German Control.jpg",
		title: uiText("ui.marker.control", { side: sideLabel(control) }),
		size: 51,
	}
}

function escapeText(text) {
	return String(text ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/---/g, "\u2014")
		.replace(/--/g, "\u2013")
		.replace(/-&gt;/g, "\u2192")
}

function dieLogIcon(_match, color, value) {
	const sideClass = color === "W" ? "ap" : "cp"
	const label = escapeText(uiText("ui.log.die", { value }))
	return `<span class="die ${sideClass} d${value}" title="${label}" aria-label="${label}"></span>`
}

function cardLogTip(_match, cardIdText) {
	const cardId = Number(cardIdText)
	const card = BTB.cards?.[cardId]
	if (!card) return `c${cardIdText}`
	const sideClass = card.side === "allied" ? "ap-card" : "cp-card"
	return `<span class="cardtip ${sideClass}" title="${escapeText(uiText("ui.log.locate_card"))}" onmouseenter="on_focus_card_tip(${cardId})" onmouseleave="on_blur_card_tip()" onclick="on_click_card_tip(${cardId})">${escapeText(cardDisplayName(card))}</span>`
}

function spaceLogTip(_match, spaceIdText) {
	const spaceId = Number(spaceIdText)
	const space = BTB.spaces?.[spaceId]
	if (!space) return `s${spaceIdText}`
	return `<span class="spacetip" title="${escapeText(uiText("ui.log.locate_space"))}" onclick="on_click_space_tip(${spaceId})">${escapeText(space.name)}</span>`
}

function pieceLogTip(_match, prefix, pieceIdText) {
	const pieceId = Number(pieceIdText)
	const piece = BTB.pieces?.[pieceId]
	if (!piece) return `${prefix}${pieceIdText}`
	const sideClass = piece.side === "allied" ? "ap-unit" : piece.side === "axis" ? "cp-unit" : ""
	const label = prefix === "p" ? `（${piece.name}）` : piece.name
	return `<span class="piecetip ${sideClass}" title="${escapeText(uiText("ui.log.locate_piece"))}" onclick="on_click_piece_tip(${pieceId})">${escapeText(label)}</span>`
}

function on_prompt(text) {
	return escapeText(text)
		.replace(/\b([BW])([1-6])\b/g, dieLogIcon)
		.replace(/\bc(\d+)\b/g, cardLogTip)
		.replace(/\bs(\d+)\b/g, spaceLogTip)
		.replace(/\b([pP])(\d+)\b/g, pieceLogTip)
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		.replace(/\n/g, "<br>")
}

let logBoxAllied = 0
let logBoxAxis = 0

function on_log(text, index) {
	const element = document.createElement("div")
	text = String(text ?? "")
	if (index < logBoxAllied) logBoxAllied = 0
	if (index < logBoxAxis) logBoxAxis = 0

	if (text.startsWith(">>")) {
		text = text.substring(2).replace(/^ /, "")
		element.classList.add("i", "detail", "align")
	} else if (text.startsWith(">")) {
		text = text.substring(1).replace(/^ /, "")
		element.classList.add("i", "detail")
	}
	if (text.startsWith("*") && !text.startsWith("**")) {
		text = text.substring(1)
		element.classList.add("bold")
	}

	if (text.startsWith("!")) {
		text = `\u2757 ${text.substring(1)}`
	} else if (text.startsWith("#ap ") || text.startsWith("#allied ")) {
		text = text.substring(text.startsWith("#ap ") ? 4 : 8)
		element.className = "h4"
		logBoxAllied = index
	} else if (text.startsWith("#cp ") || text.startsWith("#axis ")) {
		text = text.substring(text.startsWith("#cp ") ? 4 : 6)
		element.className = "h4"
		logBoxAxis = index
	} else if (text.startsWith(".h1")) {
		text = text.substring(3)
		element.className = "h1"
	} else if (text.startsWith(".h2")) {
		text = text.substring(3)
		if (text === "AP") element.className = "h2 ap"
		else if (text === "CP") element.className = "h2 cp"
		else {
			element.className = "h2"
			if (text === uiText("action.log.phase")) element.classList.add("phase-strong")
		}
	} else if (text.startsWith(".h3ap")) {
		text = text.substring(5)
		element.className = "h3 ap"
	} else if (text.startsWith(".h3cp")) {
		text = text.substring(5)
		element.className = "h3 cp"
	} else if (text.startsWith(".h3")) {
		text = text.substring(3)
		element.className = "h3"
	}

	if (text === "") {
		logBoxAllied = 0
		logBoxAxis = 0
	}
	if (logBoxAllied) element.classList.add("group", "ap")
	if (logBoxAxis) element.classList.add("group", "cp")
	element.innerHTML = on_prompt(text)
	return element
}

function on_click_card_tip(cardId) {
	cardId = Number(cardId)
	const element = cardElements.get(cardId)
	if (element?.isConnected && element.getClientRects().length) {
		element.scrollIntoView({ behavior: motionBehavior(), block: "center", inline: "center" })
		return
	}
	const card = BTB.cards?.[cardId]
	if (card) showCardQuery(cardDisplayName(card), [{ title: uiText("ui.cards.strategy", { side: sideLabel(card.side) }), cards: [cardId] }])
}

function on_focus_card_tip(cardId) {
	const card = BTB.cards?.[Number(cardId)]
	const tooltip = document.getElementById("tooltip")
	if (!card || !tooltip) return
	tooltip.className = `card ${card.side === "allied" ? "ap" : "cp"}`
	tooltip.style.backgroundImage = `url("${cardAsset(card.id)}")`
	tooltip.hidden = false
}

function on_blur_card_tip() {
	const tooltip = document.getElementById("tooltip")
	if (tooltip) tooltip.hidden = true
}

function on_click_space_tip(spaceId) {
	revealMapSpace(spaceId)
}

function on_click_piece_tip(pieceId) {
	const element = pieceElements.get(Number(pieceId))
	if (!element) return
	element.scrollIntoView({ behavior: motionBehavior(), block: "center", inline: "center" })
	attractElement(element)
}

function hideActivationPopup() {
	const menu = document.getElementById("activation_popup")
	if (menu) menu.hidden = true
}

function showTargetPopup(event, noun, element, title, actions) {
	const menu = document.getElementById("activation_popup")
	if (!menu) return
	const allowed = new Set(actions)
	menu.querySelector(".title").textContent = title
	for (const item of menu.querySelectorAll("li[data-action]")) {
		const action = item.dataset.action
		const enabled = allowed.has(action) && isLegal(action, noun)
		item.classList.toggle("hide", !enabled)
		item.classList.toggle("action", enabled)
		item.onclick = enabled
			? (clickEvent) => {
					clickEvent.stopPropagation()
					hideActivationPopup()
					send_action(action, noun)
				}
			: null
	}
	menu.hidden = false
	const anchor = cardPopupPoint(event, element)
	const width = menu.offsetWidth
	const height = menu.offsetHeight
	menu.style.left = `${Math.max(5, Math.min(anchor.clientX - width / 2, window.innerWidth - width - 5))}px`
	menu.style.top = `${Math.max(5, Math.min(anchor.clientY - 12, window.innerHeight - height - 40))}px`
}

function showActivationPopup(event, spaceId, element) {
	const space = BTB.spaces[spaceId]
	if (space) {
		showTargetPopup(event, spaceId, element, space.name, ["space", "attack", "deactivate", "move"])
	}
}

function showPiecePopup(event, pieceId, element) {
	const piece = BTB.pieces[pieceId]
	if (piece) showTargetPopup(event, pieceId, element, piece.name, ["piece", "entrench"])
}

function applySpaceClick(event, spaceId, element) {
	const intent = spaceClickIntent(spaceId)
	if (intent.type === "action") {
		hideActivationPopup()
		send_action(intent.verb, spaceId)
		return true
	}
	if (intent.type === "choice") {
		showActivationPopup(event, spaceId, element)
		return true
	}
	return false
}

function setMenuCheck(id, checked) {
	const element = document.getElementById(id)
	if (element) element.className = checked ? "checked" : "unchecked"
}

function set_style(style) {
	counterStyle = style === "flat" ? "flat" : "bevel"
	localStorage.setItem("btb.style", counterStyle)
	document.body.classList.toggle("bevel", counterStyle === "bevel")
	document.body.classList.toggle("flat", counterStyle === "flat")
	setMenuCheck("style_bevel", counterStyle === "bevel")
	setMenuCheck("style_flat", counterStyle === "flat")
	if (typeof view !== "undefined" && view) updatePieces()
}

function set_mouse_focus(value) {
	mouseFocus = value === undefined ? 1 - mouseFocus : Number(Boolean(value))
	localStorage.setItem("btb.mouseFocus", String(mouseFocus))
	setMenuCheck("mouse_focus", mouseFocus === 1)
}

function on_init(_scenario, options) {
	uiLocale = BTBI18N.normalizeLocale(options?.ui_locale)
	cardLanguage = String(options?.card_language || "").toUpperCase() === "EN" ? "EN" : "CN"
	document.body.classList.toggle("lang-en", cardLanguage === "EN")
	document.body.classList.toggle("lang-cn", cardLanguage === "CN")
	BTBI18N.setLocale(uiLocale)
	BTBI18N.translateDocument(document)
	renderReinforcements()
}

function toggle_counters() {
	const classList = document.getElementById("map").classList
	if (classList.contains("hide_markers")) {
		classList.remove("hide_markers", "hide_pieces")
	} else if (classList.contains("hide_pieces")) {
		classList.add("hide_markers")
	} else {
		classList.add("hide_pieces")
	}
}

function motionBehavior() {
	return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth"
}

function to_reinforcements() {
	document.getElementById("reinforcements_wrap").scrollIntoView({ behavior: motionBehavior(), block: "center" })
}

function attractElement(element) {
	if (!element) return
	element.classList.remove("attract")
	void element.offsetWidth
	element.classList.add("attract")
	window.setTimeout(() => element.classList.remove("attract"), MOTION_MS.attract)
}

function revealMapSpace(spaceId) {
	const element = spaceElements[Number(spaceId)]
	if (!element) return false
	element.scrollIntoView({
		behavior: motionBehavior(),
		block: "center",
		inline: "center",
	})
	attractElement(element)
	return true
}

function showStatus(text) {
	document.getElementById("status").textContent = text || ""
}

function renderSpaces() {
	const layer = document.getElementById("space-overlay")
	for (const space of BTB.spaces) {
		if (!space) continue
		const element = document.createElement("div")
		element.className = "space"
		element.title = `#${space.id} ${space.name}`
		element.style.cssText = `left:${space.x}px;top:${space.y}px;width:${space.w}px;height:${space.h}px`
		element.addEventListener("click", (event) => applySpaceClick(event, space.id, element))
		element.addEventListener("mouseenter", () => showStatus(spaceStatusText(space)))
		element.addEventListener("mouseleave", () => showStatus(""))
		spaceElements[space.id] = element
		layer.append(element)
	}
}

function ensurePiece(pieceId) {
	let element = pieceElements.get(pieceId)
	if (element) return element
	const piece = BTB.pieces[pieceId]
	if (!piece) return null
	element = document.createElement("div")
	element.className = `piece ${piece.size}`
	const size = pieceSize(piece)
	element.style.width = `${size}px`
	element.style.height = `${size}px`
	element.title = `#${pieceId} ${pieceStatusText(pieceId)}`
	element.addEventListener("click", (event) => {
		event.stopPropagation()
		const zoneTarget = element.dataset.zoneTarget
		if (zoneTarget && isLegal("move", zoneTarget)) {
			send_action("move", zoneTarget)
			return
		}
		const offMapKey = element.dataset.offMapKey
		if (offMapKey && focusedOffMapStack !== offMapKey && offMapStackNeedsFocus(offMapKey, currentOffMapStacks.get(offMapKey))) {
			focusOffMapStack(offMapKey)
			return
		}
		const spaceId = Number(element.dataset.spaceId)
		const stack = currentStacks.get(spaceId)
		const spaceIntent = spaceClickIntent(spaceId)
		const canSelect = isLegal("piece", pieceId)
		const canEntrench = isLegal("entrench", pieceId)
		if (!canSelect && !canEntrench && spaceIntent.type !== "none") {
			applySpaceClick(event, spaceId, element)
			return
		}
		if (stack?.length > 1 && focusedStack !== spaceId) {
			focusStack(spaceId)
			return
		}
		if (canSelect && canEntrench) showPiecePopup(event, pieceId, element)
		else if (canSelect) send_action("piece", pieceId)
		else if (canEntrench) send_action("entrench", pieceId)
		else if (stack?.length > 1) focusStack(focusedStack === spaceId ? null : spaceId)
	})
	element.addEventListener("mouseenter", () => {
		const offMapKey = element.dataset.offMapKey
		const spaceId = Number(element.dataset.spaceId)
		showStatus(pieceStatusText(pieceId))
		if (mouseFocus && offMapKey && offMapStackNeedsFocus(offMapKey, currentOffMapStacks.get(offMapKey))) focusOffMapStack(offMapKey)
		else if (mouseFocus && currentStacks.get(spaceId)?.length > 1) focusStack(spaceId)
	})
	element.addEventListener("mouseleave", () => {
		showStatus("")
		if (mouseFocus) focusOffMapStack(null)
	})
	pieceElements.set(pieceId, element)
	return element
}

function updateSpaces() {
	const selectedSpaces = idSet(
		view?.combat?.origin_spaces,
		view?.orders?.placements,
		view?.event_selection?.hedgehog_spaces,
		view?.event_selection?.atlantic_wall_spaces,
		view?.event_selection?.east_wall_spaces,
		view?.events?.luftwaffe_supply_turn === view?.turn ? [view.events.luftwaffe_supply_space] : [],
		view?.action?.event_space === undefined ? [] : [view.action.event_space],
		view?.combat?.defender_space === undefined ? [] : [view.combat.defender_space],
	)
	for (const [spaceId, element] of spaceElements.entries()) {
		if (!element) continue
		const space = BTB.spaces[spaceId]
		if (space) element.title = `#${spaceId} ${spaceStatusText(space)}`
		const intent = spaceClickIntent(spaceId)
		element.classList.toggle("highlight", intent.type !== "none")
		element.classList.toggle("attack", intent.verbs.includes("attack"))
		element.classList.toggle("selected", selectedSpaces.has(String(spaceId)))
		element.classList.toggle("supply-warning", includesId(view?.supply_warnings, spaceId))
	}
}

function trenchAsset(space, level, owner, kind) {
	if (kind === "atlantic_wall") return "Atlantic Wall Trench.jpg"
	if (space.name === "Tobruk") return "Tobruk Trench.jpg"
	if (space.name === "Saar" || space.name === "Stuttgart") return "West Wall Trench.jpg"
	if (owner === "axis") return "German Trench.jpg"
	return level >= 2 ? "Soviet Trench-2.jpg" : "Soviet Trench-1.jpg"
}

function appendMapMarker(layer, key, space, marker) {
	let element = markerElements.get(key)
	if (!element) {
		element = document.createElement("img")
		element.className = "map-marker"
		element.dataset.markerKey = key
		element.addEventListener("click", (event) => {
			event.stopPropagation()
			const spaceId = Number(element.dataset.spaceId)
			const spaceIntent = spaceClickIntent(spaceId)
			if (spaceIntent.type !== "none") {
				applySpaceClick(event, spaceId, element)
				return
			}
			if (currentStacks.get(spaceId)?.length > 1 && focusedStack !== spaceId) focusStack(spaceId)
		})
		element.addEventListener("mouseenter", () => {
			const spaceId = Number(element.dataset.spaceId)
			if (mouseFocus && currentStacks.get(spaceId)?.length > 1) focusStack(spaceId)
		})
		element.addEventListener("mouseleave", () => {
			if (mouseFocus) focusStack(null)
		})
		markerElements.set(key, element)
	}
	const source = `images/${encodeURIComponent(marker.asset)}`
	element.dataset.asset = marker.asset
	if (element.getAttribute("src") !== source) element.src = source
	element.alt = marker.title
	element.title = `${space.name} · ${marker.title}`
	element.dataset.spaceId = String(space.id)
	element.dataset.markerType = marker.type
	element.style.width = `${marker.size}px`
	element.style.height = `${marker.size}px`
	if (element.parentElement !== layer) layer.append(element)
	return element
}

function updateMapMarkers() {
	const layer = document.getElementById("piece-overlay")
	const activeKeys = new Set()
	const oosSpaces = outOfSupplySpaceIds()
	const occupiedUnitSpaces = occupiedUnitSpaceIds()
	currentMarkerStacks.clear()
	for (const space of BTB.spaces) {
		if (!space) continue
		const markers = []
		const controlMarker = occupiedUnitSpaces.has(space.id) ? null : controlMarkerDescriptor(space)
		if (controlMarker) markers.push(controlMarker)
		const trench = Number(view?.trench?.[space.id] || 0)
		if (trench > 0)
			markers.push({
				type: "trench",
				asset: trenchAsset(space, trench, view?.trench_owner?.[space.id], view?.trench_kind?.[space.id]),
				title: uiText("ui.marker.trench", { level: trench }),
				size: 63,
			})
		const beachhead = view?.beachheads?.[space.id]
		if (beachhead) {
			const asset = beachhead.shingle ? "Operation Shingle.jpg" : beachhead.type === "br" ? "British Beach Head.jpg" : beachhead.type === "us" ? "US Beach Head.jpg" : "Allied Beach Head.jpg"
			markers.push({
				type: "beachhead",
				asset,
				title: uiText(beachhead.shingle ? "ui.marker.shingle_beachhead" : "ui.marker.allied_beachhead"),
				size: 63,
			})
		}
		if (includesId(view?.destroyed_forts, space.id))
			markers.push({
				type: "fort",
				asset: "Fort Destroyed.jpg",
				title: uiText("ui.space.fort_destroyed"),
				size: 51,
			})
		const standFast = view?.stand_fast?.[space.id]
		if (standFast)
			markers.push({
				type: "stand_fast",
				asset: standFast === "hitler" ? "Axis Stand Fast.jpg" : "Allied Stand Fast.jpg",
				title: uiText(standFast === "hitler" ? "ui.marker.hitler_stand_fast" : "ui.marker.stalin_stand_fast"),
				size: 51,
			})
		if (view?.events?.luftwaffe_supply_turn === view?.turn && Number(view.events.luftwaffe_supply_space) === space.id)
			markers.push({
				type: "luftwaffe_supply",
				asset: "Luftwaffe Supply.jpg",
				title: uiText("ui.marker.luftwaffe_supply"),
				size: 51,
			})
		if (includesId(view?.partisans, space.id))
			markers.push({
				type: "partisan",
				asset: "Partisans.jpg",
				title: uiText("ui.space.partisans"),
				size: 51,
			})
		if (Number(view?.stalin_location) === space.id)
			markers.push({
				type: "stalin",
				asset: "Stalin.jpg",
				title: uiText("ui.marker.stalin"),
				size: 51,
			})
		if (includesId(view?.action?.move_spaces, space.id))
			markers.push({
				type: "move",
				asset: "Move.jpg",
				title: uiText("ui.activation.move"),
				size: 51,
			})
		if (includesId(view?.action?.attack_spaces, space.id))
			markers.push({
				type: "combat",
				asset: "Combat.jpg",
				title: uiText("ui.activation.combat"),
				size: 51,
			})
		if (oosSpaces.has(space.id))
			markers.push({
				type: "oos",
				asset: "Out of Supply.jpg",
				title: uiText("ui.marker.out_of_supply"),
				size: 51,
			})
		for (let slot = 0; slot < markers.length; slot++) {
			const marker = markers[slot]
			const key = `${space.id}:${marker.type}`
			activeKeys.add(key)
			const element = appendMapMarker(layer, key, space, marker)
			if (!currentMarkerStacks.has(space.id)) currentMarkerStacks.set(space.id, [])
			currentMarkerStacks.get(space.id).push([slot, element, marker.size, stackMarkerRank(marker.type)])
		}
	}
	for (const [key, element] of markerElements) {
		if (activeKeys.has(key)) continue
		markerElements.delete(key)
		element.remove()
	}
}

function layoutTrackStack(key, stack) {
	const dim = counterStyle === "flat" ? { border: 1, gap: 3, padding: 7, dx: 9, dy: 9 } : { border: 2, gap: 5, padding: 7, dx: 9, dy: 9 }
	const focused = focusedTrackStack === key && stack.length > 1
	const centerX = stack[0].marker.x
	const centerY = stack[0].marker.y
	const box = document.getElementById("focus-box")
	if (focused) {
		let y = centerY + (stack[0].marker.size + dim.border * 2) / 2
		let height = 0
		for (let index = 1; index < stack.length; index++) height += stack[index].marker.size + dim.border * 2 + dim.gap
		if (y - height < 50) y = 50 + height
		let minX = centerX
		let minY = y
		let maxX = centerX
		let maxY = y
		for (let index = 0; index < stack.length; index++) {
			const { marker, element } = stack[index]
			const left = Math.floor(centerX - marker.size / 2 - dim.border)
			const top = Math.floor(y - marker.size - dim.border * 2)
			setMapCounterPosition(element, left, top)
			element.style.zIndex = String(101 + index)
			minX = Math.min(minX, left)
			minY = Math.min(minY, top)
			maxX = Math.max(maxX, left + marker.size + dim.border * 2)
			maxY = Math.max(maxY, top + marker.size + dim.border * 2)
			y -= marker.size + dim.border * 2 + dim.gap
		}
		box.style.left = `${minX - dim.padding}px`
		box.style.top = `${minY - dim.padding}px`
		box.style.width = `${maxX - minX + dim.padding * 2}px`
		box.style.height = `${maxY - minY + dim.padding * 2}px`
		box.style.display = "block"
		return
	}
	for (let index = 0; index < stack.length; index++) {
		const { marker, element } = stack[index]
		const offset = index - (stack.length - 1) / 2
		setMapCounterPosition(element, Math.round(centerX - marker.size / 2 + offset * 5), Math.round(centerY - marker.size / 2 - offset * 4))
		element.style.zIndex = String(40 + index)
	}
}

function focusTrackStack(key) {
	focusedTrackStack = key && currentTrackStacks.has(key) ? key : null
	if (focusedTrackStack !== null) focusedStack = null
	if (typeof view !== "undefined" && view) {
		updatePieces()
		updateTrackMarkers()
	}
}

function updateTrackMarkers() {
	const layer = document.getElementById("piece-overlay")
	const markers = trackMarkerDescriptors()
	const activeKeys = new Set(markers.map((marker) => marker.key))
	const groups = new Map()
	currentTrackStacks.clear()
	for (const marker of markers) {
		const cell = `${marker.x}:${marker.y}`
		if (!groups.has(cell)) groups.set(cell, [])
		groups.get(cell).push(marker)
	}
	for (const [cell, group] of groups) {
		const stackKey = `track:${cell}`
		const stack = []
		for (let index = 0; index < group.length; index++) {
			const marker = group[index]
			let element = trackMarkerElements.get(marker.key)
			if (!element) {
				element = document.createElement("img")
				element.className = "map-marker track-marker"
				element.dataset.markerKey = marker.key
				element.addEventListener("click", (event) => {
					event.stopPropagation()
					const key = element.dataset.trackStackKey
					if ((currentTrackStacks.get(key)?.length || 0) > 1 && focusedTrackStack !== key) focusTrackStack(key)
				})
				element.addEventListener("mouseenter", () => {
					const key = element.dataset.trackStackKey
					if (mouseFocus && (currentTrackStacks.get(key)?.length || 0) > 1) focusTrackStack(key)
				})
				element.addEventListener("mouseleave", () => {
					if (mouseFocus) focusTrackStack(null)
				})
				trackMarkerElements.set(marker.key, element)
			}
			const source = `images/${encodeURIComponent(marker.asset)}`
			element.dataset.asset = marker.asset
			if (element.getAttribute("src") !== source) element.src = source
			element.alt = marker.title
			element.title = marker.title
			element.dataset.trackStackKey = stackKey
			element.style.width = `${marker.size}px`
			element.style.height = `${marker.size}px`
			if (element.parentElement !== layer) layer.append(element)
			stack.push({ marker, element })
		}
		currentTrackStacks.set(stackKey, stack)
		layoutTrackStack(stackKey, stack)
	}
	for (const [key, element] of trackMarkerElements) {
		if (activeKeys.has(key)) continue
		trackMarkerElements.delete(key)
		element.remove()
	}
	if (focusedTrackStack !== null && (currentTrackStacks.get(focusedTrackStack)?.length || 0) <= 1) focusedTrackStack = null
	if (focusedStack === null && focusedTrackStack === null) hideFocusBox()
}

function offMapDisplayKey(location, side) {
	if (String(location).startsWith("reserve:")) return `${side}_reserve`
	if (String(location).startsWith("eliminated:")) return `${side}_eliminated`
	const turn = /^turn_track:(\d+)$/.exec(String(location))?.[1]
	return turn ? `turn_${turn}` : null
}

function offMapLayoutMetrics(key) {
	const bounds = OFF_MAP_BOXES[key]
	if (!bounds) return null
	const [, , width, height] = bounds
	const columns = Math.max(1, Math.floor((width - 24) / 54))
	const rows = Math.max(1, Math.floor((height - 44) / 48))
	return { bounds, columns, rows, capacity: columns * rows }
}

function offMapStackNeedsFocus(key, entries) {
	const metrics = offMapLayoutMetrics(key)
	return Boolean(metrics && entries?.length > metrics.capacity)
}

function layoutOffMapPieces(key, entries) {
	if (key.startsWith("turn_")) {
		const turn = Number(key.slice(5))
		const [centerX, centerY] = turnTrackPoint(turn)
		for (let index = 0; index < entries.length; index++) {
			const [, element, size] = entries[index]
			const offset = index - (entries.length - 1) / 2
			setMapCounterPosition(element, Math.round(centerX - size / 2 + offset * 7), Math.round(centerY - size / 2 - offset * 5))
			element.style.zIndex = String(45 + index)
		}
		return
	}
	const metrics = offMapLayoutMetrics(key)
	if (!metrics) return
	const { bounds, columns, capacity } = metrics
	const [x, y, width, height] = bounds
	if (focusedOffMapStack === key && entries.length > capacity) {
		const cell = 64
		const expandedColumns = Math.min(12, Math.ceil(Math.sqrt(entries.length * 1.5)))
		const expandedRows = Math.ceil(entries.length / expandedColumns)
		const panelWidth = expandedColumns * cell + 16
		const panelHeight = expandedRows * cell + 16
		const startX = Math.max(12, Math.min(3400 - panelWidth - 12, x + width - panelWidth))
		const startY = Math.max(12, Math.min(2200 - panelHeight - 12, y + Math.round((height - panelHeight) / 2)))
		for (let index = 0; index < entries.length; index++) {
			const [, element, size] = entries[index]
			const column = index % expandedColumns
			const row = Math.floor(index / expandedColumns)
			setMapCounterPosition(element, startX + 8 + column * cell + Math.round((58 - size) / 2), startY + 8 + row * cell + Math.round((58 - size) / 2))
			element.style.zIndex = String(101 + index)
		}
		const box = document.getElementById("focus-box")
		box.style.left = `${startX}px`
		box.style.top = `${startY}px`
		box.style.width = `${panelWidth}px`
		box.style.height = `${panelHeight}px`
		box.style.display = "block"
		return
	}
	const cell = 54
	for (let index = 0; index < entries.length; index++) {
		const [, element, size] = entries[index]
		const cellIndex = index % capacity
		const layer = Math.floor(index / capacity)
		const column = cellIndex % columns
		const row = Math.floor(cellIndex / columns)
		const left = x + 14 + column * cell + layer * 5
		const top = y + 38 + row * 48 - layer * 4
		setMapCounterPosition(element, Math.min(x + width - size - 8, left), Math.min(y + height - size - 8, top))
		element.style.zIndex = String(40 + index)
	}
}

function hideFocusBox() {
	const box = document.getElementById("focus-box")
	box.style.display = "none"
}

function focusStack(spaceId) {
	focusedStack = spaceId && currentStacks.has(Number(spaceId)) ? Number(spaceId) : null
	focusedOffMapStack = null
	if (focusedStack !== null || !spaceId) focusedTrackStack = null
	if (typeof view !== "undefined" && view) {
		updateTrackMarkers()
		updatePieces()
	}
}

function focusOffMapStack(key) {
	focusedOffMapStack = key && currentOffMapStacks.has(key) ? key : null
	focusedStack = null
	focusedTrackStack = null
	if (typeof view !== "undefined" && view) updatePieces()
}

function layoutStack(spaceId, stack) {
	const space = BTB.spaces[spaceId]
	const focused = focusedStack === spaceId && stack.length > 1
	const dim = counterStyle === "flat" ? { border: 1, gap: 3, padding: 7, dx: 9, dy: 9 } : { border: 2, gap: 5, padding: 7, dx: 9, dy: 9 }
	const centerX = space.x + space.w / 2
	const centerY = space.y + space.h / 2
	const box = document.getElementById("focus-box")
	const tight = stack.length > 5
	const dx = tight ? 3 : dim.dx
	const dy = tight ? 3 : dim.dy
	const dz = tight ? 1 : 3
	let z = focused ? 101 : 1

	if (focused) {
		const x = centerX
		let y = centerY + (stack[0][2] + dim.border * 2) / 2
		let height = 0
		for (let index = 1; index < stack.length; ++index) height += stack[index][2] + dim.border * 2 + dim.gap
		if (y - height < 50) y = 50 + height

		z += dz
		let minX = x
		let minY = y
		let maxX = x
		let maxY = y
		for (const [, element, size] of stack) {
			const elementX = Math.floor(x - size / 2 - dim.border)
			const elementY = Math.floor(y - size - dim.border * 2)
			setMapCounterPosition(element, elementX, elementY)
			element.style.zIndex = String(z)
			minX = Math.min(minX, elementX)
			minY = Math.min(minY, elementY)
			maxX = Math.max(maxX, elementX + size + dim.border * 2)
			maxY = Math.max(maxY, elementY + size + dim.border * 2)
			y -= size + dim.border * 2 + dim.gap
		}
		box.style.left = `${minX - dim.padding}px`
		box.style.top = `${minY - dim.padding}px`
		box.style.width = `${maxX - minX + dim.padding * 2}px`
		box.style.height = `${maxY - minY + dim.padding * 2}px`
		box.style.display = "block"
		return
	}

	let x = centerX - (stack[0][2] + dim.border * 2) / 2
	let y = centerY + (stack[0][2] + dim.border * 2) / 2
	for (const [, element, size] of stack) {
		const elementX = Math.floor(x)
		const elementY = Math.floor(y - size - dim.border * 2)
		setMapCounterPosition(element, elementX, elementY)
		element.style.zIndex = String(z)
		x += dx
		y = Math.max(50, y - dy)
		z += dz
	}
}

function updatePieces() {
	const stacks = new Map()
	const offMapStacks = new Map()
	const reinforcementBoard = reinforcementBoardElement || document.getElementById("reinforcement_board")
	for (const slot of reinforcementSlotElements.values()) slot.classList.remove("occupied")
	const reducedPieces = idSet(view?.reduced)
	const advancing = view?.state === "combat_advance"
	const reinforcementPiece = view?.reinforcement?.lcus?.[view.reinforcement.index]
	const replacementPiece = view?.replacement?.piece_id
	const entrenchingPieceIds = view?.action?.entrenching?.map?.((attempt) => attempt.piece_id)
	const selectedPieces = idSet(
		advancing ? view?.combat?.advance_pieces : view?.combat?.attackers,
		advancing ? [] : view?.combat?.defenders,
		view?.action?.move?.pieces,
		view?.action?.piece == null ? [] : [view.action.piece],
		reinforcementPiece == null ? [] : [reinforcementPiece],
		replacementPiece == null ? [] : [replacementPiece],
		entrenchingPieceIds,
		view?.event_selection?.panzer_refit_pieces,
		view?.event_selection?.final_production_surge_pieces,
		view?.event_selection?.banzai_pieces,
		view?.event_selection?.extra_attack_piece == null ? [] : [view.event_selection.extra_attack_piece],
	)
	const spentPieces = idSet(view?.action?.moved, view?.action?.used_pieces)
	currentStacks.clear()
	currentOffMapStacks.clear()
	for (const [spaceId, markers] of currentMarkerStacks) stacks.set(spaceId, markers.slice())
	for (const [pieceIdText, location] of Object.entries(view?.pieces || {})) {
		const pieceId = Number(pieceIdText)
		const piece = BTB.pieces[pieceId]
		if (!piece || piece.size === "marker") continue
		const element = ensurePiece(pieceId)
		const size = pieceSize(piece)
		setPieceDimensions(element, size)
		const reduced = reducedPieces.has(String(pieceId)) || ((location === "available" || String(location).startsWith("setup_choice:")) && PRINTED_REDUCED_REINFORCEMENTS.has(pieceId))
		const asset = pieceAsset(piece, reduced)
		if (element.dataset.faceAsset !== asset) {
			element.dataset.faceAsset = asset
			element.style.backgroundImage = `url("${asset}")`
		}
		const canSelect = isLegal("piece", pieceId)
		const canEntrench = isLegal("entrench", pieceId)
		element.classList.toggle("highlight", canSelect || canEntrench)
		element.classList.toggle("space-target", !canSelect && !canEntrench && typeof location === "number" && spaceClickIntent(location).type !== "none")
		const selected = selectedPieces.has(String(pieceId)) || view?.combat?.retreat_piece === pieceId
		element.classList.toggle("selected", Boolean(selected))
		element.classList.toggle("spent", spentPieces.has(String(pieceId)))
		if (typeof location === "number" && location > 0 && BTB.spaces[location]) {
			element.dataset.zoneTarget = ""
			element.dataset.offMapKey = ""
			if (!stacks.has(location)) stacks.set(location, [])
			stacks.get(location).push([pieceId, element, size, stackPieceRank(piece, reduced)])
			continue
		}
		element.dataset.spaceId = ""
		element.dataset.offMapKey = ""
		element.dataset.zoneTarget = String(location).startsWith("reserve:") ? String(location) : ""
		element.classList.remove("stack", "stack-top")
		element.style.zIndex = ""
		const runtimeSide = piece.side === "neutral" ? view.neutrals?.[piece.nation]?.controller || "neutral" : piece.side
		const reinforcementSlot = REINFORCEMENT_SLOTS.get(pieceId)
		if ((location === "available" || String(location).startsWith("setup_choice:")) && reinforcementSlot && reinforcementBoard) {
			const boardSize = Number(reinforcementSlot.w) || reinforcementPieceSize(piece)
			setPieceDimensions(element, boardSize)
			if (element.parentElement !== reinforcementBoard) reinforcementBoard.append(element)
			setMapCounterPosition(element, Math.round(reinforcementSlot.x - boardSize / 2), Math.round(reinforcementSlot.y - boardSize / 2))
			element.style.zIndex = "20"
			element.hidden = false
			element.title = `#${pieceId} ${pieceStatusText(pieceId)}`
			reinforcementSlotElements.get(pieceId)?.classList.add("occupied")
		} else {
			const offMapKey = offMapDisplayKey(location, runtimeSide)
			if (offMapKey) {
				element.dataset.offMapKey = offMapKey
				if (!offMapStacks.has(offMapKey)) offMapStacks.set(offMapKey, [])
				offMapStacks.get(offMapKey).push([pieceId, element, size])
			} else element.hidden = true
		}
	}

	const mapLayer = document.getElementById("piece-overlay")
	for (const [key, entries] of offMapStacks) {
		entries.sort((a, b) => a[0] - b[0])
		currentOffMapStacks.set(key, entries)
		for (const [pieceId, element] of entries) {
			if (element.parentElement !== mapLayer) mapLayer.append(element)
			element.hidden = false
			element.title = `#${pieceId} ${pieceStatusText(pieceId)}`
		}
		layoutOffMapPieces(key, entries)
	}
	for (const [spaceId, stack] of stacks) {
		stack.sort(compareStackEntries)
		currentStacks.set(spaceId, stack)
		for (let index = 0; index < stack.length; ++index) {
			const [counterId, element] = stack[index]
			if (element.parentElement !== mapLayer) mapLayer.append(element)
			element.hidden = false
			element.dataset.spaceId = String(spaceId)
			if (!element.classList.contains("piece")) continue
			const pieceId = counterId
			element.classList.toggle("stack", stack.length > 1)
			element.classList.toggle("stack-top", index === stack.length - 1)
			element.title = `#${pieceId} ${pieceStatusText(pieceId)}`
		}
		layoutStack(spaceId, stack)
	}
	if (focusedStack !== null && (currentStacks.get(focusedStack)?.length || 0) <= 1) focusedStack = null
	if (focusedOffMapStack !== null && !offMapStackNeedsFocus(focusedOffMapStack, currentOffMapStacks.get(focusedOffMapStack))) focusedOffMapStack = null
	if (focusedStack === null && focusedTrackStack === null && focusedOffMapStack === null) hideFocusBox()
}

function cardPopupPoint(event, element) {
	if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) return { clientX: event.clientX, clientY: event.clientY }
	const rect = element?.getBoundingClientRect()
	return rect
		? {
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + Math.min(80, rect.height / 3),
			}
		: { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }
}

function hideCardPopup() {
	const menu = document.getElementById("card_popup")
	if (menu) menu.hidden = true
}

function showCardPopup(point, cardId, element) {
	const menu = document.getElementById("card_popup")
	const card = BTB.cards[cardId]
	if (!menu || !card) return
	hideCardPopup()
	const enabledActions = new Set(cardMenuActions(cardId))

	const title = menu.querySelector(".title")
	title.textContent = cardDisplayName(card)
	title.onclick = (event) => {
		event.stopPropagation()
		hideCardPopup()
	}
	for (const item of menu.querySelectorAll("li[data-action]")) {
		const action = item.dataset.action
		const direct = isLegal(action, cardId)
		const enabled = enabledActions.has(action)
		item.classList.remove("hide")
		item.classList.toggle("action", enabled)
		item.classList.toggle("disabled", !enabled)
		item.onclick = enabled
			? (event) => {
					event.stopPropagation()
					hideCardPopup()
					if (direct) send_action(action, cardId)
					else send_action(action)
				}
			: null
	}

	menu.hidden = false
	const anchor = cardPopupPoint(point, element)
	const width = menu.offsetWidth
	const height = menu.offsetHeight
	const left = Math.max(5, Math.min(anchor.clientX - width / 2, window.innerWidth - width - 5))
	const top = Math.max(5, Math.min(anchor.clientY - 12, window.innerHeight - height - 40))
	menu.style.left = `${left}px`
	menu.style.top = `${top}px`
}

function ensureCardElement(cardId) {
	let element = cardElements.get(cardId)
	if (element) return element
	const card = BTB.cards[cardId]
	if (!card) return null
	element = document.createElement("div")
	element.dataset.cardId = String(cardId)
	element.addEventListener("click", (event) => {
		event.stopPropagation()
		if (!element.classList.contains("combat-card") && cardMenuActions(cardId).length > 0) {
			showCardPopup(event, cardId, element)
			return
		}
		if (isLegal("card", cardId)) {
			send_action("card", cardId)
			return
		}
		if (!element.classList.contains("combat-card")) showCardPopup(event, cardId, element)
	})
	cardElements.set(cardId, element)
	return element
}

function updateCardAppearance(element, cardId, compact = false) {
	const card = BTB.cards[cardId]
	if (!element || !card) return
	element.className = `card ${card.side === "allied" ? "ap" : "cp"}${compact ? " combat-card" : ""}`
	const direct = isLegal("card", cardId) || cardMenuActions(cardId).length > 0
	element.classList.toggle("enabled", direct)
	element.classList.toggle("highlight", compact ? direct : isLegal("play_event", cardId))
	element.style.backgroundImage = `url("${cardAsset(cardId)}")`
	element.title = `${card.num}. ${cardDisplayName(card)}`
}

function updateCards() {
	const layer = document.getElementById("cards")
	const hand = view?.hand || []
	const legalChoices = Array.isArray(view?.actions?.card) ? view.actions.card : []
	const retainedCards = new Set(sideCardIds(view?.combat_cards))
	const displayChoices = legalChoices.filter((cardId) => !retainedCards.has(cardId))
	const cards = [...new Set([...hand, ...displayChoices])]
	const combatDisplay = combatCardDisplay()
	const hasExternalChoice = displayChoices.some((cardId) => !hand.includes(cardId))
	document.getElementById("cards_head").textContent = uiText(hasExternalChoice ? "ui.cards.choose" : "ui.hand")
	const activeCards = new Set([...cards, ...combatDisplay.played, ...combatDisplay.retained])
	for (const [cardId, element] of cardElements) {
		if (activeCards.has(cardId)) continue
		element.remove()
		cardElements.delete(cardId)
	}
	const fragment = document.createDocumentFragment()
	for (const cardId of cards) {
		const card = BTB.cards[cardId]
		if (!card) continue
		const element = ensureCardElement(cardId)
		updateCardAppearance(element, cardId)
		fragment.append(element)
	}
	layer.replaceChildren(fragment)
	hideCardPopup()
}

function combatCardElement(cardId) {
	const element = ensureCardElement(cardId)
	updateCardAppearance(element, cardId, true)
	return element
}

function queryCardElement(cardId) {
	const card = BTB.cards[cardId]
	if (!card) return null
	const element = document.createElement("div")
	element.className = `card query-card ${card.side === "allied" ? "ap" : "cp"}`
	element.style.backgroundImage = `url("${cardAsset(cardId)}")`
	element.title = `${card.num}. ${cardDisplayName(card)}`
	element.setAttribute("role", "img")
	element.setAttribute("aria-label", element.title)
	return element
}

function showCardQuery(title, groups) {
	const panel = document.getElementById("card_list_panel")
	const body = document.getElementById("card_list_body")
	document.getElementById("card_list_title").textContent = title
	body.replaceChildren()
	let cardCount = 0
	for (const group of groups) {
		if (!group.cards.length) continue
		cardCount += group.cards.length
		const section = document.createElement("section")
		const heading = document.createElement("h3")
		const list = document.createElement("div")
		heading.textContent = uiText("ui.cards.group_count", { title: group.title, count: group.cards.length })
		list.className = "card-query-list"
		list.replaceChildren(...group.cards.map(queryCardElement).filter(Boolean))
		section.append(heading, list)
		body.append(section)
	}
	if (!cardCount) {
		const empty = document.createElement("p")
		empty.className = "card-query-empty"
		empty.textContent = uiText("ui.cards.none")
		body.append(empty)
	}
	panel.hidden = false
}

function hideCardQuery() {
	const panel = document.getElementById("card_list_panel")
	if (panel) panel.hidden = true
}

function on_reply(query, params) {
	const groups = cardQueryGroups(query, params)
	if (groups) {
		showCardQuery(uiText(query === "discard" ? "ui.cards.discard" : "ui.cards.removed"), groups)
		return
	}
	if (query === "allied_supply" || query === "axis_supply") showSupplyOverlay(query, params)
}

function hideSupplyOverlay() {
	for (const element of pieceElements.values()) element.classList.remove("supply-limited", "supply-oos")
	shownSupplyQuery = null
	setMenuCheck("supply_allied", false)
	setMenuCheck("supply_axis", false)
}

function showSupplyOverlay(query, result) {
	hideSupplyOverlay()
	if (!result?.pieces || !["allied", "axis"].includes(result.side)) return
	shownSupplyQuery = query
	setMenuCheck(query === "allied_supply" ? "supply_allied" : "supply_axis", true)
	for (const [pieceId, status] of Object.entries(result.pieces)) {
		if (!["limited", "oos"].includes(status)) continue
		pieceElements.get(Number(pieceId))?.classList.add(`supply-${status}`)
	}
	const counts = supplyStatusCounts(result)
	showStatus(
		uiText("ui.supply.summary", {
			side: uiText(result.side === "allied" ? "core.role.allied" : "core.role.axis"),
			full: counts.full,
			limited: counts.limited,
			oos: counts.oos,
		}),
	)
	document.getElementById("mapwrap").scrollIntoView({ behavior: motionBehavior(), block: "start" })
}

function updateCombatCards() {
	const panel = document.getElementById("combat_cards_panel")
	const { played, retained } = combatCardDisplay()
	const cards = [...played, ...retained]
	document.getElementById("combat_cards").replaceChildren(...cards.map(combatCardElement).filter(Boolean))
	panel.hidden = cards.length === 0
}

function updateEventMarkers() {
	const panel = document.getElementById("event_markers_panel")
	const markers = eventMarkerDescriptors()
	const activeKeys = new Set(markers.map((marker) => marker.key))
	for (const marker of markers) {
		let element = eventMarkerElements.get(marker.key)
		if (!element) {
			element = document.createElement("img")
			element.className = "event-marker"
			eventMarkerElements.set(marker.key, element)
		}
		const source = `images/${encodeURIComponent(marker.asset)}`
		if (element.getAttribute("src") !== source) element.src = source
		element.alt = marker.title
		element.title = marker.title
		const group = document.getElementById(`event_markers_${marker.side}`)
		if (element.parentElement !== group) group.append(element)
	}
	for (const [key, element] of eventMarkerElements) {
		if (activeKeys.has(key)) continue
		eventMarkerElements.delete(key)
		element.remove()
	}
	for (const side of ["allied", "axis"]) {
		const group = document.getElementById(`event_markers_${side}_group`)
		group.hidden = !markers.some((marker) => marker.side === side)
	}
	panel.hidden = markers.length === 0
}

function renderOffMapHotspots() {
	document.getElementById("offmap-hotspots")?.remove()
	offMapHotspots.length = 0
	offMapPoolActions.length = 0
	const overlay = document.createElement("div")
	overlay.id = "offmap-hotspots"
	for (const [target, [x, y, width, height]] of Object.entries(OFF_MAP_BOXES)) {
		const hotspot = document.createElement("div")
		hotspot.className = "offmap_hotspot"
		hotspot.dataset.target = target
		Object.assign(hotspot.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` })
		const badge = document.createElement("span")
		badge.textContent = "0"
		hotspot.append(badge)
		offMapHotspots.push({ element: hotspot, badge })
		const moveTarget = reinforcementMoveTarget(target)
		if (moveTarget) {
			const action = document.createElement("button")
			action.type = "button"
			action.className = "offmap_pool_action"
			action.textContent = uiText("ui.reinforcement.enter_reserve")
			action.dataset.moveTarget = moveTarget
			action.addEventListener("click", (event) => {
				if (!isLegal("move", moveTarget)) return
				event.stopPropagation()
				send_action("move", moveTarget)
			})
			hotspot.append(action)
			offMapPoolActions.push(action)
		}
		overlay.append(hotspot)
	}
	document.getElementById("map").append(overlay)
}

function updateOffMapBoards() {
	const playable = new Set(view?.actions?.play_event || [])
	for (const hotspot of reinforcementCardHotspots) {
		const legal = playable.has(Number(hotspot.dataset.cardId))
		hotspot.classList.toggle("legal", legal)
		hotspot.disabled = !legal
		hotspot.setAttribute("aria-disabled", String(!legal))
	}
	const consumedCards = idSet(view?.removed?.allied, view?.removed?.axis, view?.active_event_card_id == null ? [] : [view.active_event_card_id])
	for (const { element, slot, cardIds } of reinforcementTokenElements) {
		const available = !cardIds.some((cardId) => consumedCards.has(String(cardId)))
		element.hidden = !available
		slot.classList.toggle("occupied", available)
	}
	const counts = new Map()
	for (const unit of view?.off_map_units || []) {
		const poolSide = unit.pool_side || unit.side
		const key = unit.location === "eliminated" ? `${poolSide}_eliminated` : unit.location === "reserve" ? `${poolSide}_reserve` : null
		if (key) counts.set(key, (counts.get(key) || 0) + 1)
	}
	for (const { element, badge } of offMapHotspots) badge.textContent = String(counts.get(element.dataset.target) || 0)
}

function renderReinforcements() {
	const container = document.getElementById("reinforcements")
	container.replaceChildren()
	const wrap = document.getElementById("reinforcements_wrap")
	const eventMarkerTray = document.getElementById("event_markers_panel")
	if (eventMarkerTray && eventMarkerTray.parentElement !== wrap) wrap.insertBefore(eventMarkerTray, container)
	const board = document.createElement("section")
	reinforcementBoardElement = board
	reinforcementCardHotspots.length = 0
	reinforcementSlotElements.clear()
	reinforcementTokenElements.length = 0
	board.id = "reinforcement_board"
	board.className = "reinforcement_board"
	board.setAttribute("aria-label", uiText("ui.reinforcement.board_label"))
	board.style.width = `${REINFORCEMENT_BOARD.width}px`
	board.style.height = `${REINFORCEMENT_BOARD.height}px`
	for (const slot of REINFORCEMENT_BOARD.slots || []) {
		const backplate = document.createElement("div")
		backplate.className = "reinforcement_slot_backplate"
		backplate.dataset.pieceId = String(slot.piece_id)
		Object.assign(backplate.style, {
			left: `${slot.x - slot.w / 2}px`,
			top: `${slot.y - slot.h / 2}px`,
			width: `${slot.w}px`,
			height: `${slot.h}px`,
		})
		reinforcementSlotElements.set(Number(slot.piece_id), backplate)
		board.append(backplate)
	}
	for (const tokenSpec of REINFORCEMENT_BOARD.tokens || []) {
		const backplate = document.createElement("div")
		backplate.className = "reinforcement_slot_backplate reinforcement_token_slot"
		Object.assign(backplate.style, {
			left: `${tokenSpec.x - tokenSpec.w / 2}px`,
			top: `${tokenSpec.y - tokenSpec.h / 2}px`,
			width: `${tokenSpec.w}px`,
			height: `${tokenSpec.h}px`,
		})
		const token = document.createElement("img")
		token.className = "reinforcement_board_token"
		token.alt = ""
		token.src = tokenSpec.token === "atlantic_wall_trench" ? "images/Atlantic Wall Trench.jpg" : "images/German Trench.jpg"
		Object.assign(token.style, {
			left: `${tokenSpec.x - tokenSpec.w / 2}px`,
			top: `${tokenSpec.y - tokenSpec.h / 2}px`,
			width: `${tokenSpec.w}px`,
			height: `${tokenSpec.h}px`,
		})
		reinforcementTokenElements.push({ element: token, slot: backplate, cardIds: tokenSpec.card_ids.map(Number) })
		board.append(backplate, token)
	}
	for (const area of REINFORCEMENT_BOARD.card_areas || []) {
		const vertical = area.h > 150
		for (let index = 0; index < area.card_ids.length; index++) {
			const cardId = Number(area.card_ids[index])
			const card = BTB.cards[cardId]
			if (!card) continue
			const hotspot = document.createElement("button")
			const width = vertical ? area.w : area.w / area.card_ids.length
			const height = vertical ? area.h / area.card_ids.length : area.h
			const left = area.x + (vertical ? 0 : index * width)
			const top = area.y + (vertical ? index * height : 0)
			hotspot.type = "button"
			hotspot.className = "reinforcement_card_hotspot"
			hotspot.dataset.cardId = String(cardId)
			hotspot.title = `${card.side === "axis" ? "Axis" : "Allied"} #${card.num} ${uiLocale === "en" ? card.name : card.name_zh}`
			hotspot.setAttribute("aria-label", hotspot.title)
			Object.assign(hotspot.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })
			hotspot.addEventListener("click", () => {
				if (isLegal("play_event", cardId)) send_action("play_event", cardId)
			})
			reinforcementCardHotspots.push(hotspot)
			board.append(hotspot)
		}
	}
	const caption = document.createElement("p")
	caption.className = "reinforcement_caption"
	caption.textContent = uiText("ui.reinforcement.caption")
	container.append(board, caption)
	renderOffMapHotspots()
}

function updateInfo() {
	const alliedHand = document.getElementById("allied_hand")
	alliedHand.textContent = uiText("ui.cards.count", { count: view?.hand_count?.allied ?? 0 })
	alliedHand.title = ""
	document.getElementById("axis_hand").textContent = uiText("ui.cards.count", { count: view?.hand_count?.axis ?? 0 })
	document.getElementById("allied_deck_size").textContent = uiText("ui.cards.deck_count", { side: uiText("core.role.allied"), count: view?.deck_count?.allied ?? 0 })
	document.getElementById("axis_deck_size").textContent = uiText("ui.cards.deck_count", { side: uiText("core.role.axis"), count: view?.deck_count?.axis ?? 0 })
	const rpSummary = replacementPointSummary(view?.rp)
	const rpElement = document.getElementById("rp_summary")
	rpElement.textContent = rpSummary
	rpElement.hidden = !rpSummary
}

function updateReinforcementTargets() {
	for (const action of offMapPoolActions) {
		const legal = isLegal("move", action.dataset.moveTarget)
		action.hidden = !legal
		action.disabled = !legal
		action.closest(".offmap_hotspot")?.classList.toggle("move-target", legal)
	}
}

function setCollaborationMenuDisabled(id, disabled) {
	const element = document.getElementById(id)
	if (!element) return
	element.classList.toggle("disabled", disabled)
	element.setAttribute("aria-disabled", String(disabled))
}

function canFlagSupplyWarnings() {
	return isAvailable("flag_supply_warnings")
}

function flagSupplyWarnings() {
	if (canFlagSupplyWarnings()) send_action("flag_supply_warnings")
}

function canProposeRollback() {
	return Array.isArray(view?.actions?.propose_rollback) && view.actions.propose_rollback.length > 0 && Array.isArray(view?.rollback)
}

function rollbackPoint(index) {
	return Array.isArray(view?.rollback) && index >= 0 && index < view.rollback.length ? view.rollback[index] : null
}

function renderRollbackDetails(target, point) {
	if (!target) return
	target.replaceChildren()
	if (!point) {
		target.textContent = uiText("ui.rollback.none")
		return
	}
	const title = document.createElement("strong")
	title.textContent = point.name
	const summary = document.createElement("p")
	const removedLogCount = Math.max(0, (view?.log?.length || 0) - Number(point.log_index || 0))
	summary.textContent = uiText("ui.rollback.removed_log_count", { count: removedLogCount })
	target.append(title, summary)
	const entries = Array.isArray(view?.log) ? view.log.slice(Number(point.log_index || 0), Number(point.log_index || 0) + 8) : []
	if (entries.length) {
		const list = document.createElement("ol")
		for (const entry of entries) {
			const item = document.createElement("li")
			item.textContent = String(entry).replace(/^\.[a-z0-9]+\s+/i, "")
			list.append(item)
		}
		target.append(list)
	}
}

function updateRollbackDialog() {
	const select = document.getElementById("rollback_checkpoint")
	renderRollbackDetails(document.getElementById("propose_rollback_details"), rollbackPoint(Number(select?.value)))
}

function openRollbackProposal() {
	if (!canProposeRollback()) return
	const select = document.getElementById("rollback_checkpoint")
	select.replaceChildren()
	for (const index of view.actions.propose_rollback.slice().reverse()) {
		const point = rollbackPoint(Number(index))
		if (!point) continue
		const option = document.createElement("option")
		option.value = String(index)
		option.textContent = point.name
		select.append(option)
	}
	updateRollbackDialog()
	document.getElementById("propose_rollback_dialog").showModal()
}

function closeRollbackProposal() {
	document.getElementById("propose_rollback_dialog")?.close()
}

function submitRollbackProposal() {
	const index = Number(document.getElementById("rollback_checkpoint")?.value)
	if (!isLegal("propose_rollback", index)) return
	closeRollbackProposal()
	send_action("propose_rollback", index)
}

function openRollbackReview() {
	if (!view?.rollback_proposal || !isAvailable("accept") || !isAvailable("reject")) return
	renderRollbackDetails(document.getElementById("review_rollback_details"), rollbackPoint(Number(view.rollback_proposal.index)))
	document.getElementById("review_rollback_dialog").showModal()
}

function closeRollbackReview() {
	document.getElementById("review_rollback_dialog")?.close()
}

function acceptRollbackProposal() {
	if (!isAvailable("accept")) return
	closeRollbackReview()
	send_action("accept")
}

function rejectRollbackProposal() {
	if (!isAvailable("reject")) return
	closeRollbackReview()
	send_action("reject")
}

function updateCollaborationControls() {
	const warningCount = view?.supply_warnings?.length || 0
	const warningMenu = document.getElementById("flag_supply_warning_menu")
	if (warningMenu) {
		warningMenu.textContent = uiText(warningCount ? "ui.warning.flag_count" : "ui.warning.flag", { ...(warningCount ? { count: warningCount } : {}) })
		warningMenu.classList.toggle("warning-active", warningCount > 0)
	}
	setCollaborationMenuDisabled("flag_supply_warning_menu", !canFlagSupplyWarnings())
	setCollaborationMenuDisabled("propose_rollback_menu", !canProposeRollback())
	const canReview = Boolean(view?.rollback_proposal && isAvailable("accept") && isAvailable("reject"))
	const reviewButton = document.getElementById("review_rollback_button")
	if (reviewButton) reviewButton.hidden = !canReview
	if (!canReview && document.getElementById("review_rollback_dialog")?.open) closeRollbackReview()
	if (!canProposeRollback() && document.getElementById("propose_rollback_dialog")?.open) closeRollbackProposal()
}

function renderActionButtons() {
	const labels = {
		play_ops: "ui.action.ops",
		play_sr: "ui.action.sr",
		play_rp: "ui.action.rp",
		play_event: "ui.action.event",
		apply_attrition: "ui.action.apply_attrition",
		single_beachhead: "ui.action.single_beachhead",
		double_beachheads: "ui.action.double_beachheads",
		auto_ops: "ui.action.auto_ops",
		declare_turkey: "ui.action.declare_turkey",
		declare_sweden: "ui.action.declare_sweden",
		place_partisan: "ui.action.place_partisan",
		confirm: "ui.action.confirm",
		cancel: "ui.action.cancel",
		cancel_selection: "ui.action.cancel_selection",
		yes: "ui.action.yes",
		no: "ui.action.no",
		continue: "ui.action.continue",
		select_all: "ui.action.select_all",
		discard_all: "ui.action.discard_all",
		end_invasions: "ui.action.end_invasions",
		reserve: "ui.action.reserve",
		stalin: "ui.action.stalin",
		move_marker: "ui.action.move_marker",
		combat_marker: "ui.action.combat_marker",
		yellow_ops: "ui.action.yellow_ops",
		done: "ui.action.done",
		roll: "ui.action.roll",
		stop: "ui.action.stop",
		pass: "ui.action.pass",
		med: "ui.action.med",
		nwe: "ui.action.nwe",
		undo: "ui.action.undo",
		accept: "ui.action.accept_rollback",
		reject: "ui.action.reject_rollback",
	}
	Object.assign(labels, STATE_ACTION_LABELS[view?.state] || {})
	if (view?.state === "ops_activate") {
		labels.done = view?.action?.move_spaces?.length ? "ui.action.enter_move" : view?.action?.attack_spaces?.length ? "ui.action.enter_combat" : "ui.action.end_action"
	}
	if (view?.state === "ops_move") {
		labels.done = view?.action?.entrenching?.length ? "ui.action.resolve_entrenchment" : view?.action?.attack_spaces?.length ? "ui.action.enter_combat" : "ui.action.end_action"
	}
	for (const [verb, key] of Object.entries(labels)) {
		if (CARD_MENU_ACTIONS.includes(verb) && Array.isArray(view?.actions?.[verb])) continue
		action_button(verb, BTBI18N.render(uiLocale, key))
	}
}

function updateHeaderActiveColor() {
	const header = document.querySelector("header")
	if (!header) return
	const isAllied = view?.active === "Allied"
	const isAxis = view?.active === "Axis"
	const isWaiting = Boolean(view?.waiting) || !view?.actions
	header.classList.toggle("Allied", isAllied)
	header.classList.toggle("Axis", isAxis)
	header.style.backgroundColor = isWaiting ? "white" : isAllied ? "lightcoral" : isAxis ? "lightsteelblue" : ""
}

function on_update() {
	hideActivationPopup()
	if (shownSupplyQuery) hideSupplyOverlay()
	rebuildInteractionCache()
	updateHeaderActiveColor()
	updateInfo()
	updateCollaborationControls()
	updateSpaces()
	updateMapMarkers()
	updateTrackMarkers()
	updateOffMapBoards()
	updatePieces()
	updateReinforcementTargets()
	updateCards()
	updateCombatCards()
	updateEventMarkers()
	renderActionButtons()
}

globalThis.init_replay = function initReplay() {
	const script = document.createElement("script")
	script.src = "replay.js"
	document.body.appendChild(script)
}
globalThis.on_update = on_update
globalThis.on_init = on_init
globalThis.on_log = on_log
globalThis.on_prompt = on_prompt
globalThis.on_click_card_tip = on_click_card_tip
globalThis.on_focus_card_tip = on_focus_card_tip
globalThis.on_blur_card_tip = on_blur_card_tip
globalThis.on_click_space_tip = on_click_space_tip
globalThis.on_click_piece_tip = on_click_piece_tip
globalThis.set_style = set_style
globalThis.set_mouse_focus = set_mouse_focus
globalThis.toggle_counters = toggle_counters
globalThis.to_reinforcements = to_reinforcements
globalThis.on_reply = on_reply
globalThis.hideCardQuery = hideCardQuery
globalThis.hideSupplyOverlay = hideSupplyOverlay
globalThis.flagSupplyWarnings = flagSupplyWarnings
globalThis.openRollbackProposal = openRollbackProposal
globalThis.closeRollbackProposal = closeRollbackProposal
globalThis.submitRollbackProposal = submitRollbackProposal
globalThis.updateRollbackDialog = updateRollbackDialog
globalThis.openRollbackReview = openRollbackReview
globalThis.closeRollbackReview = closeRollbackReview
globalThis.acceptRollbackProposal = acceptRollbackProposal
globalThis.rejectRollbackProposal = rejectRollbackProposal

renderSpaces()
renderReinforcements()
document.getElementById("card_popup").addEventListener("mouseleave", () => hideCardPopup())
document.getElementById("activation_popup").addEventListener("mouseleave", () => hideActivationPopup())
document.addEventListener("click", (event) => {
	if (!event.target.closest?.("#card_popup, .card")) hideCardPopup()
	if (!event.target.closest?.("#activation_popup, .space, .piece")) hideActivationPopup()
})
document.getElementById("map").addEventListener("click", () => focusStack(null))
set_style(localStorage.getItem("btb.style") || "bevel")
set_mouse_focus(Number(localStorage.getItem("btb.mouseFocus") || 0))

// Match the PUG desktop opening view: show the whole board at the available width,
// while keeping Rally's zoom control available for full-size inspection.
const mapwrap = document.getElementById("mapwrap")
if (mapwrap && window.innerWidth > 800) {
	mapwrap.dataset.fitCycle = "width-both"
	mapwrap.dataset.fit = "width"
	window.addEventListener("load", () => {
		if (typeof window.update_zoom === "function") window.update_zoom()
	})
	if (typeof window.update_zoom === "function") window.update_zoom()
}
