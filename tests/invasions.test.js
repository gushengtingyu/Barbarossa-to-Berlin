"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { renderLog } = require("./i18n_helpers.js")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine
const adjacency = Engine.map.buildAdjacency(data)

function alliedCard(number) {
	return data.cards.find((card) => card?.side === "allied" && card.num === number).id
}

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

function piece(name) {
	return data.pieces.find((entry) => entry?.name === name).id
}

function prepareInvasion(number, turn = 6) {
	const game = rules.setup(1700 + number, "Campaign", {})
	const cardId = alliedCard(number)
	game.turn = turn
	game.phase = "action"
	game.state = "action_select"
	game.active = "Allied"
	game.action_round = 1
	game.action_history = { allied: [], axis: [] }
	game.events.us_entry = true
	game.events.us_buildup = true
	game.hands.allied = [cardId]
	for (const pile of [game.decks.allied, game.discards.allied, game.removed.allied]) for (let index = pile.indexOf(cardId); index >= 0; index = pile.indexOf(cardId)) pile.splice(index, 1)
	return { game, cardId }
}

function startInvasion(number, turn = 6) {
	let { game, cardId } = prepareInvasion(number, turn)
	game = rules.action(game, "Allied", "play_event", cardId)
	return { game, cardId }
}

function combatGame(state, active, attackSpaces) {
	const game = rules.setup(2001, "Campaign", {})
	game.pieces.fill(Engine.unitLocations.REMOVED)
	game.reduced = []
	game.turn = 6
	game.phase = "action"
	game.action_round = 2
	game.state = state
	game.active = active
	const beach = space("Beachhead D")
	game.beachheads[beach] = { type: "allied", card_id: 16 }
	game.control[beach] = "allied"
	game.action = {
		mode: "ops",
		points: 1,
		attack_spaces: attackSpaces,
		move_spaces: [],
		activation_cost: {},
		activation_supply: {},
		moved: [],
		sr_moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}
	return game
}

function beachheadRemovalLogs(game) {
	return game.log.filter((entry) => entry?.key === "invasions.log.beachhead_removed")
}

test("optional Rule 7.62 blocks Allied invasions before Summer 1942 but not from that turn onward", () => {
	const { game, cardId } = prepareInvasion(1, 5)
	game.options.no_invasions_before_summer_42 = true
	assert.equal(Engine.invasions.canPlay(game, data, cardId), false)
	assert.equal(rules.view(game, "Allied").actions.play_event?.includes(cardId) || false, false)
	game.turn = 6
	assert.equal(Engine.invasions.canPlay(game, data, cardId), true)
	assert.equal(rules.view(game, "Allied").actions.play_event.includes(cardId), true)
})

function clearNorthAfrica(game) {
	for (const entry of data.spaces) if (entry?.kind === "land" && ["dz", "tn", "ly", "eg"].includes(entry.nation)) game.control[entry.id] = "allied"
}

test("Rule 7.63 Sledgehammer creates one Allied beachhead, lands every printed unit, and activates Vichy", () => {
	let { game, cardId } = startInvasion(16)
	assert.equal(game.state, "event_invasion_beach")
	assert.deepEqual(
		rules.view(game, "Allied").actions.space.map((spaceId) => Engine.invasions.beachLetter(data.spaces[spaceId])),
		["A", "B", "D"],
	)

	const beach = space("Beachhead D")
	game = rules.action(game, "Allied", "space", beach)
	assert.equal(rules.view(game, "Allied").actions.undo, 1)
	game = rules.action(game, "Allied", "undo")
	assert.equal(game.state, "event_invasion_beach")
	assert.equal(game.beachheads[beach], undefined)
	assert.equal(game.events.sledgehammer, undefined)
	game = rules.action(game, "Allied", "space", beach)
	const br1 = piece("BR 1 Army")
	const landed = Engine.map.friendlyPiecesInSpace(game, data, "allied", beach)
	assert.equal(landed.includes(br1), true)
	assert.deepEqual(
		landed.filter((pieceId) => data.pieces[pieceId].nation === "us" && data.pieces[pieceId].size === "scu").sort((a, b) => a - b),
		[427, 428],
	)
	assert.equal(Engine.combat.isReduced(game, br1), true)
	assert.equal(
		landed.filter((pieceId) => pieceId !== br1).every((pieceId) => !Engine.combat.isReduced(game, pieceId)),
		true,
	)
	assert.equal(game.beachheads[beach].type, "allied")
	assert.equal(game.control[beach], "allied")
	assert.equal(game.events.sledgehammer, true)
	assert.equal(game.events.vichy_war, true)
	assert.equal(game.invasion_usage.used, cardId)
	assert.equal(game.state, "event_invasion_advance")

	for (const advance of landed) {
		assert.equal(rules.view(game, "Allied").actions.piece.includes(advance), true)
		game = rules.action(game, "Allied", "piece", advance)
		assert.equal(game.pieces[advance], space("Calais"))
	}
	assert.equal(game.beachheads[beach].type, "allied")
	assert.equal(game.control[beach], "allied")
	game = rules.action(game, "Allied", "continue")
	game = rules.action(game, "Allied", "done")
	assert.deepEqual(Engine.map.friendlyPiecesInSpace(game, data, "allied", beach), [])
	assert.equal(game.beachheads[beach].type, "allied")
	assert.equal(game.control[beach], "allied")
	assert.equal(game.active, "Axis")
	assert.equal(game.invasion, null)
	assert.equal(game.removed.allied.includes(cardId), true)
})

