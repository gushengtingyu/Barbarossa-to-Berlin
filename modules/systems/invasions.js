"use strict"

const { ALLIED, AXIS } = require("../core/constants.js")
const I18n = require("../core/i18n.js")
const { clearUndo, log, pieceLogRef } = require("../core/state.js")
const Locations = require("../core/unit_locations.js")
const Neutrals = require("./neutrals.js")
const Reinforcements = require("./reinforcements.js")
const ReinforcementManifest = require("./reinforcement_manifest.js")

const NORTH_AFRICA_BLOCK_NATIONS = Object.freeze(new Set(["dz", "tn", "ly", "eg"]))
const NORTH_AFRICA_BLOCKED_BEACHES = Object.freeze(new Set(["J", "M", "N", "O", "P", "Q", "R", "T", "U"]))
const SYRACUSE_BLOCKED_BEACHES = Object.freeze(new Set(["J", "O", "R"]))
const WINTER_TURNS = Object.freeze(new Set([4, 8, 12, 16]))
const BEACH_LINKS = Object.freeze(new Set(["A:B", "D:E", "F:G", "K:L", "P:Q"]))
const CONVERTIBLE_REINFORCEMENT_CARDS = Object.freeze(new Set([34, 45, 46, 52]))

const SPECS = Object.freeze({
	1: Object.freeze({
		name: "Torch",
		name_zh: "火炬行动",
		letters: Object.freeze(["K", "L", "S"]),
		marker_options: Object.freeze([
			Object.freeze({
				key: "single",
				markers: Object.freeze(["allied"]),
			}),
			Object.freeze({
				key: "double",
				markers: Object.freeze(["allied", "us"]),
			}),
		]),
		landing: Object.freeze([Object.freeze({ name: "BR 1 Army", reduced: true }), Object.freeze({ nation: "us", size: "scu", count: 2 })]),
		reserve: Object.freeze([]),
		event_flag: "torch",
	}),
	16: Object.freeze({
		name: "Sledgehammer",
		name_zh: "大锤行动",
		letters: Object.freeze(["A", "B", "D"]),
		marker_options: Object.freeze([
			Object.freeze({
				key: "single",
				markers: Object.freeze(["allied"]),
			}),
		]),
		landing: Object.freeze([Object.freeze({ name: "BR 1 Army", reduced: true }), Object.freeze({ nation: "us", size: "scu", count: 2 })]),
		reserve: Object.freeze([]),
		event_flag: "sledgehammer",
	}),
	33: Object.freeze({
		name: "Overlord",
		name_zh: "霸王行动",
		letters: Object.freeze("ABCDEFGHI".split("")),
		marker_options: Object.freeze([
			Object.freeze({
				key: "single",
				markers: Object.freeze(["allied"]),
			}),
			Object.freeze({
				key: "double",
				markers: Object.freeze(["br", "us"]),
			}),
		]),
		landing: Object.freeze([Object.freeze({ name: "BR 2 Army", reduced: false }), Object.freeze({ name: "US 1 Army", reduced: false })]),
		reserve: Object.freeze([Object.freeze({ nation: "br", size: "scu", count: 1 }), Object.freeze({ nation: "us", size: "scu", count: 2 })]),
		min_turn: 13,
		block_event: "round_up",
		event_flag: "overlord",
	}),
	34: Object.freeze({
		name: "Husky",
		name_zh: "哈士奇行动",
		letters: Object.freeze(["N", "O", "P", "Q", "R", "S", "U"]),
		marker_options: Object.freeze([
			Object.freeze({
				key: "single",
				markers: Object.freeze(["allied"]),
			}),
			Object.freeze({
				key: "double",
				markers: Object.freeze(["br", "us"]),
			}),
		]),
		landing: Object.freeze([
			Object.freeze({
				name: "BR 8 Army",
				reduced: true,
				reserve_required: true,
			}),
			Object.freeze({
				name: "US 7 Army",
				reduced: true,
				reserve_allowed: true,
			}),
		]),
		reserve: Object.freeze([Object.freeze({ nation: "us", size: "scu", count: 1 })]),
		event_flag: "husky",
	}),
	45: Object.freeze({
		name: "Avalanche",
		name_zh: "雪崩行动",
		letters: Object.freeze(["N", "O", "P", "Q", "R", "S", "U"]),
		marker_options: Object.freeze([
			Object.freeze({
				key: "single",
				markers: Object.freeze(["allied"]),
			}),
		]),
		landing: Object.freeze([Object.freeze({ name: "US 5 Army", reduced: true })]),
		reserve: Object.freeze([Object.freeze({ nation: "br", size: "scu", count: 1 })]),
		block_if_us7_on_map: true,
		event_flag: "avalanche",
	}),
	46: Object.freeze({
		name: "Shingle",
		name_zh: "鹅卵石行动",
		letters: Object.freeze("KLMNOPQRSTU".split("")),
		marker_options: Object.freeze([
			Object.freeze({
				key: "single",
				markers: Object.freeze(["allied"]),
			}),
		]),
		landing: Object.freeze([Object.freeze({ nation: "us", size: "scu", count: 1 }), Object.freeze({ nation: "br", size: "scu", count: 1 })]),
		reserve: Object.freeze([]),
		block_if_us7_on_map: true,
		shingle: true,
		event_flag: "shingle",
	}),
	50: Object.freeze({
		name: "Round-Up",
		name_zh: "围捕行动",
		letters: Object.freeze(["A", "B", "D", "E"]),
		marker_options: Object.freeze([
			Object.freeze({
				key: "double",
				markers: Object.freeze(["br", "us"]),
			}),
		]),
		landing: Object.freeze([Object.freeze({ name: "BR 2 Army", reduced: true }), Object.freeze({ name: "US 1 Army", reduced: true })]),
		reserve: Object.freeze([Object.freeze({ nation: "br", size: "scu", count: 1 }), Object.freeze({ nation: "us", size: "scu", count: 2 })]),
		block_event: "overlord",
		event_flag: "round_up",
	}),
	52: Object.freeze({
		name: "Anvil-Dragoon",
		name_zh: "铁砧-龙骑兵行动",
		letters: Object.freeze(["J"]),
		marker_options: Object.freeze([
			Object.freeze({
				key: "single",
				markers: Object.freeze(["allied"]),
			}),
		]),
		landing: Object.freeze([
			Object.freeze({
				name: "US 7 Army",
				reduced: true,
				reserve_allowed: true,
			}),
			Object.freeze({ name: "FF Army", reduced: true }),
		]),
		reserve: Object.freeze([Object.freeze({ nation: "us", size: "scu", count: 1 }), Object.freeze({ nation: "ff", size: "scu", count: 1 })]),
		event_flag: "anvil_dragoon",
	}),
})

