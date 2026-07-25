"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine

function cardId(side, number) {
	return data.cards.find((card) => card?.side === side && card.num === number).id
}

function pieceNamed(name) {
	return data.pieces.find((piece) => piece?.name === name).id
}

function spaceNamed(name) {
	return data.spaces.find((space) => space?.name === name).id
}

function clearSpace(game, spaceId) {
	for (const pieceId of Engine.map.piecesInSpace(game, spaceId)) game.pieces[pieceId] = "available"
}

function prepareEvent(side, number, turn = 8) {
	const game = rules.setup(301 + number, "Campaign", {})
	const id = cardId(side, number)
	game.turn = turn
	game.phase = "action"
	game.state = "action_select"
	game.active = side === "allied" ? "Allied" : "Axis"
	game.action_round = 3
	game.action_history = { allied: [], axis: [] }
	game.hands[side] = [id]
	for (const pile of [game.decks[side], game.discards[side], game.removed[side]]) {
		for (let index = pile.indexOf(id); index >= 0; index = pile.indexOf(id)) pile.splice(index, 1)
	}
	return { game, id, role: game.active }
}

function startEvent(prepared) {
	return rules.action(prepared.game, prepared.role, "play_event", prepared.id)
}

test("control_nation is public, follows the first occupying nation, and normalizes old Romanian control", () => {
	const game = rules.setup(302, "Campaign", {})
	const berlin = spaceNamed("Berlin")
	assert.equal(game.control_nation[berlin], "ge")
	assert.equal(rules.view(game, "Observer").control_nation[berlin], "ge")

	const soviet = data.pieces.find((piece) => piece?.nation === "su" && piece.side === "allied").id
	const british = data.pieces.find((piece) => piece?.nation === "br" && piece.side === "allied").id
	game.pieces[soviet] = "available"
	game.pieces[british] = "available"
	Engine.map.enterSpace(game, data, soviet, berlin)
	assert.equal(game.control[berlin], "allied")
	assert.equal(game.control_nation[berlin], "su")
	Engine.map.enterSpace(game, data, british, berlin)
	assert.equal(game.control_nation[berlin], "su")

	const old = rules.setup(303, "Campaign", {})
	const romania = data.spaces.find((space) => space?.nation === "ro" && space.kind === "land").id
	old.control[romania] = "allied"
	delete old.control_nation
	const normalized = rules.normalize_game(old)
	assert.equal(normalized.schema_version, 5)
	assert.equal(normalized.control_nation[romania], "su")
	assert.deepEqual(rules.view(normalized, "Observer").control_nation, normalized.control_nation)
})

test("STAVKA retains conditional OPS and can be taken back before another public action", () => {
	const prepared = prepareEvent("allied", 3, 4)
	const moscow = spaceNamed("Moscow")
	const kursk = spaceNamed("Berlin")
	prepared.game.orders = {
		allied: { die: 6, result: "stalin_orders", fulfilled: false },
	}
	prepared.game.stand_fast[moscow] = "stalin"
	prepared.game.stand_fast[kursk] = "stalin"
	prepared.game.stand_fast_round_units[moscow] = [1]
	Engine.state.pushUndo(prepared.game)
	let game = startEvent(prepared)
	assert.equal(game.orders.allied.cancelled, true)
	assert.equal(game.orders.allied.fulfilled, true)
	assert.equal(Object.values(game.stand_fast).includes("stalin"), false)
	assert.equal(game.state, "ops_activate")
	assert.equal(game.event.dual_ops, 2)
	assert.ok(game.undo.length >= 2)
	assert.equal(rules.view(game, "Allied").actions.undo, 1)
	assert.equal(game.discards.allied.includes(prepared.id), true)
	game = rules.action(game, "Allied", "undo")
	assert.equal(game.state, "action_select")
	assert.equal(game.orders.allied.cancelled, undefined)
	assert.equal(Object.values(game.stand_fast).includes("stalin"), true)
	assert.equal(game.hands.allied.includes(prepared.id), true)
})