test("Avalanche, Shingle, and Anvil-Dragoon use their printed single-beach units and reserve entries", () => {
	for (const scenario of [
		{
			card: 45,
			letter: "N",
			landing: ["US 5 Army"],
			landingNations: [],
			reserveNations: ["br"],
			scus: [414],
			shingle: false,
		},
		{
			card: 46,
			letter: "K",
			landing: [],
			landingNations: ["us", "br"],
			reserveNations: [],
			scus: [415, 433],
			shingle: true,
		},
		{
			card: 52,
			letter: "J",
			landing: ["US 7 Army", "FF Army"],
			landingNations: [],
			reserveNations: ["us", "ff"],
			scus: [432, 437],
			shingle: false,
		},
	]) {
		let { game } = prepareInvasion(scenario.card)
		clearNorthAfrica(game)
		game.control[space("Syracuse")] = "allied"
		game = rules.action(game, "Allied", "play_event", alliedCard(scenario.card))
		const beach = space(`Beachhead ${scenario.letter}`)
		assert.equal(rules.view(game, "Allied").actions.space.includes(beach), true)
		game = rules.action(game, "Allied", "space", beach)
		const landed = Engine.map.friendlyPiecesInSpace(game, data, "allied", beach)
		for (const name of scenario.landing) {
			const pieceId = piece(name)
			assert.equal(landed.includes(pieceId), true, `${scenario.card} ${name}`)
			assert.equal(Engine.combat.isReduced(game, pieceId), true, `${scenario.card} ${name} reduced`)
		}
		for (const nation of scenario.landingNations)
			assert.equal(
				landed.some((pieceId) => data.pieces[pieceId].nation === nation && data.pieces[pieceId].size === "scu"),
				true,
				`${scenario.card} ${nation} landing`,
			)
		for (const nation of scenario.reserveNations)
			assert.equal(
				data.pieces.some((entry) => entry?.nation === nation && entry.size === "scu" && game.pieces[entry.id] === "reserve:allied"),
				true,
				`${scenario.card} ${nation} reserve`,
			)
		assert.equal(
			scenario.scus.every((pieceId) => landed.includes(pieceId) || game.pieces[pieceId] === "reserve:allied"),
			true,
			`${scenario.card} uses its authored board SCUs`,
		)
		assert.equal(game.beachheads[beach].shingle, scenario.shingle)
	}
})

test("printed invasion beach links are enforced for all double-beach invasions", () => {
	for (const [a, b] of [
		["A", "B"],
		["D", "E"],
		["F", "G"],
		["K", "L"],
		["P", "Q"],
	])
		assert.equal(Engine.invasions.linkedBeachLetters(a, b), true, `${a}-${b}`)
	for (const [a, b] of [
		["A", "D"],
		["D", "F"],
		["K", "S"],
		["N", "Q"],
		["Q", "S"],
		["R", "U"],
	])
		assert.equal(Engine.invasions.linkedBeachLetters(a, b), false, `${a}-${b}`)
})

test("Torch allows one Allied beachhead or linked Allied and US beachheads", () => {
	let { game } = startInvasion(1)
	assert.equal(game.state, "event_invasion_mode")
	assert.equal(rules.view(game, "Allied").actions.single_beachhead, 1)
	assert.equal(rules.view(game, "Allied").actions.double_beachheads, 1)

	game = rules.action(game, "Allied", "single_beachhead")
	assert.deepEqual(
		rules.view(game, "Allied").actions.space.map((spaceId) => Engine.invasions.beachLetter(data.spaces[spaceId])),
		["K", "L", "S"],
	)
	game = rules.action(game, "Allied", "space", space("Beachhead S"))
	const singleLanding = Engine.map.friendlyPiecesInSpace(game, data, "allied", space("Beachhead S"))
	assert.equal(singleLanding.includes(piece("BR 1 Army")), true)
	assert.equal(singleLanding.filter((pieceId) => data.pieces[pieceId].nation === "us").length, 2)
	assert.equal(game.beachheads[space("Beachhead S")].type, "allied")

	game = startInvasion(1).game
	game = rules.action(game, "Allied", "double_beachheads")
	assert.deepEqual(
		rules.view(game, "Allied").actions.space.map((spaceId) => Engine.invasions.beachLetter(data.spaces[spaceId])),
		["K", "L"],
	)
	game = rules.action(game, "Allied", "space", space("Beachhead K"))
	assert.deepEqual(rules.view(game, "Allied").actions.space, [space("Beachhead L")])
	assert.throws(() => rules.action(game, "Allied", "space", space("Beachhead S")), /illegal action/)
	game = rules.action(game, "Allied", "space", space("Beachhead L"))
	assert.equal(game.beachheads[space("Beachhead K")].type, "allied")
	assert.equal(game.beachheads[space("Beachhead L")].type, "us")
	assert.deepEqual(Engine.map.friendlyPiecesInSpace(game, data, "allied", space("Beachhead K")), [piece("BR 1 Army")])
	assert.equal(Engine.map.friendlyPiecesInSpace(game, data, "allied", space("Beachhead L")).filter((pieceId) => data.pieces[pieceId].nation === "us").length, 2)
})