function beachLetter(space) {
	if (/^[A-U]$/.test(space?.beach_letter || "")) return space.beach_letter
	const match = /^Beachhead ([A-U])$/.exec(space?.name || "")
	return match?.[1] || null
}

function beachSpace(data, letter) {
	return data.spaces.find((space) => beachLetter(space) === letter) || null
}

function linkedBeachLetters(a, b) {
	if (!a || !b || a === b) return false
	return BEACH_LINKS.has([a, b].sort().join(":"))
}

function activeBeachhead(game, spaceId) {
	return game.beachheads?.[spaceId] || null
}

function markerAvailable(game, type) {
	return !Object.values(game.beachheads || {}).some((marker) => marker?.type === type)
}

function supportsNation(marker, nation) {
	if (!marker || !["br", "cw", "us", "ff"].includes(nation)) return false
	if (marker.type === "allied") return true
	if (marker.type === "br") return ["br", "cw"].includes(nation)
	if (marker.type === "us") return ["us", "ff"].includes(nation)
	return false
}

function usableBeachhead(game, spaceId, nation) {
	return supportsNation(activeBeachhead(game, spaceId), nation)
}

function supplyBeachheads(game, nation) {
	return Object.keys(game.beachheads || {})
		.map(Number)
		.filter((spaceId) => usableBeachhead(game, spaceId, nation))
}

function exactPiece(data, name) {
	return data.pieces.find((piece) => piece?.name === name)?.id || 0
}

