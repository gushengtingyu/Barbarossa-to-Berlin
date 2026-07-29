"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog } = require("./i18n_helpers.js")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine
const adjacency = Engine.map.buildAdjacency(data)

test("all Campaign setup units can trace rules-book supply through reviewed Sea SR links", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1, {})
	const out = []
	for (let pieceId = 1; pieceId < data.pieces.length; pieceId++) {
		if (!Number.isInteger(game.pieces[pieceId]) || game.pieces[pieceId] <= 0) continue
		if (!["axis", "allied"].includes(data.pieces[pieceId]?.side)) continue
		if (!["scu", "lcu"].includes(data.pieces[pieceId]?.size)) continue
		if (Engine.logistics.supplyStatus(game, data, Engine.map, adjacency, pieceId) === "oos") out.push(pieceId)
	}
	assert.deepEqual(out, [])
})

test("the two official Homs spaces keep distinct stable ids and national control", () => {
	const homs = data.spaces.filter((space) => space?.name === "Homs")
	assert.deepEqual(
		homs.map((space) => space.id),
		[191, 412],
	)
	assert.deepEqual(
		homs.map((space) => space.nation),
		["ly", "sy"],
	)
	assert.deepEqual(
		homs.map((space) => space.side),
		["axis", "allied"],
	)
})

test("attrition eliminates an isolated SCU and flips its unsupplied space", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1, {})
	const pieceId = data.pieces.find((piece) => piece?.side === "axis" && piece.size === "scu").id
	const isolated = data.spaces.find((space) => space?.kind === "land" && space.nation === "su" && !space.supply).id
	game.pieces.fill(0)
	game.pieces[pieceId] = isolated
	game.reduced = [pieceId]
	game.control = data.spaces.map(() => "allied")
	game.control[isolated] = "axis"
	const result = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "axis")
	assert.deepEqual(result.eliminated, [pieceId])
	assert.deepEqual(result.eliminatedReduced, [pieceId])
	assert.equal(game.pieces[pieceId], "eliminated:axis")
	assert.equal(game.control[isolated], "allied")
})

test("attrition state logs clickable unit and control details", () => {
	let game = rules.setup(5, "Campaign", {})
	const pieceId = data.pieces.find((piece) => piece?.side === "axis" && piece.size === "scu").id
	const isolated = data.spaces.find((space) => space?.kind === "land" && space.nation === "su" && !space.supply).id
	game.pieces.fill(0)
	game.pieces[pieceId] = isolated
	game.control = data.spaces.map(() => "allied")
	game.control[isolated] = "axis"
	game.active = "Axis"
	game.state = "axis_attrition"
	game = rules.action(game, "Axis", "apply_attrition")
	assert.ok(renderLog(game).includes(`P${pieceId}被消灭（断补）`))
	assert.ok(renderLog(game).includes(`s${isolated}因断补转为盟军控制`))
	assert.ok(renderLog(game, "en").includes(`P${pieceId} is eliminated (OOS)`))
	assert.ok(renderLog(game, "en").includes(`s${isolated} changes to Allied control (OOS)`))
	assert.equal(
		renderLog(game).some((entry) => entry.startsWith("轴心国损耗：消灭")),
		false,
	)
})

test("a delayed OOS LCU enters the Eliminated Box exactly three turns later", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1, {})
	const pieceId = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu").id
	game.turn = 4
	game.pieces[pieceId] = "turn_track:4"
	let released = Engine.logistics.releaseTurnTrackLcus(game, data, "allied")
	assert.deepEqual(released, [])
	released = Engine.logistics.releaseTurnTrackLcus(game, data, "axis")
	assert.deepEqual(released, [pieceId])
	assert.equal(game.pieces[pieceId], "eliminated:axis")
})

test("Rule 13.44 removes a matching Reserve SCU and applies the printed LCU delay by side", () => {
	const isolated = data.spaces.find((space) => space?.kind === "land" && space.nation === "su" && !space.supply).id

	let game = Engine.setup.createInitialState(data, "Campaign", 71, {})
	const germanLcu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && piece.unit_type !== "mechanized").id
	const germanScu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "scu" && piece.unit_type !== "mechanized").id
	game.turn = 5
	game.pieces.fill(0)
	game.pieces[germanLcu] = isolated
	game.pieces[germanScu] = Engine.unitLocations.reserve("axis")
	game.control = data.spaces.map((space) => (space?.kind === "land" ? "allied" : null))
	game.control[isolated] = "axis"
	let resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "axis")
	assert.deepEqual(resolved.eliminated, [germanLcu])
	assert.equal(game.pieces[germanLcu], "turn_track:8")
	assert.equal(game.pieces[germanScu], "eliminated:axis")

	game = Engine.setup.createInitialState(data, "Campaign", 72, {})
	const sovietLcu = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "lcu" && piece.unit_type !== "mechanized" && piece.name !== "SU Southwest Front (Infantry)").id
	const sovietScu = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "scu" && piece.unit_type !== "mechanized").id
	game.pieces.fill(0)
	game.pieces[sovietLcu] = isolated
	game.pieces[sovietScu] = Engine.unitLocations.reserve("allied")
	game.control = data.spaces.map((space) => (space?.kind === "land" ? "axis" : null))
	game.control[isolated] = "allied"
	resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "allied")
	assert.deepEqual(resolved.eliminated, [sovietLcu])
	assert.equal(game.pieces[sovietLcu], "eliminated:allied")
	assert.equal(game.pieces[sovietScu], "eliminated:allied")
})