test("Overlord uses full-strength LCUs and supports either one Allied or linked BR and US beachheads", () => {
	let early = prepareInvasion(33, 12).game
	assert.equal(Engine.invasions.canPlay(early, data, alliedCard(33)), false)

	let { game } = startInvasion(33, 13)
	assert.equal(game.state, "event_invasion_mode")
	game = rules.action(game, "Allied", "single_beachhead")
	game = rules.action(game, "Allied", "space", space("Beachhead D"))
	for (const name of ["BR 2 Army", "US 1 Army"]) {
		assert.equal(game.pieces[piece(name)], space("Beachhead D"))
		assert.equal(Engine.combat.isReduced(game, piece(name)), false)
	}
	assert.equal(game.beachheads[space("Beachhead D")].type, "allied")
	assert.equal(data.pieces.filter((entry) => entry?.nation === "br" && entry.size === "scu" && game.pieces[entry.id] === "reserve:allied").length >= 1, true)
	assert.equal(data.pieces.filter((entry) => entry?.nation === "us" && entry.size === "scu" && game.pieces[entry.id] === "reserve:allied").length >= 2, true)

	game = startInvasion(33, 13).game
	game = rules.action(game, "Allied", "double_beachheads")
	game = rules.action(game, "Allied", "space", space("Beachhead D"))
	assert.deepEqual(rules.view(game, "Allied").actions.space, [space("Beachhead E")])
	game = rules.action(game, "Allied", "space", space("Beachhead E"))
	assert.equal(game.beachheads[space("Beachhead D")].type, "br")
	assert.equal(game.beachheads[space("Beachhead E")].type, "us")
	assert.equal(game.pieces[piece("BR 2 Army")], space("Beachhead D"))
	assert.equal(game.pieces[piece("US 1 Army")], space("Beachhead E"))
	assert.equal(Engine.combat.isReduced(game, piece("BR 2 Army")), false)
	assert.equal(Engine.combat.isReduced(game, piece("US 1 Army")), false)
})

test("Husky splits the reserve-eligible 8th and 7th Armies across linked P-Q beaches", () => {
	let { game, cardId } = prepareInvasion(34)
	clearNorthAfrica(game)
	game.control[space("Syracuse")] = "allied"
	game.pieces[piece("BR 8 Army")] = "reserve:allied"
	game.pieces[piece("US 7 Army")] = "reserve:allied"
	assert.equal(Engine.invasions.canPlay(game, data, cardId), true)
	game = rules.action(game, "Allied", "play_event", cardId)
	game = rules.action(game, "Allied", "double_beachheads")
	assert.deepEqual(
		rules.view(game, "Allied").actions.space.map((spaceId) => Engine.invasions.beachLetter(data.spaces[spaceId])),
		["P", "Q"],
	)
	game = rules.action(game, "Allied", "space", space("Beachhead P"))
	assert.deepEqual(rules.view(game, "Allied").actions.space, [space("Beachhead Q")])
	game = rules.action(game, "Allied", "space", space("Beachhead Q"))
	assert.equal(game.pieces[piece("BR 8 Army")], space("Beachhead P"))
	assert.equal(game.pieces[piece("US 7 Army")], space("Beachhead Q"))
	assert.equal(Engine.combat.isReduced(game, piece("BR 8 Army")), true)
	assert.equal(Engine.combat.isReduced(game, piece("US 7 Army")), true)
	assert.equal(game.beachheads[space("Beachhead P")].type, "br")
	assert.equal(game.beachheads[space("Beachhead Q")].type, "us")
})