function eligibleLocation(game, pieceId, requirement) {
	const location = game.pieces[pieceId]
	if (requirement.reserve_required) return Locations.isReserve(location, ALLIED)
	return Locations.isAvailable(location) || (requirement.reserve_allowed && Locations.isReserve(location, ALLIED))
}

function selectRequirementPieces(game, data, requirements, claimed = new Set(), cardId = null) {
	const selected = []
	for (const requirement of requirements) {
		if (requirement.name) {
			const pieceId = exactPiece(data, requirement.name)
			if (!pieceId || claimed.has(pieceId) || !eligibleLocation(game, pieceId, requirement)) return null
			claimed.add(pieceId)
			selected.push({
				piece_id: pieceId,
				reduced: !!requirement.reduced,
			})
			continue
		}
		const count = Number(requirement.count) || 1
		const candidates = ReinforcementManifest.piecesForCard(
			data,
			cardId,
			(piece) => piece.side === ALLIED && piece.nation === requirement.nation && piece.size === requirement.size,
		)
			.filter((piece) => !claimed.has(piece.id) && eligibleLocation(game, piece.id, requirement))
			.map((piece) => piece.id)
			.sort((a, b) => a - b)
		if (candidates.length < count) return null
		for (const pieceId of candidates.slice(0, count)) {
			claimed.add(pieceId)
			selected.push({
				piece_id: pieceId,
				reduced: !!requirement.reduced,
			})
		}
	}
	return selected
}

function selectedForSpec(game, data, spec, cardId) {
	const claimed = new Set()
	const landing = selectRequirementPieces(game, data, spec.landing, claimed, cardId)
	if (!landing) return null
	const reserve = selectRequirementPieces(game, data, spec.reserve, claimed, cardId)
	return reserve ? { landing, reserve } : null
}

function axisControlsNorthAfrica(game, data) {
	return data.spaces.some((space) => space?.kind === "land" && NORTH_AFRICA_BLOCK_NATIONS.has(space.nation) && game.control[space.id] === AXIS)
}

function northAfricaCleared(game, data) {
	return !axisControlsNorthAfrica(game, data)
}

function legalBeachLetters(game, data, spec) {
	const northAfricaBlocked = axisControlsNorthAfrica(game, data)
	const syracuse = data.spaces.find((space) => space?.name === "Syracuse")
	const syracuseBlocked = syracuse && game.control[syracuse.id] === AXIS
	const hasAB = ["A", "B"].some((letter) => {
		const space = beachSpace(data, letter)
		return space && activeBeachhead(game, space.id)
	})
	return spec.letters.filter((letter) => {
		const space = beachSpace(data, letter)
		if (!space || activeBeachhead(game, space.id)) return false
		if (WINTER_TURNS.has(game.turn) && letter >= "A" && letter <= "I") return false
		if (northAfricaBlocked && NORTH_AFRICA_BLOCKED_BEACHES.has(letter)) return false
		if (syracuseBlocked && SYRACUSE_BLOCKED_BEACHES.has(letter)) return false
		if (letter === "J" && hasAB) return false
		return true
	})
}

function optionHasLegalBeaches(game, data, spec, option) {
	if (option.markers.some((type) => !markerAvailable(game, type))) return false
	const letters = legalBeachLetters(game, data, spec)
	if (option.markers.length === 1) return letters.length > 0
	return letters.some((first) => letters.some((second) => linkedBeachLetters(first, second)))
}

function legalModeKeys(game, data) {
	const invasion = game.invasion
	const spec = invasion && SPECS[invasion.card_id]
	if (!spec) return []
	return spec.marker_options.filter((option) => optionHasLegalBeaches(game, data, spec, option)).map((option) => option.key)
}

function chooseMode(game, data, key) {
	const invasion = game.invasion
	const spec = invasion && SPECS[invasion.card_id]
	const option = spec?.marker_options.find((candidate) => candidate.key === key)
	if (!option || !legalModeKeys(game, data).includes(key)) throw new Error(`illegal invasion marker option: ${key}`)
	invasion.marker_option = key
	invasion.markers = option.markers.slice()
	invasion.beaches = []
	return key
}

