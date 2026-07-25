"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const rules = require("../rules.js")
const Engine = require("../modules/engine.js")

const { data, adjacency } = Engine

function pieceNamed(name) {
	return data.pieces.find((piece) => piece?.name === name).id
}

function spaceNamed(name) {
	return data.spaces.find((space) => space?.name === name).id
}

test("detailed supply reports terminals and German source entry must reach a different full source", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Source A", kind: "land", nation: "ge", supply: "axis" }, { id: 2, name: "Transit", kind: "land", nation: "ge" }, { id: 3, name: "Source B", kind: "land", nation: "ge", supply: "axis" }],
	}
	const localAdjacency = [
		[],
		[{ to: 2, type: "regular" }],
		[
			{ to: 1, type: "regular" },
			{ to: 3, type: "regular" },
		],
		[{ to: 2, type: "regular" }],
	]
	const game = { control: [null, "axis", "axis", "axis"], events: {}, beachheads: {}, partisans: [], options: {}, turn: 2, neutrals: {} }
	const details = Engine.map.traceSupplyDetails(game, localData, localAdjacency, "axis", 1, "ge", { exclude_sources: [1] })
	assert.equal(details.status, "full")
	assert.deepEqual(
		details.terminals.map((terminal) => terminal.space_id),
		[3],
	)
	assert.equal(details.terminals[0].path_type, "regular")
	game.control[2] = "allied"
	assert.equal(Engine.map.traceSupplyDetails(game, localData, localAdjacency, "axis", 1, "ge", { exclude_sources: [1] }).status, "oos")
})

test("Western LCU reconstruction honors unknown, Mediterranean, and Northwest Europe theaters", () => {
	const game = rules.setup(401, "Campaign", {})
	const pieceId = pieceNamed("US 15 Army")
	const beachA = data.spaces.find((space) => space?.beach_letter === "A").id
	const beachJ = data.spaces.find((space) => space?.beach_letter === "J").id
	game.pieces[pieceId] = "eliminated:allied"
	game.control[beachA] = "allied"
	game.control[beachJ] = "allied"
	game.beachheads[beachA] = { type: "allied", card_id: 33 }
	game.beachheads[beachJ] = { type: "allied", card_id: 1 }
	assert.deepEqual(Engine.replacements.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, pieceId), [])
	Engine.replacements.recordEliminatedTheater(game, pieceId, "nwe")
	let spaces = Engine.replacements.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, pieceId)
	assert.equal(spaces.includes(beachA), true)
	assert.equal(spaces.includes(beachJ), false)
	Engine.replacements.recordEliminatedTheater(game, pieceId, "med")
	spaces = Engine.replacements.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, pieceId)
	assert.equal(spaces.includes(beachA), false)
	assert.equal(spaces.includes(beachJ), true)
})

test("Suez remains the core supply source and Cairo-to-Suez classification is Mediterranean", () => {
	const game = rules.setup(402, "Campaign", {})
	const pieceId = pieceNamed("BR 8 Army")
	const suez = spaceNamed("Suez")
	const cairo = spaceNamed("Cairo")
	game.pieces[pieceId] = cairo
	game.control[cairo] = "allied"
	game.control[suez] = "allied"
	const details = Engine.map.traceSupplyDetails(game, data, adjacency, "allied", cairo, "br")
	assert.equal(details.status, "full")
	assert.equal(
		details.terminals.some((terminal) => terminal.space_id === suez),
		true,
	)
	assert.deepEqual(Engine.replacements.theaterOptionsForElimination(game, data, Engine.map, adjacency, pieceId, cairo), ["med"])
})

test("a Limited Supply line still classifies a Western LCU by its actual terminal", () => {
	const localData = {
		spaces: [null, { id: 1, name: "Origin", kind: "land", nation: "eg" }, { id: 2, name: "Suez", kind: "land", nation: "eg", supply: "allied" }],
		pieces: [null, { id: 1, name: "Test BR Army", size: "lcu", nation: "br", side: "allied" }],
	}
	const localAdjacency = [[], [{ to: 2, type: "sr" }], [{ to: 1, type: "sr" }]]
	const game = { turn: 4, control: [null, "allied", "allied"], pieces: [null, 1], reduced: [], events: {}, options: {}, beachheads: {}, partisans: [], neutrals: {} }
	const details = Engine.map.traceSupplyDetails(game, localData, localAdjacency, "allied", 1, "br")
	assert.equal(details.status, "limited")
	assert.deepEqual(Engine.replacements.theaterOptionsForElimination(game, localData, Engine.map, localAdjacency, 1, 1), ["med"])
})