test("Round-Up requires linked BR and US beachheads and is mutually exclusive with Overlord", () => {
	let { game } = startInvasion(50)
	assert.equal(game.state, "event_invasion_beach")
	assert.deepEqual(
		rules.view(game, "Allied").actions.space.map((spaceId) => Engine.invasions.beachLetter(data.spaces[spaceId])),
		["A", "B", "D", "E"],
	)
	game = rules.action(game, "Allied", "space", space("Beachhead A"))
	assert.deepEqual(rules.view(game, "Allied").actions.space, [space("Beachhead B")])
	game = rules.action(game, "Allied", "space", space("Beachhead B"))
	assert.equal(game.pieces[piece("BR 2 Army")], space("Beachhead A"))
	assert.equal(game.pieces[piece("US 1 Army")], space("Beachhead B"))
	assert.equal(Engine.combat.isReduced(game, piece("BR 2 Army")), true)
	assert.equal(Engine.combat.isReduced(game, piece("US 1 Army")), true)
	assert.equal(game.events.round_up, true)

	const afterRoundUp = prepareInvasion(33, 13).game
	afterRoundUp.events.round_up = true
	assert.equal(Engine.invasions.canPlay(afterRoundUp, data, alliedCard(33)), false)
	const afterOverlord = prepareInvasion(50).game
	afterOverlord.events.overlord = true
	assert.equal(Engine.invasions.canPlay(afterOverlord, data, alliedCard(50)), false)
})

test("each physical Allied, BR, and US beachhead marker can only be on the map once", () => {
	const sledge = prepareInvasion(16).game
	sledge.beachheads[space("Beachhead K")] = { type: "allied" }
	assert.equal(Engine.invasions.canPlay(sledge, data, alliedCard(16)), false)

	const overlord = prepareInvasion(33, 13).game
	overlord.beachheads[space("Beachhead K")] = { type: "allied" }
	assert.equal(Engine.invasions.canPlay(overlord, data, alliedCard(33)), true)
	Engine.invasions.begin(overlord, data, alliedCard(33))
	assert.deepEqual(overlord.invasion.markers, ["br", "us"])

	const roundUp = prepareInvasion(50).game
	roundUp.beachheads[space("Beachhead K")] = { type: "br" }
	assert.equal(Engine.invasions.canPlay(roundUp, data, alliedCard(50)), false)
})

test("legacy schema-v2 single-beach invasion state normalizes into the multi-beach shape", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1780, {})
	game.invasion = {
		card_id: 16,
		marker: "allied",
		landing_units: [],
		reserve_units: [],
		beach_id: space("Beachhead D"),
		connected_land: space("Calais"),
	}
	Engine.state.normalizeGame(game)
	assert.deepEqual(game.invasion.markers, ["allied"])
	assert.equal(game.invasion.marker_option, "single")
	assert.deepEqual(game.invasion.beaches, [
		{
			space_id: space("Beachhead D"),
			letter: null,
			marker: "allied",
			connected_land: space("Calais"),
		},
	])
})

test("printed beach restrictions enforce North Africa, Syracuse, existing beachheads, J versus A/B, and winter A-I", () => {
	let { game } = prepareInvasion(46)
	assert.deepEqual(Engine.invasions.legalBeachLetters(game, data, Engine.invasions.SPECS[46]), ["K", "L", "S"])
	clearNorthAfrica(game)
	assert.equal(Engine.invasions.legalBeachLetters(game, data, Engine.invasions.SPECS[46]).includes("O"), false)
	game.control[space("Syracuse")] = "allied"
	assert.equal(Engine.invasions.legalBeachLetters(game, data, Engine.invasions.SPECS[46]).includes("O"), true)
	game.beachheads[space("Beachhead K")] = { type: "allied" }
	assert.equal(Engine.invasions.legalBeachLetters(game, data, Engine.invasions.SPECS[46]).includes("K"), false)

	let sledge = prepareInvasion(16, 8).game
	assert.deepEqual(Engine.invasions.legalBeachLetters(sledge, data, Engine.invasions.SPECS[16]), [])
	sledge.turn = 6
	sledge.beachheads[space("Beachhead A")] = { type: "allied" }
	clearNorthAfrica(sledge)
	sledge.control[space("Syracuse")] = "allied"
	assert.equal(
		Engine.invasions
			.legalBeachLetters(sledge, data, {
				...Engine.invasions.SPECS[16],
				letters: ["J"],
			})
			.includes("J"),
		false,
	)
})

test("one invasion per turn is enforced and Avalanche follows the US 7th Army restriction", () => {
	let { game } = prepareInvasion(45)
	assert.equal(Engine.invasions.canPlay(game, data, alliedCard(45)), true)
	game.pieces[piece("US 7 Army")] = space("Suez")
	assert.equal(Engine.invasions.canPlay(game, data, alliedCard(45)), false)
	game.pieces[piece("US 7 Army")] = "available"
	game.invasion_usage = { turn: game.turn, used: alliedCard(16) }
	assert.equal(Engine.invasions.canPlay(game, data, alliedCard(45)), false)
	game.turn++
	assert.equal(Engine.invasions.canPlay(game, data, alliedCard(45)), true)
})