function markerIndexForNation(markers, nation) {
	if (["br", "cw"].includes(nation)) {
		const british = markers.indexOf("br")
		return british >= 0 ? british : markers.indexOf("allied")
	}
	if (["us", "ff"].includes(nation)) {
		const american = markers.indexOf("us")
		return american >= 0 ? american : markers.indexOf("allied")
	}
	return -1
}

function landingEntriesForMarker(game, data, markerIndex) {
	const invasion = game.invasion
	if (!invasion?.markers) return []
	return invasion.landing_units.filter((entry) => markerIndexForNation(invasion.markers, data.pieces[entry.piece_id]?.nation) === markerIndex)
}

function legalBeachSpaces(game, data, map = null) {
	const invasion = game.invasion
	const spec = invasion && SPECS[invasion.card_id]
	if (!spec || !invasion.markers) return []
	const index = invasion.beaches.length
	if (index >= invasion.markers.length) return []
	const letters = legalBeachLetters(game, data, spec)
	const selected = invasion.beaches.map((entry) => entry.letter)
	let candidates = letters.filter((letter) => !selected.includes(letter))
	if (index === 0 && invasion.markers.length === 2) candidates = candidates.filter((letter) => letters.some((other) => linkedBeachLetters(letter, other)))
	if (index === 1) candidates = candidates.filter((letter) => linkedBeachLetters(selected[0], letter))
	if (map) {
		const landingIds = landingEntriesForMarker(game, data, index).map((entry) => entry.piece_id)
		candidates = candidates.filter((letter) => map.canStackFormation(game, data, landingIds, beachSpace(data, letter).id))
		if (index === 0 && invasion.markers.length === 2) {
			const secondIds = landingEntriesForMarker(game, data, 1).map((entry) => entry.piece_id)
			candidates = candidates.filter((letter) => letters.some((other) => linkedBeachLetters(letter, other) && map.canStackFormation(game, data, secondIds, beachSpace(data, other).id)))
		}
	}
	return candidates.map((letter) => beachSpace(data, letter).id)
}

function invasionUsed(game) {
	return game.invasion_usage?.turn === game.turn && !!game.invasion_usage.used
}

function unitIsOnMap(game, data, name) {
	const pieceId = exactPiece(data, name)
	return pieceId > 0 && Number.isInteger(game.pieces[pieceId]) && game.pieces[pieceId] > 0
}

function canPlay(game, data, cardId) {
	const spec = SPECS[cardId]
	if (!spec || game.events?.no_more_invasions || !game.events?.us_buildup || invasionUsed(game)) return false
	if (game.options?.no_invasions_before_summer_42 && game.turn < 6) return false
	if (spec.min_turn && game.turn < spec.min_turn) return false
	if (spec.block_event && game.events?.[spec.block_event]) return false
	if (cardId === 1 && game.events?.sledgehammer) return false
	if (cardId === 16 && game.events?.torch) return false
	if (spec.block_if_us7_on_map && unitIsOnMap(game, data, "US 7 Army")) return false
	if (!selectedForSpec(game, data, spec, cardId)) return false
	return spec.marker_options.some((option) => optionHasLegalBeaches(game, data, spec, option))
}

function canDeclareNoMoreInvasions(game) {
	return game.turn >= 14 && game.active === "Allied" && game.action_round === 1 && (game.action_history?.[ALLIED]?.length || 0) === 0 && !game.events?.no_more_invasions
}

function declareNoMoreInvasions(game) {
	if (!canDeclareNoMoreInvasions(game)) throw new Error("no-more-invasions declaration is not available")
	game.events.no_more_invasions = true
	clearUndo(game)
	log(game, "invasions.log.declared_complete")
}

function transferCandidates(game, data, map, adjacency) {
	const result = []
	const br8 = exactPiece(data, "BR 8 Army")
	const us7 = exactPiece(data, "US 7 Army")
	const br8Location = game.pieces[br8]
	const us7Location = game.pieces[us7]
	if (br8 && Number.isInteger(br8Location) && br8Location > 0 && northAfricaCleared(game, data)) result.push(br8)
	if (us7 && Number.isInteger(us7Location) && us7Location > 0 && map.traceSupply(game, data, adjacency, ALLIED, us7Location, "us") !== "oos") result.push(us7)
	return result
}