test("Rule 13.44 permanently removes an OOS LCU when no matching Reserve SCU exists", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 73, {})
	const lcu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && piece.unit_type !== "mechanized").id
	const isolated = data.spaces.find((space) => space?.kind === "land" && space.nation === "su" && !space.supply).id
	game.pieces.fill(0)
	game.pieces[lcu] = isolated
	game.control = data.spaces.map((space) => (space?.kind === "land" ? "allied" : null))
	game.control[isolated] = "axis"
	const resolved = Engine.logistics.resolveAttrition(game, data, Engine.map, adjacency, "axis")
	assert.deepEqual(resolved.eliminated, [lcu])
	assert.equal(game.pieces[lcu], Engine.unitLocations.REMOVED)
})

test("an eliminated SCU can be rebuilt reduced in Reserve and then restored to full", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1, {})
	const pieceId = data.pieces.find((piece) => piece?.side === "axis" && piece.size === "scu" && piece.unit_type !== "mechanized").id
	game.pieces[pieceId] = "eliminated:axis"
	Engine.combat.setReduced(game, pieceId, false)
	game.rp.axis = 1
	assert.equal(Engine.logistics.legalReplacementPieces(game, data, Engine.map, adjacency, "axis").includes(pieceId), true)
	let result = Engine.logistics.replaceStep(game, data, Engine.map, adjacency, "axis", pieceId)
	assert.equal(result.placement_required, false)
	assert.equal(game.pieces[pieceId], "reserve:axis")
	assert.equal(Engine.combat.isReduced(game, pieceId), true)
	assert.equal(game.rp.axis, 0.5)
	assert.ok(renderLog(game).includes(`轴心国重建p${pieceId}至轴心国预备箱。`))
	result = Engine.logistics.replaceStep(game, data, Engine.map, adjacency, "axis", pieceId)
	assert.equal(result.placement_required, false)
	assert.equal(Engine.combat.isReduced(game, pieceId), false)
	assert.equal(game.rp.axis, 0)
	assert.ok(renderLog(game).includes(`轴心国补足p${pieceId}于轴心国预备箱。`))
})

test("an eliminated LCU selects a legal Full Supply home placement before spending RP", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1, {})
	const pieceId = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "lcu").id
	game.pieces[pieceId] = "eliminated:allied"
	Engine.combat.setReduced(game, pieceId, false)
	game.rp.su = 2
	const result = Engine.logistics.replaceStep(game, data, Engine.map, adjacency, "allied", pieceId)
	assert.equal(result.placement_required, true)
	assert.equal(game.rp.su, 2)
	const moscow = data.spaces.find((space) => space?.name === "Moscow").id
	assert.equal(result.spaces.includes(moscow), true)
	Engine.logistics.placeRebuiltLcu(game, data, Engine.map, adjacency, "allied", pieceId, moscow)
	assert.equal(game.pieces[pieceId], moscow)
	assert.equal(Engine.combat.isReduced(game, pieceId), true)
	assert.equal(game.rp.su, 1)
	assert.ok(renderLog(game).includes(`盟军重建p${pieceId}至s${moscow}。`))
	Engine.logistics.replaceStep(game, data, Engine.map, adjacency, "allied", pieceId)
	assert.equal(Engine.combat.isReduced(game, pieceId), false)
	assert.equal(game.rp.su, 0)
	assert.ok(renderLog(game).includes(`盟军补足p${pieceId}于s${moscow}。`))
})