test("an occupied landing connection forces the invasion combat before the Allied action may end", () => {
	let { game } = startInvasion(16)
	const defender = data.pieces.find((entry) => entry?.nation === "ge" && entry.size === "scu").id
	game.pieces[defender] = space("Calais")
	game = rules.action(game, "Allied", "space", space("Beachhead D"))
	assert.equal(game.state, "ops_combat")
	const actions = rules.view(game, "Allied").actions
	assert.ok(actions.piece.length > 0)
	assert.ok(actions.piece.every((pieceId) => game.pieces[pieceId] === space("Beachhead D")))
	assert.equal(actions.done, undefined)
})

test("combat advance may empty an invasion beach without removing its beachhead", () => {
	const beach = space("Beachhead D")
	const land = space("Calais")
	const retreat = space("Antwerp")
	const allied = piece("BR SCU")
	const axis = piece("GE SCU")
	let game = combatGame("combat_retreat", "Axis", [beach])
	game.pieces[allied] = beach
	game.pieces[axis] = retreat
	game.control[land] = "axis"
	game.control[retreat] = "axis"
	game.invasion = {
		card_id: 16,
		beaches: [{ space_id: beach, connected_land: land }],
		landing_units: [{ piece_id: allied }],
		reserve_units: [],
	}
	game.combat = {
		origin_spaces: [beach],
		defender_space: land,
		attackers: [allied],
		defenders: [axis],
		retreated_defenders: [],
		attacker_side: "allied",
		defender_side: "axis",
		defender_loss: 1,
		attacker_loss: 0,
		retreat_distance: 1,
		retreat_pending: [],
		retreat_paths: { [axis]: [retreat] },
		retreat_vacated: [land],
	}

	game = rules.action(game, "Axis", "done")
	assert.equal(game.state, "combat_advance")
	game = rules.action(game, "Allied", "piece", allied)
	assert.equal(rules.view(game, "Allied").actions.move.includes(land), true)
	game = rules.action(game, "Allied", "move", land)
	assert.equal(game.pieces[allied], land)
	assert.equal(game.beachheads[beach].type, "allied")
	assert.equal(game.control[beach], "allied")
	assert.equal(beachheadRemovalLogs(game).length, 0)
})

test("combat losses remove a beachhead when its last Allied unit is eliminated as attacker or defender", () => {
	const beach = space("Beachhead D")
	const land = space("Calais")
	const allied = piece("BR SCU")
	const axis = piece("GE SCU")
	for (const scenario of [
		{
			state: "combat_defender_losses",
			attackSpaces: [land],
			originSpaces: [land],
			defenderSpace: beach,
			attackers: [axis],
			defenders: [allied],
			attackerSide: "axis",
			defenderSide: "allied",
			defenderLoss: 1,
			attackerLoss: 0,
		},
		{
			state: "combat_attacker_losses",
			attackSpaces: [beach],
			originSpaces: [beach],
			defenderSpace: land,
			attackers: [allied],
			defenders: [axis],
			attackerSide: "allied",
			defenderSide: "axis",
			defenderLoss: 0,
			attackerLoss: 1,
		},
	]) {
		let game = combatGame(scenario.state, "Allied", scenario.attackSpaces)
		game.pieces[allied] = beach
		game.pieces[axis] = land
		Engine.combat.setReduced(game, allied, true)
		game.combat = {
			origin_spaces: scenario.originSpaces,
			defender_space: scenario.defenderSpace,
			attackers: scenario.attackers,
			defenders: scenario.defenders,
			retreated_defenders: [],
			attacker_side: scenario.attackerSide,
			defender_side: scenario.defenderSide,
			defender_loss: scenario.defenderLoss,
			attacker_loss: scenario.attackerLoss,
			defender_loss_taken: 0,
			attacker_loss_taken: 0,
			southwest_loss_taken: false,
		}

		assert.equal(rules.view(game, "Allied").actions.piece.includes(allied), true)
		game = rules.action(game, "Allied", "piece", allied)
		assert.equal(game.beachheads[beach], undefined)
		assert.equal(game.control[beach], "neutral")
		assert.equal(beachheadRemovalLogs(game).length, 1)
	}
})

test("an LCU replacement surviving in the beach space preserves the beachhead", () => {
	const beach = space("Beachhead D")
	const land = space("Calais")
	const army = piece("BR 1 Army")
	const replacement = piece("BR SCU")
	const axis = piece("GE SCU")
	let game = combatGame("combat_attacker_losses", "Allied", [beach])
	game.pieces[army] = beach
	game.pieces[replacement] = Engine.unitLocations.reserve("allied")
	game.pieces[axis] = land
	Engine.combat.setReduced(game, army, true)
	game.combat = {
		origin_spaces: [beach],
		defender_space: land,
		attackers: [army],
		defenders: [axis],
		retreated_defenders: [],
		attacker_side: "allied",
		defender_side: "axis",
		defender_loss: 0,
		attacker_loss: 3,
		defender_loss_taken: 0,
		attacker_loss_taken: 0,
		southwest_loss_taken: false,
	}

	game = rules.action(game, "Allied", "piece", army)
	assert.equal(game.pieces[replacement], beach)
	assert.equal(game.beachheads[beach].type, "allied")
	assert.equal(game.control[beach], "allied")
	assert.equal(beachheadRemovalLogs(game).length, 0)
})