test("PanzerArmee Afrika reconstructs only at supplied Tripoli or Alexandria", () => {
	const game = rules.setup(403, "Campaign", {})
	const pieceId = pieceNamed("GE Panzer Armee Afrika")
	const tripoli = spaceNamed("Tripoli")
	const alexandria = spaceNamed("Alexandria")
	game.pieces[pieceId] = "eliminated:axis"
	game.control[tripoli] = "axis"
	game.control[alexandria] = "axis"
	const spaces = Engine.replacements.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, pieceId)
	assert.equal(spaces.includes(tripoli), true)
	assert.equal(
		spaces.every((spaceId) => [tripoli, alexandria].includes(spaceId)),
		true,
	)
})

test("Wehrkreis penalty groups duplicate district labels and applies only once", () => {
	const game = rules.setup(404, "Campaign", {})
	game.turn = 6
	game.control = data.spaces.map((space) => (space ? "axis" : null))
	game.rp.ge = 20
	const districtI = data.spaces.filter((space) => space?.wehrkreis === "I")
	for (const space of districtI) game.control[space.id] = "allied"
	const first = Engine.replacements.applyWehrkreisPenalty(game, data, Engine.map, adjacency)
	assert.equal(first.count, 1)
	assert.equal(first.deducted, 1)
	assert.equal(game.rp.ge, 19)
	const second = Engine.replacements.applyWehrkreisPenalty(game, data, Engine.map, adjacency)
	assert.deepEqual(second, { count: 1, deducted: 1 })
	assert.equal(game.rp.ge, 19)
})

test("Totaler Krieg raises the Panzer replacement cap only from the following turn", () => {
	const game = rules.setup(405, "Campaign", {})
	game.events.totaler_krieg = true
	game.events.totaler_krieg_turn = 9
	game.turn = 9
	assert.equal(Engine.logistics.panzerReplacementLimit(game), 2)
	game.turn = 10
	assert.equal(Engine.logistics.panzerReplacementLimit(game), 3)
})

test("Rule 14.1 replacement buckets enforce nationality restrictions", () => {
	const game = rules.setup(4051, "Campaign", {})
	const pieces = Object.fromEntries(["br", "cw", "us", "ff", "su", "ge", "it"].map((nation) => [nation, data.pieces.find((piece) => piece?.nation === nation && piece.size === "scu").id]))
	game.reduced = []
	for (const [nation, pieceId] of Object.entries(pieces)) {
		const side = ["ge", "it"].includes(nation) ? "axis" : "allied"
		game.pieces[pieceId] = Engine.unitLocations.reserve(side)
		Engine.combat.setReduced(game, pieceId, true)
	}
	const legalWith = (bucket, side) => {
		Object.assign(game.rp, { br: 0, usa: 0, su: 0, ge: 0, axis: 0, tu: 0 }, { [bucket]: 1 })
		return new Set(Engine.replacements.legalReplacementPieces(game, data, Engine.map, adjacency, side))
	}
	let legal = legalWith("br", "allied")
	assert.equal(legal.has(pieces.br), true)
	assert.equal(legal.has(pieces.cw), true)
	assert.equal(legal.has(pieces.us), false)
	assert.equal(legal.has(pieces.ff), false)
	assert.equal(legal.has(pieces.su), false)
	legal = legalWith("usa", "allied")
	assert.equal(legal.has(pieces.us), true)
	assert.equal(legal.has(pieces.ff), true)
	assert.equal(legal.has(pieces.br), false)
	legal = legalWith("su", "allied")
	assert.equal(legal.has(pieces.su), true)
	assert.equal(legal.has(pieces.br), false)
	legal = legalWith("ge", "axis")
	assert.equal(legal.has(pieces.ge), true)
	assert.equal(legal.has(pieces.it), false)
	legal = legalWith("axis", "axis")
	assert.equal(legal.has(pieces.it), true)
	assert.equal(legal.has(pieces.ge), false)
})

