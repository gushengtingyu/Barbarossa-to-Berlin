"use strict"

const { ALLIED, AXIS, AXIS_ROLE, DATA_VERSION, MOSCOW_SPACE_ID, RULESET_VERSION, SCHEMA_VERSION, STALIN_PIECE_ID } = require("../core/constants.js")
const { normalizeOptions } = require("../core/state.js")
const { normalizeSeed } = require("../core/random.js")
const { findCard } = require("./cards.js")

const CAMPAIGN_TRENCHES = Object.freeze([
	[382, "Bialystok", 1, "soviet"],
	[310, "Lwow", 2, "soviet"],
	[100, "Kishinev", 1, "soviet"],
	[257, "Tobruk", 1, "british"],
	[30, "Saar", 1, "west_wall"],
	[46, "Stuttgart", 1, "west_wall"],
])
function placeCampaignTrenches(game, data) {
	for (const [spaceId, expectedName, level, kind] of CAMPAIGN_TRENCHES) {
		if (data.spaces[spaceId]?.name !== expectedName) throw new Error(`campaign trench space ${spaceId} must be ${expectedName}`)
		game.trench[spaceId] = level
		game.trench_owner[spaceId] = game.control[spaceId]
		game.trench_kind[spaceId] = kind
	}
}

function createInitialState(data, scenario = "Campaign", seed = 1, options = {}) {
	if (scenario !== "Campaign") throw new Error(`unsupported scenario: ${scenario}`)
	const game = {
		schema_version: SCHEMA_VERSION,
		data_version: DATA_VERSION,
		ruleset_version: RULESET_VERSION,
		seed: normalizeSeed(seed),
		initial_seed: normalizeSeed(seed),
		scenario,
		options: normalizeOptions(options),
		active: AXIS_ROLE,
		state: "axis_setup_occupied_france",
		phase: "setup",
		turn: 1,
		action_round: 0,
		vp: 7,
		stalin_location: MOSCOW_SPACE_ID,
		pieces: Array(data.pieces.length).fill(0),
		reduced: [],
		control: data.spaces.map((space) => space?.side || null),
		control_nation: data.spaces.map((space) => (space?.kind === "land" ? space.nation || null : null)),
		trench: {},
		trench_owner: {},
		trench_kind: {},
		destroyed_forts: [],
		stand_fast: {},
		stand_fast_round_units: {},
		orders: null,
		partisans: [],
		partisan_vp_adjustment: 0,
		retreat_history: [],
		hands: { [ALLIED]: [], [AXIS]: [] },
		decks: { [ALLIED]: [], [AXIS]: [] },
		discards: { [ALLIED]: [], [AXIS]: [] },
		removed: { [ALLIED]: [], [AXIS]: [] },
		combat_cards: { [ALLIED]: [], [AXIS]: [] },
		combat_card_usage: { [ALLIED]: [], [AXIS]: [] },
		rp: { ge: 0, axis: 0, br: 0, usa: 0, su: 0, tu: 0 },
		replacement_usage: { turn: 1, panzer_steps: 0, wehrkreis_applied: false, wehrkreis_count: 0, wehrkreis_deducted: 0 },
		replacement: null,
		eliminated_theater: {},
		theater_choice: null,
		reinforcement_usage: { turn: 1, [ALLIED]: {}, [AXIS]: {} },
		reinforcement_origin: {},
		action_history: { [ALLIED]: [], [AXIS]: [] },
		action_track: { [ALLIED]: [], [AXIS]: [] },
		events: {},
		beachheads: {},
		invasion_usage: { turn: 1, used: null },
		neutrals: {
			tu: { at_war: false, controller: null },
			sw: { at_war: false, controller: null },
		},
		log: [],
		action_log: [],
		undo: [],
		rollback: [],
		rollback_state: null,
		setup_choice: {
			occupied_france: { pieces: [], spaces: [] },
			turkey: { pieces: [] },
		},
	}
	if (data.spaces[MOSCOW_SPACE_ID]?.name !== "Moscow") throw new Error(`Stalin setup space ${MOSCOW_SPACE_ID} must be Moscow`)
	if (data.pieces[STALIN_PIECE_ID]?.name !== "Stalin" || data.pieces[STALIN_PIECE_ID]?.size !== "marker") throw new Error(`Stalin piece ${STALIN_PIECE_ID} must be the Stalin marker`)
	for (const row of data.setup) {
		game.pieces[row.piece_id] = row.space_id ?? row.location ?? 0
		if (row.location === "setup_choice:occupied_france") game.setup_choice.occupied_france.pieces.push(row.piece_id)
		if (row.location === "setup_choice:turkey") game.setup_choice.turkey.pieces.push(row.piece_id)
		if (row.reduced) game.reduced.push(row.piece_id)
	}
	game.pieces[STALIN_PIECE_ID] = 0
	if (game.setup_choice.occupied_france.pieces.length !== 2) throw new Error("Campaign setup requires two Occupied France army choices")
	if (game.setup_choice.turkey.pieces.length !== 2) throw new Error("Campaign setup requires two Turkish corps placement choices")
	placeCampaignTrenches(game, data)
	if (game.options.moscow_trench_axis_rp) {
		game.trench[MOSCOW_SPACE_ID] = 1
		game.trench_owner[MOSCOW_SPACE_ID] = ALLIED
		game.trench_kind[MOSCOW_SPACE_ID] = "soviet"
	}
	game.opening_cards = [findCard(data, AXIS, 1), findCard(data, AXIS, 2)]
	return game
}

module.exports = { createInitialState }