function transferToReserve(game, data, map, adjacency, pieceId) {
	pieceId = Number(pieceId)
	if (!transferCandidates(game, data, map, adjacency).includes(pieceId)) throw new Error(`piece ${pieceId} cannot enter Allied Reserve`)
	game.pieces[pieceId] = Locations.reserve(ALLIED)
	setReduced(game, pieceId, false)
	log(game, "invasions.log.reserve_return", { piece: pieceLogRef(game, pieceId) })
	return pieceId
}

function convertedReinforcementNations(cardId) {
	if ([34, 45, 46].includes(cardId)) return ["br", "usa"]
	if (cardId === 52) return ["usa"]
	return []
}

function convertedScuRequirements(spec) {
	return spec.landing.concat(spec.reserve).filter((requirement) => !requirement.name)
}

function convertedLcuEntries(game, data, cardId) {
	const spec = SPECS[cardId]
	const entries = []
	for (const requirement of spec?.landing || []) {
		if (!requirement.name) continue
		const pieceId = exactPiece(data, requirement.name)
		const location = game.pieces[pieceId]
		if (Locations.isAvailable(location)) entries.push({ piece_id: pieceId, name: requirement.name })
	}
	return entries
}

function convertedReserveLcus(game, data, cardId) {
	if (![34, 52].includes(cardId)) return []
	return (SPECS[cardId]?.landing || [])
		.filter((requirement) => requirement.name)
		.map((requirement) => exactPiece(data, requirement.name))
		.filter((pieceId) => Locations.isReserve(game.pieces[pieceId], ALLIED))
}

function legalConvertedLcuSpaces(game, data, map, adjacency, pieceId) {
	const piece = data.pieces[pieceId]
	if (!piece || piece.size !== "lcu" || !Locations.isAvailable(game.pieces[pieceId])) return []
	const result = new Set()
	for (const spaceId of Reinforcements.legalConvertedInvasionLcuSpaces(game, data, map, adjacency, pieceId)) result.add(spaceId)
	for (const spaceId of Object.keys(game.beachheads || {}).map(Number)) {
		const marker = activeBeachhead(game, spaceId)
		if (marker?.shingle || !supportsNation(marker, piece.nation) || !map.canStack(game, data, pieceId, spaceId)) continue
		result.add(spaceId)
	}
	return [...result]
}

function canPlaceConvertedLcus(game, data, map, adjacency, entries, index = 0) {
	if (index >= entries.length) return true
	const pieceId = entries[index].piece_id
	for (const spaceId of legalConvertedLcuSpaces(game, data, map, adjacency, pieceId)) {
		game.pieces[pieceId] = spaceId
		if (canPlaceConvertedLcus(game, data, map, adjacency, entries, index + 1)) {
			game.pieces[pieceId] = Locations.AVAILABLE
			return true
		}
		game.pieces[pieceId] = Locations.AVAILABLE
	}
	return false
}

function canPlayAsReinforcement(game, data, map, adjacency, cardId) {
	const spec = SPECS[cardId]
	if (!game.events?.no_more_invasions || !CONVERTIBLE_REINFORCEMENT_CARDS.has(cardId) || !spec) return false
	const nations = convertedReinforcementNations(cardId)
	if (nations.some((nation) => Reinforcements.reinforcementUsed(game, ALLIED, nation))) return false
	if (!selectRequirementPieces(game, data, convertedScuRequirements(spec), new Set(), cardId)) return false
	const entries = convertedLcuEntries(game, data, cardId)
	const sandbox = { ...game, pieces: game.pieces.slice() }
	return canPlaceConvertedLcus(sandbox, data, map, adjacency, entries)
}