test("an eliminated German LCU can rebuild in Warsaw after freeing its original stack slot", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1, {})
	const warsaw = data.spaces.find((space) => space?.name === "Warsaw").id
	const pieceId = Engine.map.friendlyPiecesInSpace(game, data, "axis", warsaw).find((candidate) => data.pieces[candidate].nation === "ge" && data.pieces[candidate].size === "lcu" && data.pieces[candidate].unit_type !== "mechanized")
	assert.equal(Engine.map.friendlyPiecesInSpace(game, data, "axis", warsaw).length, 3)

	game.pieces[pieceId] = "eliminated:axis"
	Engine.combat.setReduced(game, pieceId, false)
	game.rp.ge = 1

	const result = Engine.logistics.replaceStep(game, data, Engine.map, adjacency, "axis", pieceId)
	assert.equal(result.placement_required, true)
	assert.equal(result.spaces.includes(warsaw), true)
	assert.equal(game.rp.ge, 1)

	const placement = Engine.logistics.placeRebuiltLcu(game, data, Engine.map, adjacency, "axis", pieceId, warsaw)
	assert.deepEqual(placement, { piece_id: pieceId, space_id: warsaw, bucket: "ge", cost: 1 })
	assert.equal(game.pieces[pieceId], warsaw)
	assert.equal(Engine.combat.isReduced(game, pieceId), true)
	assert.equal(game.rp.ge, 0)
})

test("German LCU reinforcement entry includes Warsaw but preserves home-city placement restrictions", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1, {})
	const warsaw = data.spaces.find((space) => space?.name === "Warsaw").id
	const germanLcu = data.pieces.find((piece) => piece?.nation === "ge" && piece.size === "lcu" && Engine.unitLocations.isAvailable(game.pieces[piece.id])).id
	const reclassifiedNonCities = ["Lodz Kalisch", "Krakow", "Radom", "Lublin", "Tarnow"].map((name) => data.spaces.find((space) => space?.name === name).id)

	let spaces = Engine.reinforcements.legalLcuReinforcementSpaces(game, data, Engine.map, adjacency, germanLcu)
	assert.equal(spaces.includes(warsaw), false)

	const occupant = Engine.map.friendlyPiecesInSpace(game, data, "axis", warsaw)[0]
	game.pieces[occupant] = "eliminated:axis"
	spaces = Engine.reinforcements.legalLcuReinforcementSpaces(game, data, Engine.map, adjacency, germanLcu)
	assert.equal(spaces.includes(warsaw), true)
	for (const spaceId of reclassifiedNonCities) assert.equal(spaces.includes(spaceId), false, data.spaces[spaceId].name)

	game.control[warsaw] = "allied"
	assert.equal(Engine.reinforcements.legalLcuReinforcementSpaces(game, data, Engine.map, adjacency, germanLcu).includes(warsaw), false)
	game.control[warsaw] = "axis"

	const disconnectedAdjacency = adjacency.map((edges) => edges.slice())
	disconnectedAdjacency[warsaw] = []
	assert.equal(Engine.reinforcements.legalLcuReinforcementSpaces(game, data, Engine.map, disconnectedAdjacency, germanLcu).includes(warsaw), false)
})

test("German Panzer replacements stop at the per-turn step limit", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1, {})
	const panzers = data.pieces.filter((piece) => piece?.nation === "ge" && piece.size === "lcu" && piece.unit_type === "mechanized").slice(0, 3)
	const berlin = data.spaces.find((space) => space?.name === "Berlin").id
	for (const piece of panzers) {
		game.pieces[piece.id] = berlin
		Engine.combat.setReduced(game, piece.id, true)
	}
	game.rp.ge = 3
	Engine.logistics.replaceStep(game, data, Engine.map, adjacency, "axis", panzers[0].id)
	Engine.logistics.replaceStep(game, data, Engine.map, adjacency, "axis", panzers[1].id)
	assert.equal(Engine.logistics.panzerStepsUsed(game), 2)
	assert.equal(Engine.logistics.legalReplacementPieces(game, data, Engine.map, adjacency, "axis").includes(panzers[2].id), false)
})

test("Rally replacement state requires an LCU placement from the server whitelist", () => {
	let game = rules.setup(8, "Campaign", {})
	const pieceId = data.pieces.find((piece) => piece?.nation === "su" && piece.size === "lcu").id
	game.state = "allied_replacements"
	game.phase = "replacement"
	game.active = "Allied"
	game.pieces[pieceId] = "eliminated:allied"
	Engine.combat.setReduced(game, pieceId, false)
	game.rp.su = 1
	assert.equal(rules.view(game, "Allied").actions.piece.includes(pieceId), true)
	game = rules.action(game, "Allied", "piece", pieceId)
	assert.equal(game.state, "replacement_place_lcu")
	const spaces = rules.view(game, "Allied").actions.space
	assert.ok(spaces.length > 0)
	assert.throws(() => rules.action(game, "Allied", "space", 1), /illegal action/)
	game = rules.action(game, "Allied", "space", spaces[0])
	assert.equal(game.state, "draw_discard_allied")
	assert.equal(Engine.combat.isReduced(game, pieceId), true)
})