test("a previously retreated unit eliminated by combat removes its unsupported beachhead", () => {
	const beach = space("Beachhead D")
	const land = space("Calais")
	const allied = piece("BR SCU")
	const attackers = ["GE 11 Army", "GE 2 Army", "GE 16 Army"].map(piece)
	let game = combatGame("combat_defender_cc", "Allied", [land])
	game.pieces[allied] = beach
	for (const attacker of attackers) game.pieces[attacker] = land
	game.control[land] = "axis"
	game.combat = {
		origin_spaces: [land],
		defender_space: beach,
		attackers,
		defenders: [],
		retreated_defenders: [allied],
		attacker_side: "axis",
		defender_side: "allied",
		cc_played: { allied: [], axis: [] },
		cc_from_hand: { allied: [], axis: [] },
	}

	game = rules.action(game, "Allied", "continue")
	assert.equal(game.combat.defender_loss > 0, true)
	assert.equal(game.pieces[allied], Engine.unitLocations.eliminated("allied"))
	assert.equal(game.beachheads[beach], undefined)
	assert.equal(game.control[beach], "neutral")
	assert.equal(beachheadRemovalLogs(game).length, 1)
})

test("failed retreat elimination removes the beachhead when its last Allied unit is lost", () => {
	const beach = space("Beachhead D")
	const land = space("Calais")
	const allied = piece("BR SCU")
	const axis = piece("GE SCU")
	let game = combatGame("combat_retreat_option", "Allied", [land])
	game.pieces[allied] = beach
	game.pieces[axis] = land
	game.control[land] = "axis"
	game.combat = {
		origin_spaces: [land],
		defender_space: beach,
		attackers: [axis],
		defenders: [allied],
		retreated_defenders: [],
		attacker_side: "axis",
		defender_side: "allied",
		defender_loss: 1,
		attacker_loss: 0,
		defender_loss_taken: 0,
		attacker_loss_taken: 0,
		southwest_loss_taken: false,
	}

	game = rules.action(game, "Allied", "continue")
	assert.equal(game.state, "combat_retreat")
	assert.deepEqual(game.combat.retreat_pending, [])
	assert.equal(game.pieces[allied], Engine.unitLocations.eliminated("allied"))
	assert.equal(game.beachheads[beach], undefined)
	assert.equal(game.control[beach], "neutral")
	assert.equal(beachheadRemovalLogs(game).length, 1)
})

test("beachhead supply is Full within two spaces and Limited beyond, with nationality-specific SR entry", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1750, {})
	const beach = space("Beachhead D")
	const path = [space("Calais"), space("Antwerp"), space("Ardennes")]
	game.beachheads[beach] = { type: "allied", card_id: 16 }
	game.control[beach] = "allied"
	for (const spaceId of path) game.control[spaceId] = "allied"
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "allied", path[0], "br"), "full")
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "allied", path[1], "br"), "full")
	assert.equal(Engine.map.traceSupply(game, data, adjacency, "allied", path[2], "br"), "limited")

	const usScu = data.pieces.find((entry) => entry?.nation === "us" && entry.size === "scu" && game.pieces[entry.id] === "available").id
	const brScu = data.pieces.find((entry) => entry?.nation === "br" && entry.size === "scu" && game.pieces[entry.id] === "available").id
	game.pieces[usScu] = "reserve:allied"
	game.pieces[brScu] = "reserve:allied"
	game.beachheads[beach] = { type: "us", card_id: 33 }
	assert.equal(Engine.map.legalReserveEntrySpaces(game, data, adjacency, usScu).includes(beach), true)
	assert.equal(Engine.map.legalReserveEntrySpaces(game, data, adjacency, brScu).includes(beach), false)
})