function beginReinforcement(game, data, map, adjacency, cardId) {
	if (!canPlayAsReinforcement(game, data, map, adjacency, cardId)) throw new Error(`invasion card is not playable as reinforcement: ${cardId}`)
	const spec = SPECS[cardId]
	const selectedScus = selectRequirementPieces(game, data, convertedScuRequirements(spec), new Set(), cardId) || []
	Reinforcements.recordReinforcementOrigin(
		game,
		cardId,
		selectedScus.map((entry) => entry.piece_id),
	)
	for (const entry of selectedScus) {
		game.pieces[entry.piece_id] = Locations.reserve(ALLIED)
		setReduced(game, entry.piece_id, false)
	}
	const pacific = convertedReserveLcus(game, data, cardId)
	const pacificRefs = pacific.map((pieceId) => pieceLogRef(game, pieceId))
	for (const pieceId of pacific) {
		game.pieces[pieceId] = Locations.REMOVED
		setReduced(game, pieceId, false)
	}
	Reinforcements.markReinforcementsUsed(game, ALLIED, convertedReinforcementNations(cardId))
	const lcus = convertedLcuEntries(game, data, cardId)
	game.reinforcement = lcus.length
		? {
				type: "converted_invasion",
				side: ALLIED,
				card_id: cardId,
				lcus: lcus.map((entry) => entry.piece_id),
				labels_zh: lcus.map((entry) => entry.name),
				index: 0,
				reserve_scus: selectedScus.map((entry) => entry.piece_id),
				pacific_lcus: pacific,
			}
		: null
	game.event = { card_id: cardId, reinforcement: lcus.length > 0 }
	log(game, "invasions.log.deploy")
	if (pacific.length) log(game, "invasions.log.pacific", { pieces: I18n.list(pacificRefs) })
}

function placeConvertedReinforcementLcu(game, data, map, adjacency, pieceId, spaceId) {
	pieceId = Number(pieceId)
	spaceId = Number(spaceId)
	if (!legalConvertedLcuSpaces(game, data, map, adjacency, pieceId).includes(spaceId)) throw new Error(`converted invasion LCU ${pieceId} cannot enter at ${spaceId}`)
	game.pieces[pieceId] = spaceId
	setReduced(game, pieceId, false)
	return { piece_id: pieceId, space_id: spaceId }
}

function begin(game, data, cardId) {
	const spec = SPECS[cardId]
	const selected = spec && selectedForSpec(game, data, spec, cardId)
	if (!spec || !selected || !canPlay(game, data, cardId)) throw new Error(`invasion is not playable: ${cardId}`)
	game.invasion = {
		card_id: cardId,
		name: spec.name,
		name_zh: spec.name_zh,
		shingle: !!spec.shingle,
		landing_units: selected.landing,
		reserve_units: selected.reserve,
		marker_option: null,
		markers: null,
		beaches: [],
		beach_id: null,
		connected_land: null,
	}
	Reinforcements.recordReinforcementOrigin(
		game,
		cardId,
		selected.landing.concat(selected.reserve).map((entry) => entry.piece_id),
	)
	game.event = { card_id: cardId, invasion: true }
	const legalModes = legalModeKeys(game, data)
	if (legalModes.length === 1) chooseMode(game, data, legalModes[0])
}

function setReduced(game, pieceId, reduced) {
	const index = game.reduced.indexOf(pieceId)
	if (reduced && index < 0) game.reduced.push(pieceId)
	if (!reduced && index >= 0) game.reduced.splice(index, 1)
}

function connectedLandSpace(data, adjacency, beachId) {
	return (adjacency[beachId] || []).map((edge) => data.spaces[edge.to]).find((space) => space?.kind === "land")?.id || null
}