test("Rule 14.1 discards every unspent RP bucket owned by the side", () => {
	const game = rules.setup(4052, "Campaign", {})
	Object.assign(game.rp, { br: 1, usa: 2, su: 3, ge: 4, axis: 5, tu: 6 })
	game.neutrals.tu.controller = "allied"
	Engine.replacements.discardUnspentRp(game, "allied")
	assert.deepEqual(game.rp, { br: 0, usa: 0, su: 0, ge: 4, axis: 5, tu: 0 })
	game.rp.tu = 6
	game.neutrals.tu.controller = "axis"
	Engine.replacements.discardUnspentRp(game, "axis")
	assert.deepEqual(game.rp, { br: 0, usa: 0, su: 0, ge: 0, axis: 0, tu: 0 })
})

test("Rule 14.4 excludes dotted and permanently removed units from replacements", () => {
	const game = rules.setup(4053, "Campaign", {})
	const southwest = pieceNamed("SU Southwest Front")
	const moscow = spaceNamed("Moscow")
	game.pieces[southwest] = moscow
	Engine.combat.setReduced(game, southwest, true)
	game.rp.su = 2
	assert.equal(Engine.replacements.legalReplacementPieces(game, data, Engine.map, adjacency, "allied").includes(southwest), false)
	game.pieces[southwest] = Engine.unitLocations.REMOVED
	assert.equal(Engine.replacements.legalReplacementPieces(game, data, Engine.map, adjacency, "allied").includes(southwest), false)
})

test("Allied voluntary elimination delays an LCU three turns without consuming a replacement SCU", () => {
	const game = rules.setup(406, "Campaign", {})
	const pieceId = pieceNamed("BR 8 Army")
	const suez = spaceNamed("Suez")
	game.turn = 7
	game.pieces[pieceId] = suez
	game.control[suez] = "allied"
	const before = game.pieces.slice()
	Engine.replacements.voluntarilyEliminate(game, data, Engine.map, adjacency, pieceId)
	assert.equal(game.pieces[pieceId], "turn_track:10")
	for (let id = 1; id < game.pieces.length; id++) if (id !== pieceId) assert.equal(game.pieces[id], before[id])
})

test("unknown Western LCU theater is resolved through the shared state whitelist", () => {
	let game = rules.setup(407, "Campaign", {})
	const pieceId = pieceNamed("US 15 Army")
	game.state = "allied_replacements"
	game.phase = "replacement"
	game.active = "Allied"
	game.pieces[pieceId] = "eliminated:allied"
	game.rp.usa = 1
	assert.equal(rules.view(game, "Allied").actions.piece.includes(pieceId), true)
	game = rules.action(game, "Allied", "piece", pieceId)
	assert.equal(game.state, "eliminated_theater_choice")
	assert.equal(rules.view(game, "Allied").actions.med, 1)
	assert.equal(rules.view(game, "Allied").actions.nwe, 1)
	assert.throws(() => rules.action(game, "Allied", "space", 1), /illegal action/)
	game = rules.action(game, "Allied", "med")
	assert.equal(game.eliminated_theater[pieceId], "med")
})

test("public view exposes structured off-map state without hand positions", () => {
	const game = rules.setup(408, "Campaign", {})
	const pieceId = pieceNamed("US 15 Army")
	game.pieces[pieceId] = "turn_track:9"
	game.reinforcement_origin[pieceId] = 38
	game.turn = 7
	game.hands.allied = [2]
	const observer = rules.view(game, "Observer")
	const unit = observer.off_map_units.find((entry) => entry.piece_id === pieceId)
	assert.deepEqual({ location: unit.location, turn: unit.turn, turns_remaining: unit.turns_remaining }, { location: "turn_track", turn: 9, turns_remaining: 2 })
	assert.equal(unit.reinforcement_card_id, 38)
	assert.equal(observer.hand, undefined)
	assert.equal(observer.hands, undefined)
	assert.ok(rules.static_view(game).reinforcement_catalog.length > 0)
})