test("Axis attack on an empty beachhead removes it without a combat die roll", () => {
	let game = rules.setup(1760, "Campaign", {})
	const beach = space("Beachhead D")
	const origin = space("Calais")
	const attacker = data.pieces.find((entry) => entry?.nation === "ge" && entry.size === "scu").id
	game.pieces.fill(0)
	game.pieces[attacker] = origin
	game.control[origin] = "axis"
	game.control[beach] = "allied"
	game.beachheads[beach] = { type: "allied", card_id: 16 }
	game.phase = "action"
	game.state = "ops_combat"
	game.active = "Axis"
	game.turn = 2
	game.action_round = 2
	game.action = {
		mode: "ops",
		points: 1,
		attack_spaces: [origin],
		move_spaces: [],
		activation_supply: {},
		moved: [],
		attacked: [],
		defended: [],
		used_pieces: [],
		entrenching: [],
		piece: null,
	}

	game = rules.action(game, "Axis", "piece", attacker)
	game = rules.action(game, "Axis", "space", beach)
	assert.equal(game.state, "combat_confirm")
	assert.match(rules.view(game, "Axis").prompt, /无需掷骰/)
	game = rules.action(game, "Axis", "confirm")
	assert.equal(game.state, "action_select")
	assert.equal(game.beachheads[beach], undefined)
	assert.equal(game.control[beach], "neutral")
	assert.ok(renderLog(game).some((entry) => /无需掷骰/.test(entry)))
})

test("unsupported beachheads are removed in Attrition while a beachhead that supplies a compatible unit remains", () => {
	const game = Engine.setup.createInitialState(data, "Campaign", 1770, {})
	const empty = space("Beachhead D")
	const supported = space("Beachhead K")
	const usScu = data.pieces.find((entry) => entry?.nation === "us" && entry.size === "scu").id
	game.beachheads[empty] = { type: "allied" }
	game.beachheads[supported] = { type: "us" }
	game.control[empty] = "allied"
	game.control[supported] = "allied"
	game.control[space("Oran")] = "allied"
	game.pieces[usScu] = space("Oran")
	assert.deepEqual(Engine.invasions.removeUnsupportedBeachheads(game, data, adjacency), [empty])
	assert.equal(game.beachheads[supported].type, "us")
	assert.match(renderLog(game).at(-1), /已无盟军单位可向其追溯补给/)
})

test("Rule 7.63 lets the 8th and supplied 7th Armies enter Allied Reserve after an Allied action", () => {
	const game = rules.setup(1781, "Campaign", {})
	const br8 = piece("BR 8 Army")
	const us7 = piece("US 7 Army")
	clearNorthAfrica(game)
	game.turn = 6
	game.phase = "action"
	game.state = "ops_activate"
	game.active = "Allied"
	game.action_round = 2
	game.action_history = { allied: [], axis: ["ops", "ops"] }
	game.action = { mode: "ops" }
	game.pieces[br8] = space("Alexandria")
	game.pieces[us7] = space("Suez")
	Engine.combat.setReduced(game, br8, true)
	Engine.combat.setReduced(game, us7, true)

	Engine.turn.finishAction(game, "allied")
	assert.equal(game.state, "allied_invasion_reserve")
	assert.deepEqual(
		rules.view(game, "Allied").actions.piece.sort((a, b) => a - b),
		[br8, us7].sort((a, b) => a - b),
	)

	let next = rules.action(game, "Allied", "piece", br8)
	assert.equal(next.pieces[br8], "reserve:allied")
	assert.equal(Engine.combat.isReduced(next, br8), false)
	assert.equal(Engine.map.legalReserveEntrySpaces(next, data, adjacency, br8).length, 0)
	next = rules.action(next, "Allied", "piece", us7)
	assert.equal(next.pieces[us7], "reserve:allied")
	assert.equal(Engine.combat.isReduced(next, us7), false)
	next = rules.action(next, "Allied", "done")
	assert.equal(next.active, "Axis")
	assert.equal(next.action_round, 3)
	assert.equal(next.state, "action_select")
})

test("the no-more-invasions declaration is available only at the start of Allied turn 14+ round one", () => {
	let { game } = prepareInvasion(34, 14)
	assert.equal(rules.view(game, "Allied").actions.end_invasions, 1)
	game = rules.action(game, "Allied", "end_invasions")
	assert.equal(game.events.no_more_invasions, true)
	assert.equal(rules.view(game, "Allied").actions.end_invasions, undefined)
	assert.equal(Engine.invasions.canPlay(game, data, alliedCard(34)), false)

	const early = prepareInvasion(34, 13).game
	assert.equal(Engine.invasions.canDeclareNoMoreInvasions(early), false)
	const lateRound = prepareInvasion(34, 14).game
	lateRound.action_round = 2
	assert.equal(Engine.invasions.canDeclareNoMoreInvasions(lateRound), false)
	const afterAction = prepareInvasion(34, 14).game
	afterAction.action_history.allied.push("ops")
	assert.equal(Engine.invasions.canDeclareNoMoreInvasions(afterAction), false)
})