test("Casablanca applies neutral VP once and later control changes use effective Allied ownership", () => {
	const prepared = prepareEvent("allied", 15, 8)
	for (const name of ["Oran", "Algiers"]) prepared.game.control[spaceNamed(name)] = "allied"
	for (const space of data.spaces) if (space?.kind === "land" && ["ly", "eg"].includes(space.nation)) prepared.game.control[space.id] = "allied"
	const neutralVp = data.spaces.filter((space) => space?.kind === "land" && prepared.game.control[space.id] === "neutral").reduce((sum, space) => sum + (Number(space.vp) || 0), 0)
	const initialVp = prepared.game.vp
	const game = startEvent(prepared)
	assert.equal(game.events.casablanca, true)
	assert.equal(game.vp, initialVp - neutralVp)
	assert.equal(game.removed.allied.includes(prepared.id), true)

	const neutralSpace = data.spaces.find((space) => space?.vp && game.control[space.id] === "neutral")
	const afterEvent = game.vp
	Engine.map.setControl(game, data, neutralSpace.id, "allied", "br")
	assert.equal(game.vp, afterEvent)
	Engine.map.setControl(game, data, neutralSpace.id, "axis", "ge")
	assert.equal(game.vp, afterEvent + Number(neutralSpace.vp))
})

test("Italy Defects removes every Italian unit and leaves German-garrisoned spaces Axis controlled", () => {
	const prepared = prepareEvent("allied", 27, 10)
	const italianSpaces = data.spaces.filter((space) => space?.kind === "land" && space.nation === "it")
	for (const space of italianSpaces.slice(0, 4)) Engine.map.setControl(prepared.game, data, space.id, "allied", "br")
	const blocked = italianSpaces.at(-1)
	clearSpace(prepared.game, blocked.id)
	const german = data.pieces.find((piece) => piece?.nation === "ge").id
	prepared.game.pieces[german] = blocked.id
	const italianPieces = data.pieces.filter((piece) => piece?.nation === "it").map((piece) => piece.id)
	const game = startEvent(prepared)
	assert.equal(
		italianPieces.every((pieceId) => game.pieces[pieceId] === "removed"),
		true,
	)
	assert.equal(game.control[blocked.id], "axis")
	for (const space of italianSpaces.filter((space) => space.id !== blocked.id)) assert.equal(game.control[space.id], "allied")
	assert.equal(game.events.italy_defects, true)
	assert.equal(game.removed.allied.includes(prepared.id), true)
})

for (const spec of [
	{ number: 29, nation: "ro", flag: "romania_defects", prerequisite: null },
	{
		number: 30,
		nation: "bu",
		flag: "bulgaria_defects",
		prerequisite: "romania_defects",
	},
]) {
	test(`${spec.flag} removes all national units, respects Axis garrisons, and adds one full Soviet SCU`, () => {
		const prepared = prepareEvent("allied", spec.number, 10)
		if (spec.prerequisite) prepared.game.events[spec.prerequisite] = true
		const spaces = data.spaces.filter((space) => space?.kind === "land" && space.nation === spec.nation)
		const trigger = spaces[0]
		Engine.map.setControl(prepared.game, data, trigger.id, "allied", "su")
		const blocked = spaces.at(-1)
		clearSpace(prepared.game, blocked.id)
		const german = data.pieces.find((piece) => piece?.nation === "ge").id
		prepared.game.pieces[german] = blocked.id
		const nationalPieces = data.pieces.filter((piece) => piece?.nation === spec.nation).map((piece) => piece.id)
		for (let index = 0; index < nationalPieces.length; index++) prepared.game.pieces[nationalPieces[index]] = index % 3 === 0 ? "available" : index % 3 === 1 ? "reserve:axis" : "eliminated:axis"
		const reserveBefore = prepared.game.pieces.filter((location) => location === "reserve:allied").length
		const game = startEvent(prepared)
		assert.equal(
			nationalPieces.every((pieceId) => game.pieces[pieceId] === "removed"),
			true,
		)
		assert.equal(game.pieces.filter((location) => location === "reserve:allied").length, reserveBefore + 1)
		assert.equal(game.control[blocked.id], "axis")
		assert.equal(game.events[spec.flag], true)
		assert.equal(game.control_nation[trigger.id], "su")
		assert.equal(game.removed.allied.includes(prepared.id), true)
	})
}

