"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const Engine = require("../modules/engine.js")
const rules = require("../rules.js")

const { data } = Engine

function prepareAction(cardId, side, seed, turn = 10) {
	const game = rules.setup(seed, "Campaign", {})
	game.turn = turn
	game.action_round = 3
	game.phase = "action"
	game.state = "action_select"
	game.active = side === "allied" ? "Allied" : "Axis"
	game.action_history = { allied: [], axis: [] }
	game.action_track = { allied: [], axis: [] }
	game.hands[side] = [cardId]
	return game
}

function piece(name) {
	return data.pieces.find((entry) => entry?.name === name).id
}

function space(name) {
	return data.spaces.find((entry) => entry?.name === name).id
}

function combatGeometry(nation) {
	for (const origin of data.spaces) {
		if (origin?.kind !== "land" || (nation && origin.nation !== nation)) continue
		const targets = Engine.adjacency[origin.id].filter((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land" && !data.spaces[edge.to]?.attack_requires_event).map((edge) => edge.to)
		if (targets.length >= 2) return { origin: origin.id, targets: targets.slice(0, 2) }
	}
	throw new Error("combat geometry not found")
}

function driveCombat(game, role, stopState) {
	for (let step = 0; step < 80 && game.state !== stopState; step++) {
		const actions = rules.view(game, role).actions || {}
		if (game.state === "combat_attacker_cc" || game.state === "combat_defender_cc" || game.state === "combat_defender_losses" || game.state === "combat_attacker_losses") {
			const actingRole = game.active
			const local = rules.view(game, actingRole).actions || {}
			if (local.piece?.length) game = rules.action(game, actingRole, "piece", local.piece[0])
			else game = rules.action(game, actingRole, "continue")
		} else if (game.state === "combat_retreat_option") game = rules.action(game, game.active, "continue")
		else if (game.state === "combat_retreat") {
			const local = rules.view(game, game.active).actions || {}
			game = local.done ? rules.action(game, game.active, "done") : rules.action(game, game.active, "piece", local.piece[0])
		} else if (game.state === "combat_retreat_piece") {
			const local = rules.view(game, game.active).actions || {}
			game = rules.action(game, game.active, "move", local.move[0])
		} else if (game.state === "combat_advance") game = rules.action(game, game.active, "done")
		else if (game.state === "eliminated_theater_choice") {
			const verb = actions.med ? "med" : "nwe"
			game = rules.action(game, game.active, verb)
		} else throw new Error(`unexpected combat state: ${game.state}`)
	}
	assert.equal(game.state, stopState)
	return game
}

function reachExtraAttackPrompt(cardId, side, armyName, seed, nation) {
	let game = prepareAction(cardId, side, seed)
	if (cardId === 60) game.events.hitler_takes_command = false
	const army = piece(armyName)
	const enemySide = side === "axis" ? "allied" : "axis"
	const enemyPieces = data.pieces.filter((entry) => entry?.side === enemySide && entry.size === "scu").slice(0, 2)
	const { origin, targets } = combatGeometry(nation)
	game.pieces[army] = origin
	game.control[origin] = side
	for (let index = 0; index < 2; index++) {
		game.pieces[enemyPieces[index].id] = targets[index]
		game.control[targets[index]] = enemySide
	}
	game = rules.action(game, game.active, "play_event", cardId)
	game.action.attack_spaces = [origin]
	game.state = "ops_combat"
	game = rules.action(game, game.active, "piece", army)
	game = rules.action(game, game.active, "space", targets[0])
	game = rules.action(game, game.active, "confirm")
	game = rules.action(game, game.active, "continue")
	game = rules.action(game, game.active, "continue")
	game = driveCombat(game, side === "axis" ? "Axis" : "Allied", "event_extra_attack_prompt")
	return { game, army, targets }
}

test("Enigma writes the complete Axis hand to the public log without extra UI state", () => {
	let game = prepareAction(25, "allied", 2500)
	game.hands.axis = [60, 68, 108]
	game = rules.action(game, "Allied", "play_event", 25)
	assert.equal(rules.view(game, "Allied").revealed_opponent_hand, undefined)
	assert.equal(rules.view(game, "Axis").revealed_opponent_hand, undefined)
	assert.equal(rules.view(game, "Observer").revealed_opponent_hand, undefined)
	assert.ok(rules.view(game, "Observer").log.some((entry) => /c60.*c68.*c108/.test(entry)))
	Engine.turn.finishAction(game, "allied")
	assert.equal(rules.view(game, "Allied").revealed_opponent_hand, undefined)

	const occupied = prepareAction(25, "allied", 2501)
	occupied.control[space("Berlin")] = "allied"
	assert.equal(Engine.events.canPlayEvent(occupied, data, 25), false)
	const thaw = prepareAction(25, "allied", 2502, 5)
	thaw.action_round = 1
	assert.equal(Engine.events.canPlayEvent(thaw, data, 25), false)
})

test("Patton and Panzergruppe Guderian offer one second attack with printed advance caps", () => {
	let patton = reachExtraAttackPrompt(55, "allied", "US 3 Army", 5500, "fr")
	patton.game = rules.action(patton.game, "Allied", "yes")
	assert.ok(rules.view(patton.game, "Allied").actions.space.length)
	const pattonTarget = rules.view(patton.game, "Allied").actions.space[0]
	patton.game = rules.action(patton.game, "Allied", "space", pattonTarget)
	assert.equal(patton.game.combat.extra_attack, true)
	assert.equal(patton.game.combat.extra_advance_limit, 2)

	let guderian = reachExtraAttackPrompt(60, "axis", "GE 2 Panzer Army", 6000, "su")
	guderian.game = rules.action(guderian.game, "Axis", "yes")
	const guderianTarget = rules.view(guderian.game, "Axis").actions.space[0]
	guderian.game = rules.action(guderian.game, "Axis", "space", guderianTarget)
	assert.equal(guderian.game.combat.extra_attack, true)
	assert.equal(guderian.game.combat.extra_advance_limit, 1)

	const blocked = prepareAction(60, "axis", 6001)
	blocked.events.hitler_takes_command = true
	assert.equal(Engine.events.canPlayEvent(blocked, data, 60), false)
	const thaw = prepareAction(60, "axis", 6002, 5)
	thaw.action_round = 2
	thaw.pieces[piece("GE 2 Panzer Army")] = combatGeometry("su").origin
	assert.equal(Engine.events.canPlayEvent(thaw, data, 60), false)
})

test("Krim removes Sevastopol fort effects for its combat without removing the fort", () => {
	const game = prepareAction(68, "axis", 6800)
	const target = space("Sevastopol")
	const origin = Engine.adjacency[target].find((edge) => edge.type !== "sr" && data.spaces[edge.to]?.kind === "land").to
	const attacker = piece("GE 2 Panzer Army")
	const defender = data.pieces.find((entry) => entry?.nation === "su" && entry.size === "scu").id
	game.pieces[attacker] = origin
	game.pieces[defender] = target
	game.control[origin] = "axis"
	game.control[target] = "allied"
	Engine.events.playEvent(game, data, 68)
	const base = {
		origin_spaces: [origin],
		defender_space: target,
		attackers: [attacker],
		defenders: [defender],
		attacker_side: "axis",
		defender_side: "allied",
	}
	const normal = Engine.combat.preview({ ...game, combat: { ...base } }, data, Engine.map, Engine.adjacency, { ...base })
	const krim = Engine.combat.preview({ ...game, combat: { ...base, krim: true } }, data, Engine.map, Engine.adjacency, { ...base, krim: true })
	assert.equal(krim.attacker_shift, normal.attacker_shift + 1)
	assert.ok(!game.destroyed_forts.includes(target))
})

test("Fall Zitadelle gives Soviet defensive fire +2 and settles its conditional VP exactly once", () => {
	const game = prepareAction(82, "axis", 8200)
	game.events.hitler_takes_command = true
	Engine.events.playEvent(game, data, 82)
	assert.equal(game.event.combat_markers, 2)
	const attacker = piece("GE 2 Panzer Army")
	const defender = data.pieces.find((entry) => entry?.nation === "su" && entry.size === "scu").id
	const { origin, targets } = combatGeometry("su")
	game.pieces[attacker] = origin
	game.pieces[defender] = targets[0]
	const combat = { origin_spaces: [origin], defender_space: targets[0], attackers: [attacker], defenders: [defender], retreated_defenders: [], attacker_side: "axis", defender_side: "allied" }
	Engine.combat.resolve(game, data, Engine.map, Engine.adjacency, combat)
	assert.equal(combat.defender_drm, 2)

	const advance = prepareAction(82, "axis", 8201)
	advance.events.hitler_takes_command = true
	Engine.events.playEvent(advance, data, 82)
	for (const mapSpace of data.spaces) if (mapSpace?.kind === "land") advance.control[mapSpace.id] = "axis"
	advance.control[targets[0]] = "allied"
	advance.pieces[attacker] = origin
	advance.action = { mode: "event", attack_spaces: [origin], attacked: [], defended: [], used_pieces: [] }
	advance.combat = {
		origin_spaces: [origin],
		defender_space: targets[0],
		attackers: [attacker],
		defenders: [],
		retreated_defenders: [],
		attacker_side: "axis",
		defender_side: "allied",
		advanced: [],
		retreat_distance: 1,
		retreat_paths: {},
		zitadelle_objective: true,
	}
	advance.state = "combat_advance"
	advance.active = "Axis"
	let advancing = rules.action(advance, "Axis", "piece", attacker)
	assert.ok(rules.view(advancing, "Axis").actions.move.includes(targets[0]))
	const advanceVp = advancing.vp
	advancing = rules.action(advancing, "Axis", "move", targets[0])
	assert.equal(advancing.vp, advanceVp)
	assert.equal(rules.view(advancing, "Axis").actions.done, 1)
	advancing = rules.action(advancing, "Axis", "done")
	assert.equal(advancing.vp, advanceVp + 1)
	assert.ok(rules.view(advancing, "Axis").log.some((entry) => entry.includes("堡垒行动成功")))

	const failed = JSON.parse(JSON.stringify(game))
	failed.vp = 10
	failed.event.zitadelle_success = false
	Engine.events.settleActionEvent(failed)
	Engine.events.settleActionEvent(failed)
	assert.equal(failed.vp, 9)
	const success = JSON.parse(JSON.stringify(game))
	success.vp = 10
	success.event.zitadelle_success = true
	Engine.events.settleActionEvent(success)
	assert.equal(success.vp, 11)
})

test("Wacht am Rhein is seasonal and gives +2 only to named Panzer Armies against non-Soviets", () => {
	const game = prepareAction(108, "axis", 10800, 11)
	game.events.hitler_takes_command = true
	Engine.events.playEvent(game, data, 108)
	assert.equal(game.event.combat_markers, 4)
	const attacker = piece("GE 5 Panzer Army")
	const western = data.pieces.find((entry) => entry?.nation === "br" && entry.size === "scu").id
	const soviet = data.pieces.find((entry) => entry?.nation === "su" && entry.size === "scu").id
	const { origin, targets } = combatGeometry("fr")
	game.pieces[attacker] = origin
	game.pieces[western] = targets[0]
	let combat = { origin_spaces: [origin], defender_space: targets[0], attackers: [attacker], defenders: [western], retreated_defenders: [], attacker_side: "axis", defender_side: "allied" }
	Engine.combat.resolve(game, data, Engine.map, Engine.adjacency, combat)
	assert.equal(combat.attacker_drm, 2)
	game.pieces[soviet] = targets[1]
	combat = { origin_spaces: [origin], defender_space: targets[1], attackers: [attacker], defenders: [soviet], retreated_defenders: [], attacker_side: "axis", defender_side: "allied" }
	Engine.combat.resolve(game, data, Engine.map, Engine.adjacency, combat)
	assert.equal(combat.attacker_drm, 0)

	for (const turn of [3, 4, 7, 8, 11, 12, 15, 16]) {
		const seasonal = prepareAction(108, "axis", 10800 + turn, turn)
		seasonal.events.hitler_takes_command = true
		assert.equal(Engine.events.canPlayEvent(seasonal, data, 108), true)
	}
	const summer = prepareAction(108, "axis", 10820, 14)
	summer.events.hitler_takes_command = true
	assert.equal(Engine.events.canPlayEvent(summer, data, 108), false)
})