test("Husky converts to normal BR and US reinforcements without invasion prerequisites after the declaration", () => {
	let { game, cardId } = prepareInvasion(34, 14)
	const br8 = piece("BR 8 Army")
	const us7 = piece("US 7 Army")
	game.events.us_buildup = false
	game.pieces[us7] = space("Suez")
	game = rules.action(game, "Allied", "end_invasions")
	assert.equal(Engine.invasions.canPlayAsReinforcement(game, data, Engine.map, adjacency, cardId), true)

	assert.equal(rules.view(game, "Allied").actions.play_event.includes(cardId), true)
	game = rules.action(game, "Allied", "play_event", cardId)
	assert.equal(game.state, "event_reinforcement_lcu")
	assert.deepEqual(game.reinforcement.lcus, [br8])
	assert.equal(game.reinforcement_usage.allied.br, true)
	assert.equal(game.reinforcement_usage.allied.usa, true)
	assert.equal(
		game.reinforcement.reserve_scus.every((pieceId) => game.pieces[pieceId] === "reserve:allied"),
		true,
	)
	const destinations = rules.view(game, "Allied").actions.space
	assert.equal(destinations.includes(space("Alexandria")), true)
	game = rules.action(game, "Allied", "space", space("Alexandria"))
	assert.equal(game.pieces[br8], space("Alexandria"))
	assert.equal(Engine.combat.isReduced(game, br8), false)
	assert.equal(game.state, "allied_invasion_reserve")
	assert.equal(game.removed.allied.includes(cardId), true)

	for (const number of [1, 16, 33, 50]) {
		const prepared = prepareInvasion(number, 14)
		prepared.game.events.no_more_invasions = true
		assert.equal(Engine.invasions.canPlayAsReinforcement(prepared.game, data, Engine.map, adjacency, prepared.cardId), false)
	}
})

test("converted Husky ships a reserve 8th Army to the Pacific and converted Shingle uses both national reinforcement allowances", () => {
	let { game, cardId } = prepareInvasion(34, 14)
	const br8 = piece("BR 8 Army")
	game.events.no_more_invasions = true
	game.pieces[br8] = "reserve:allied"
	assert.equal(Engine.invasions.canPlayAsReinforcement(game, data, Engine.map, adjacency, cardId), true)
	Engine.invasions.beginReinforcement(game, data, Engine.map, adjacency, cardId)
	assert.equal(game.pieces[br8], "removed")
	assert.deepEqual(game.reinforcement.lcus, [piece("US 7 Army")])
	;({ game, cardId } = prepareInvasion(46, 14))
	game.events.no_more_invasions = true
	assert.equal(Engine.invasions.canPlayAsReinforcement(game, data, Engine.map, adjacency, cardId), true)
	Engine.invasions.beginReinforcement(game, data, Engine.map, adjacency, cardId)
	assert.equal(game.reinforcement, null)
	assert.equal(game.reinforcement_usage.allied.br, true)
	assert.equal(game.reinforcement_usage.allied.usa, true)
	const reserves = data.pieces.filter((entry) => entry?.size === "scu" && ["br", "us"].includes(entry.nation) && game.pieces[entry.id] === "reserve:allied")
	assert.equal(
		reserves.some((entry) => entry.nation === "br"),
		true,
	)
	assert.equal(
		reserves.some((entry) => entry.nation === "us"),
		true,
	)
	assert.equal(Engine.invasions.canPlayAsReinforcement(game, data, Engine.map, adjacency, alliedCard(52)), false)
})

test("converted Western LCUs may use compatible beachheads but not the Shingle beachhead", () => {
	const { game, cardId } = prepareInvasion(45, 14)
	const us5 = piece("US 5 Army")
	const normalBeach = space("Beachhead D")
	const shingleBeach = space("Beachhead K")
	game.events.no_more_invasions = true
	game.beachheads[normalBeach] = { type: "allied", card_id: 33 }
	game.beachheads[shingleBeach] = {
		type: "allied",
		card_id: 46,
		shingle: true,
	}
	game.control[normalBeach] = "allied"
	game.control[shingleBeach] = "allied"
	assert.equal(Engine.invasions.canPlayAsReinforcement(game, data, Engine.map, adjacency, cardId), true)
	const spaces = Engine.invasions.legalConvertedLcuSpaces(game, data, Engine.map, adjacency, us5)
	assert.equal(spaces.includes(normalBeach), true)
	assert.equal(spaces.includes(shingleBeach), false)
})

test("a converted invasion reinforcement on the Overlord beachhead receives the normal activation choice", () => {
	let { game, cardId } = prepareInvasion(45, 14)
	const beach = space("Beachhead D")
	game.events.no_more_invasions = true
	game.beachheads[beach] = { type: "allied", card_id: 33 }
	game.control[beach] = "allied"
	game = rules.action(game, "Allied", "play_event", cardId)
	assert.equal(game.state, "event_reinforcement_lcu")
	game = rules.action(game, "Allied", "space", beach)
	assert.equal(game.state, "event_reinforcement_activation")
	assert.equal(rules.view(game, "Allied").actions.combat_marker, 1)
	game = rules.action(game, "Allied", "pass")
	assert.equal(game.active, "Axis")
})