test("Tito exposes only legal Yugoslav partisan spaces and keeps its public placement undoable", () => {
	const prepared = prepareEvent("allied", 42, 10)
	const target = data.spaces.find((space) => space?.kind === "land" && space.nation === "yu")
	clearSpace(prepared.game, target.id)
	prepared.game.control[target.id] = "axis"
	prepared.game.control_nation[target.id] = "ge"
	prepared.game.partisans = [target.id]
	const ypa = pieceNamed("YU YPA Army")
	prepared.game.pieces[ypa] = "available"
	let game = startEvent(prepared)
	assert.equal(game.state, "event_tito_space")
	assert.deepEqual(rules.view(game, "Allied").actions.space, [target.id])
	const beforeForgery = JSON.stringify(game)
	assert.throws(() => rules.action(game, "Allied", "space", spaceNamed("Berlin")), /illegal action/)
	assert.equal(JSON.stringify(game), beforeForgery)

	game = rules.action(game, "Allied", "space", target.id)
	assert.equal(game.pieces[ypa], target.id)
	assert.equal(game.control[target.id], "allied")
	assert.equal(game.control_nation[target.id], "yu")
	assert.equal(rules.view(game, "Allied").actions.undo, 1)
	game = rules.action(game, "Allied", "undo")
	assert.equal(game.pieces[ypa], "available")
	game = rules.action(game, "Allied", "space", target.id)
	game = rules.action(game, "Allied", "done")
	assert.equal(game.removed.allied.includes(prepared.id), true)
})

test("Maquis expands the partisan whitelist and immediately enters one undoable placement", () => {
	const prepared = prepareEvent("allied", 49, 10)
	const target = data.spaces.find((space) => space?.kind === "land" && space.nation === "fr")
	clearSpace(prepared.game, target.id)
	prepared.game.control[target.id] = "axis"
	prepared.game.control_nation[target.id] = "ge"
	let game = startEvent(prepared)
	assert.equal(game.state, "partisan_space")
	assert.equal(rules.view(game, "Allied").actions.space.includes(target.id), true)
	const illegal = data.spaces.find((space) => space?.kind === "land" && space.nation === "ge").id
	const beforeForgery = JSON.stringify(game)
	assert.throws(() => rules.action(game, "Allied", "space", illegal), /illegal action/)
	assert.equal(JSON.stringify(game), beforeForgery)

	game = rules.action(game, "Allied", "space", target.id)
	assert.equal(game.partisans.includes(target.id), true)
	assert.equal(rules.view(game, "Allied").actions.undo, 1)
	game = rules.action(game, "Allied", "undo")
	assert.equal(game.partisans.includes(target.id), false)
	game = rules.action(game, "Allied", "space", target.id)
	game = rules.action(game, "Allied", "done")
	assert.equal(game.events.maquis, true)
	assert.equal(game.removed.allied.includes(prepared.id), true)
})

for (const number of [40, 51]) {
	test(`Anti-Partisan Sweep ${number} removes two server-whitelisted markers with undo`, () => {
		const prepared = prepareEvent("axis", number, 10)
		const spaces = data.spaces
			.filter((space) => space?.kind === "land")
			.slice(0, 3)
			.map((space) => space.id)
		prepared.game.partisans = spaces.slice()
		let game = startEvent(prepared)
		assert.equal(game.state, "event_remove_partisans")
		assert.deepEqual(
			rules.view(game, "Axis").actions.space,
			spaces.slice().sort((a, b) => a - b),
		)
		const beforeForgery = JSON.stringify(game)
		assert.throws(() => rules.action(game, "Axis", "space", spaceNamed("Berlin")), /illegal action/)
		assert.equal(JSON.stringify(game), beforeForgery)
		game = rules.action(game, "Axis", "space", spaces[0])
		assert.equal(rules.view(game, "Axis").actions.undo, 1)
		game = rules.action(game, "Axis", "undo")
		assert.deepEqual(game.partisans, spaces)
		game = rules.action(game, "Axis", "space", spaces[0])
		game = rules.action(game, "Axis", "space", spaces[1])
		assert.equal(rules.view(game, "Axis").actions.done, 1)
		game = rules.action(game, "Axis", "done")
		assert.deepEqual(game.partisans, [spaces[2]])
		assert.equal(game.discards.axis.includes(prepared.id), true)
	})
}