function finalizePlacement(game, data, map, adjacency) {
	const invasion = game.invasion
	const spec = SPECS[invasion.card_id]
	game.beachheads ||= {}
	for (let index = 0; index < invasion.beaches.length; index++) {
		const record = invasion.beaches[index]
		record.connected_land = connectedLandSpace(data, adjacency, record.space_id)
		game.beachheads[record.space_id] = {
			type: record.marker,
			card_id: invasion.card_id,
			name: spec.name,
			shingle: !!spec.shingle,
			turn: game.turn,
		}
		game.control[record.space_id] = ALLIED
		const landing = landingEntriesForMarker(game, data, index)
		for (const entry of landing) {
			game.pieces[entry.piece_id] = record.space_id
			setReduced(game, entry.piece_id, entry.reduced)
		}
		if (record.letter >= "C" && record.letter <= "U") Neutrals.activateVichy(game)
		log(game, "invasions.log.beachhead_created", {
			event: { "zh-CN": spec.name_zh, en: spec.name },
			space: `s${record.space_id}`,
			marker: record.marker.toUpperCase(),
			count: landing.length,
		})
	}
	for (const entry of invasion.reserve_units) {
		game.pieces[entry.piece_id] = Locations.reserve(ALLIED)
		setReduced(game, entry.piece_id, false)
	}
	game.invasion_usage = { turn: game.turn, used: invasion.card_id }
	game.events[spec.event_flag] = true
	invasion.beach_id = invasion.beaches[0]?.space_id || null
	invasion.connected_land = invasion.beaches[0]?.connected_land || null
	game.action.attack_spaces ||= []
	for (const record of invasion.beaches) if (!game.action.attack_spaces.includes(record.space_id)) game.action.attack_spaces.push(record.space_id)
	game.state = invasion.beaches.some((record) => record.connected_land && !map.enemyPiecesInSpace(game, data, ALLIED, record.connected_land).length) ? "event_invasion_advance" : "ops_combat"
}

function place(game, data, map, adjacency, beachId) {
	beachId = Number(beachId)
	const invasion = game.invasion
	const spec = invasion && SPECS[invasion.card_id]
	if (!spec || !legalBeachSpaces(game, data, map).includes(beachId)) throw new Error(`illegal invasion beach: ${beachId}`)
	const index = invasion.beaches.length
	const landingIds = landingEntriesForMarker(game, data, index).map((entry) => entry.piece_id)
	if (!map.canStackFormation(game, data, landingIds, beachId)) throw new Error(`invasion stack cannot enter beach ${beachId}`)
	invasion.beaches.push({
		space_id: beachId,
		letter: beachLetter(data.spaces[beachId]),
		marker: invasion.markers[index],
		connected_land: null,
	})
	if (invasion.beaches.length < invasion.markers.length) {
		return beachId
	}
	finalizePlacement(game, data, map, adjacency)
	return beachId
}

function advanceRecords(game, data, map) {
	return (game.invasion?.beaches || []).filter((record) => record.connected_land && !map.enemyPiecesInSpace(game, data, ALLIED, record.connected_land).length)
}

function advanceCandidates(game, data, map) {
	const candidates = []
	for (const record of advanceRecords(game, data, map)) {
		for (const entry of game.invasion.landing_units) {
			const pieceId = entry.piece_id
			if (game.pieces[pieceId] === record.space_id && map.canStack(game, data, pieceId, record.connected_land)) candidates.push(pieceId)
		}
	}
	return candidates
}

function advancePiece(game, data, map, pieceId) {
	pieceId = Number(pieceId)
	if (!advanceCandidates(game, data, map).includes(pieceId)) throw new Error(`piece ${pieceId} cannot advance from invasion beach`)
	const record = advanceRecords(game, data, map).find((candidate) => game.pieces[pieceId] === candidate.space_id)
	map.enterSpace(game, data, pieceId, record.connected_land)
	return pieceId
}

function pendingCombatBeaches(game, data, map) {
	return (game.invasion?.beaches || []).filter((record) => record.connected_land && !game.action?.attacked?.includes(record.space_id) && map.enemyPiecesInSpace(game, data, ALLIED, record.connected_land).length > 0)
}

function removeBeachhead(game, data, spaceId, reason = null) {
	spaceId = Number(spaceId)
	if (!activeBeachhead(game, spaceId)) return false
	delete game.beachheads[spaceId]
	game.control[spaceId] = data.spaces[spaceId]?.side || "neutral"
	if (reason) {
		const reasons = {
			已无盟军单位可追溯补给: { "zh-CN": "已无盟军单位可向其追溯补给", en: "is no longer reachable by any Allied unit tracing supply" },
			守军已全部消灭: { "zh-CN": "守军已全部消灭", en: "has lost all defending units" },
			遭轴心国攻击且没有守军: { "zh-CN": "遭轴心国攻击且没有守军", en: "is undefended when attacked by the Axis" },
			由盟军自愿撤除: { "zh-CN": "由盟军自愿撤除", en: "is voluntarily removed by the Allies" },
		}
		log(game, "invasions.log.beachhead_removed", { space: `s${spaceId}`, reason: reasons[reason] || reason })
	}
	return true
}