test("eliminated 8th and 7th Armies may be rebuilt reduced directly into Allied Reserve", () => {
	let game = rules.setup(81, "Campaign", {})
	const br8 = data.pieces.find((piece) => piece?.name === "BR 8 Army").id
	for (const entry of data.spaces) if (entry?.kind === "land" && ["dz", "tn", "ly", "eg"].includes(entry.nation)) game.control[entry.id] = "allied"
	game.state = "allied_replacements"
	game.phase = "replacement"
	game.active = "Allied"
	game.pieces[br8] = "eliminated:allied"
	game.rp.br = 1
	game = rules.action(game, "Allied", "piece", br8)
	assert.equal(game.state, "replacement_place_lcu")
	assert.equal(rules.view(game, "Allied").actions.reserve, 1)
	game = rules.action(game, "Allied", "reserve")
	assert.equal(game.pieces[br8], "reserve:allied")
	assert.equal(Engine.combat.isReduced(game, br8), true)
	assert.equal(game.rp.br, 0)

	game = rules.setup(82, "Campaign", {})
	const us7 = data.pieces.find((piece) => piece?.name === "US 7 Army").id
	game.state = "allied_replacements"
	game.phase = "replacement"
	game.active = "Allied"
	game.pieces[us7] = "eliminated:allied"
	game.rp.usa = 1
	game = rules.action(game, "Allied", "piece", us7)
	assert.equal(rules.view(game, "Allied").actions.reserve, 1)
	game = rules.action(game, "Allied", "reserve")
	assert.equal(game.pieces[us7], "reserve:allied")
	assert.equal(Engine.combat.isReduced(game, us7), true)
	assert.equal(game.rp.usa, 0)
})

test("the 8th Army cannot rebuild into Allied Reserve while Axis controls North Africa", () => {
	const game = rules.setup(83, "Campaign", {})
	const br8 = data.pieces.find((piece) => piece?.name === "BR 8 Army").id
	game.pieces[br8] = "eliminated:allied"
	game.rp.br = 1
	assert.equal(Engine.logistics.canRebuildLcuInAlliedReserve(game, data, br8), false)
})

test("Western Allied LCU replacements use compatible non-Shingle beachheads, Naples, and opened Antwerp", () => {
	const game = rules.setup(84, "Campaign", {})
	const canadian = data.pieces.find((piece) => piece?.name === "CW 1 Cdn Army").id
	const brBeach = data.spaces.find((space) => space?.name === "Beachhead D").id
	const usBeach = data.spaces.find((space) => space?.name === "Beachhead E").id
	const shingle = data.spaces.find((space) => space?.name === "Beachhead K").id
	const naples = data.spaces.find((space) => space?.name === "Naples").id
	const antwerp = data.spaces.find((space) => space?.name === "Antwerp").id
	game.pieces[canadian] = "eliminated:allied"
	game.beachheads[brBeach] = { type: "br", card_id: 33 }
	game.beachheads[usBeach] = { type: "us", card_id: 33 }
	game.beachheads[shingle] = { type: "allied", card_id: 46, shingle: true }
	for (const spaceId of [brBeach, usBeach, shingle, naples, antwerp]) game.control[spaceId] = "allied"
	game.eliminated_theater[canadian] = "nwe"

	let spaces = Engine.logistics.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, canadian)
	assert.equal(spaces.includes(brBeach), true)
	assert.equal(spaces.includes(usBeach), false)
	assert.equal(spaces.includes(shingle), false)
	assert.equal(spaces.includes(naples), false)
	assert.equal(spaces.includes(antwerp), false)

	game.events.clearing_the_scheldt = true
	spaces = Engine.logistics.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, canadian)
	assert.equal(spaces.includes(antwerp), true)

	game.eliminated_theater[canadian] = "med"
	spaces = Engine.logistics.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, canadian)
	assert.equal(spaces.includes(brBeach), false)
	assert.equal(spaces.includes(naples), true)
	assert.equal(spaces.includes(antwerp), false)
})

test("the Desert Army replacement exception uses Basra, Suez, or Alexandria but not Cairo", () => {
	const game = rules.setup(85, "Campaign", {})
	const desert = data.pieces.find((piece) => piece?.name === "BR Desert Army").id
	game.pieces[desert] = "eliminated:allied"
	const spaces = Engine.logistics.legalLcuReplacementSpaces(game, data, Engine.map, adjacency, desert)
	const names = spaces.map((spaceId) => data.spaces[spaceId].name)
	for (const name of ["Basra", "Suez", "Alexandria"]) assert.equal(names.includes(name), true)
	assert.equal(names.includes("Cairo"), false)
})