function canReachBeach(game, data, adjacency, beachId, nation) {
	if (!usableBeachhead(game, beachId, nation)) return false
	const queue = [beachId]
	const visited = new Set(queue)
	while (queue.length) {
		const current = queue.shift()
		for (const edge of adjacency[current] || []) {
			const space = data.spaces[edge.to]
			if (!space || visited.has(edge.to)) continue
			if (space.kind !== "sr" && game.control[edge.to] !== ALLIED) continue
			visited.add(edge.to)
			queue.push(edge.to)
		}
	}
	return data.pieces.some((piece) => piece && supportsNation(activeBeachhead(game, beachId), piece.nation) && Number.isInteger(game.pieces[piece.id]) && visited.has(game.pieces[piece.id]))
}

function removeUnsupportedBeachheads(game, data, adjacency) {
	const removed = []
	for (const spaceId of Object.keys(game.beachheads || {}).map(Number)) {
		const marker = activeBeachhead(game, spaceId)
		const supported = ["br", "cw", "us", "ff"].some((nation) => supportsNation(marker, nation) && canReachBeach(game, data, adjacency, spaceId, nation))
		if (!supported && removeBeachhead(game, data, spaceId, "已无盟军单位可追溯补给")) removed.push(spaceId)
	}
	return removed
}

function canRemoveVoluntarily(game, data, map, adjacency, spaceId) {
	if (!activeBeachhead(game, spaceId)) return false
	const without = {
		...game,
		beachheads: { ...game.beachheads },
		control: game.control.slice(),
	}
	delete without.beachheads[spaceId]
	without.control[spaceId] = data.spaces[spaceId]?.side || "neutral"
	for (const piece of data.pieces) {
		if (!piece || piece.side !== ALLIED || !Number.isInteger(game.pieces[piece.id])) continue
		const before = map.traceSupply(game, data, adjacency, ALLIED, game.pieces[piece.id], piece.nation)
		const after = map.traceSupply(without, data, adjacency, ALLIED, without.pieces[piece.id], piece.nation)
		if (before !== "oos" && after === "oos") return false
	}
	return true
}

function removableBeachheads(game, data, map, adjacency) {
	return Object.keys(game.beachheads || {})
		.map(Number)
		.filter((spaceId) => canRemoveVoluntarily(game, data, map, adjacency, spaceId))
}

function removeDefeatedBeachhead(game, data, map, combat) {
	const candidates = new Set([combat?.defender_space, ...(combat?.origin_spaces || [])])
	for (const spaceId of candidates) {
		if (!activeBeachhead(game, spaceId)) continue
		if (!map.friendlyPiecesInSpace(game, data, ALLIED, spaceId).length) removeBeachhead(game, data, spaceId, "守军已全部消灭")
	}
}

module.exports = {
	BEACH_LINKS,
	CONVERTIBLE_REINFORCEMENT_CARDS,
	NORTH_AFRICA_BLOCKED_BEACHES,
	SPECS,
	SYRACUSE_BLOCKED_BEACHES,
	activeBeachhead,
	advanceCandidates,
	advancePiece,
	beachLetter,
	beachSpace,
	begin,
	beginReinforcement,
	canDeclareNoMoreInvasions,
	canPlay,
	canPlayAsReinforcement,
	canReachBeach,
	canRemoveVoluntarily,
	chooseMode,
	convertedReinforcementNations,
	declareNoMoreInvasions,
	legalBeachLetters,
	legalBeachSpaces,
	legalConvertedLcuSpaces,
	legalModeKeys,
	linkedBeachLetters,
	markerAvailable,
	pendingCombatBeaches,
	place,
	placeConvertedReinforcementLcu,
	removableBeachheads,
	removeBeachhead,
	removeDefeatedBeachhead,
	removeUnsupportedBeachheads,
	supplyBeachheads,
	supportsNation,
	transferCandidates,
	transferToReserve,
	usableBeachhead,
}
