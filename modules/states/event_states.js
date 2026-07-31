"use strict"

const Runtime = require("../runtime.js")
const Engine = Object.freeze({
	constants: require("../core/constants.js"),
	state: require("../core/state.js"),
	events: require("../systems/events.js"),
	invasions: require("../systems/invasions.js"),
	map: require("../systems/map.js"),
	neutrals: require("../systems/neutrals.js"),
	turn: Runtime.turn,
})

function finishSorgeMarkers(game) {
	delete game.action.event_space
	if (game.action.move_spaces.length) game.state = "ops_move"
	else if (game.action.attack_spaces.length) game.state = "ops_combat"
	else Engine.turn.finishAction(game, Engine.constants.ALLIED)
}

function recordSorgeMarker(game, data, adjacency, type) {
	const spaceId = game.action.event_space
	Engine.map.recordActivationSupply(game, data, adjacency, Engine.constants.ALLIED, spaceId)
	if (type === "move") game.action.move_spaces.push(spaceId)
	else game.action.attack_spaces.push(spaceId)
	game.event.marker_spaces.push(spaceId)
	delete game.action.event_space
	if (game.event.marker_spaces.length >= game.event.sorge_markers || !Engine.events.legalSorgeMarkerSpaces(game, data).length) finishSorgeMarkers(game)
	else game.state = "event_sorge_space"
}

function recordOptionalAxisMarker(game, data, adjacency, type) {
	const spaceId = game.action.event_space
	Engine.map.recordActivationSupply(game, data, adjacency, Engine.constants.AXIS, spaceId)
	if (type === "move") {
		game.action.move_spaces.push(spaceId)
		game.state = "ops_move"
	} else {
		game.action.attack_spaces.push(spaceId)
		game.state = "ops_combat"
	}
	delete game.action.event_space
}

function register(registerState) {
	registerState("allied_invasion_reserve", {
		prompt(result, game, role, { data, adjacency }) {
			result.prompt("events.reserve.transfer_army")
			const pieces = Engine.invasions.transferCandidates(game, data, Engine.map, adjacency)
			if (pieces.length) result.action("piece", pieces)
			result.action("done")
		},
		piece(game, role, noun, { data, adjacency }) {
			Engine.invasions.transferToReserve(game, data, Engine.map, adjacency, Number(noun))
		},
		done(game) {
			Engine.turn.finishInvasionReserve(game)
		},
	})

	registerState("event_invasion_mode", {
		prompt(result, game, role, { data }) {
			result.prompt("events.invasion.mode", {
				event: { "zh-CN": game.invasion?.name_zh || "登陆", en: game.invasion?.name || "Invasion" },
			})
			const modes = Engine.invasions.legalModeKeys(game, data)
			if (modes.includes("single")) result.action("single_beachhead")
			if (modes.includes("double")) result.action("double_beachheads")
		},
		single_beachhead(game, role, noun, { data }) {
			Engine.invasions.chooseMode(game, data, "single")
			game.state = "event_invasion_beach"
		},
		double_beachheads(game, role, noun, { data }) {
			Engine.invasions.chooseMode(game, data, "double")
			game.state = "event_invasion_beach"
		},
	})

	registerState("event_invasion_beach", {
		prompt(result, game, role, { data }) {
			const invasion = game.invasion
			const index = invasion?.beaches?.length || 0
			const marker = invasion?.markers?.[index]?.toUpperCase() || "ALLIED"
			result.prompt("events.invasion.beach", {
				event: { "zh-CN": invasion?.name_zh || "登陆", en: invasion?.name || "Invasion" },
				marker,
			})
			result.action("space", Engine.invasions.legalBeachSpaces(game, data, Engine.map))
		},
		space(game, role, noun, { data, adjacency }) {
			Engine.invasions.place(game, data, Engine.map, adjacency, Number(noun))
		},
	})

	registerState("event_invasion_advance", {
		prompt(result, game, role, { data }) {
			result.prompt("events.invasion.advance")
			const pieces = Engine.invasions.advanceCandidates(game, data, Engine.map)
			if (pieces.length) result.action("piece", pieces)
			result.action("continue")
		},
		piece(game, role, noun, { data }) {
			Engine.invasions.advancePiece(game, data, Engine.map, Number(noun))
		},
		continue(game) {
			game.state = "ops_combat"
		},
	})

	registerState("neutral_deployment", {
		prompt(result, game, role, { data }) {
			const deployment = game.neutral_deployment
			const pieceId = deployment?.pieces?.[deployment.index]
			const piece = data.pieces[pieceId]
			result.prompt("events.transfer.deploy_neutral", {
				country: {
					"zh-CN": Engine.neutrals.COUNTRY_NAMES[deployment.nation],
					en: deployment.nation === "tu" ? "Turkish" : "Swedish",
				},
				piece: piece?.name || pieceId,
			})
			result.action("space", Engine.neutrals.deploymentSpaces(game, data, Engine.map, deployment.nation, pieceId))
		},
		space(game, role, noun, { data }) {
			const deployment = game.neutral_deployment
			const pieceId = deployment.pieces[deployment.index]
			Engine.neutrals.placeDeploymentPiece(game, data, Engine.map, pieceId, Number(noun))
		},
	})

	registerState("event_combat_markers", {
		prompt(result, game, role, { data }) {
			const side = Engine.constants.sideForRole(game.active)
			const remaining = Math.max(0, (game.event?.combat_markers || 0) - (game.action?.attack_spaces?.length || 0))
			result.prompt("events.combat_markers.place", { remaining })
			const available = Engine.map.legalActivationSpaces(game, data, side).filter((spaceId) => !game.action.attack_spaces.includes(spaceId))
			if (game.event.combat_markers > game.action.attack_spaces.length) result.action("attack", available)
			else result.action("continue")
		},
		attack(game, role, noun, { data, adjacency }) {
			const side = Engine.constants.sideForRole(role)
			const spaceId = Number(noun)
			Engine.map.recordActivationSupply(game, data, adjacency, side, spaceId)
			game.action.attack_spaces.push(spaceId)
		},
		continue(game) {
			game.state = "ops_combat"
		},
	})

	registerState("event_sorge_space", {
		prompt(result, game, role, { data }) {
			const remaining = Math.max(0, game.event.sorge_markers - game.event.marker_spaces.length)
			result.prompt("events.sorge.place", { remaining })
			result.action("space", Engine.events.legalSorgeMarkerSpaces(game, data))
			result.action("done")
		},
		space(game, role, noun) {
			game.action.event_space = Number(noun)
			game.state = "event_sorge_marker"
		},
		done(game) {
			finishSorgeMarkers(game)
		},
	})

	registerState("event_sorge_marker", {
		prompt(result, game, role, { data }) {
			const spaceId = game.action.event_space
			result.prompt("events.marker.choose", { space: data.spaces[spaceId].name })
			result.action("move_marker")
			result.action("combat_marker")
		},
		move_marker(game, role, noun, { data, adjacency }) {
			recordSorgeMarker(game, data, adjacency, "move")
		},
		combat_marker(game, role, noun, { data, adjacency }) {
			recordSorgeMarker(game, data, adjacency, "combat")
		},
	})

	registerState("event_axis_marker_space", {
		prompt(result, game, role, { data }) {
			result.prompt("events.marker.optional")
			result.action("space", Engine.map.legalActivationSpaces(game, data, Engine.constants.AXIS))
			result.action("done")
		},
		space(game, role, noun) {
			game.action.event_space = Number(noun)
			game.state = "event_axis_marker_type"
		},
		done(game) {
			Engine.turn.finishAction(game, Engine.constants.AXIS)
		},
	})

	registerState("event_axis_marker_type", {
		prompt(result, game, role, { data }) {
			result.prompt("events.marker.choose", { space: data.spaces[game.action.event_space].name })
			result.action("move_marker")
			result.action("combat_marker")
			result.action("pass")
		},
		move_marker(game, role, noun, { data, adjacency }) {
			recordOptionalAxisMarker(game, data, adjacency, "move")
		},
		combat_marker(game, role, noun, { data, adjacency }) {
			recordOptionalAxisMarker(game, data, adjacency, "combat")
		},
		pass(game) {
			delete game.action.event_space
			game.state = "event_axis_marker_space"
		},
	})

	registerState("event_banzai", {
		prompt(result, game, role, { data }) {
			const selected = game.event?.banzai_pieces || []
			const legal = Engine.events.legalBanzaiCorps(game, data)
			result.prompt("events.banzai.select", { count: selected.length })
			if (selected.length < 2) result.action("piece", legal)
			else result.action("piece", selected)
			if (selected.length === 2 || !legal.some((pieceId) => !selected.includes(pieceId))) result.action("continue")
		},
		piece(game, role, noun, { data }) {
			Engine.events.toggleBanzaiCorps(game, data, Number(noun))
		},
		continue(game, role, noun, { data }) {
			Engine.events.completeBanzai(game, data)
			Engine.turn.finishAction(game, Engine.constants.AXIS)
		},
	})

	registerState("event_luftwaffe_supply", {
		prompt(result, game, role, { data }) {
			result.prompt("events.air_supply.space")
			result.action("space", Engine.events.legalLuftwaffeSupplySpaces(game, data))
		},
		space(game, role, noun, { data }) {
			const spaceId = Number(noun)
			if (!Engine.events.legalLuftwaffeSupplySpaces(game, data).includes(spaceId)) throw new Error(`illegal Luftwaffe Supply space: ${spaceId}`)
			game.events.luftwaffe_supply_space = spaceId
			game.events.luftwaffe_supply_turn = game.turn
			Engine.state.log(game, "events.log.air_supply_placed", { space: `s${spaceId}` })
			if (game.event?.dual_ops) game.state = "ops_activate"
			else Engine.turn.finishAction(game, Engine.constants.AXIS)
		},
	})

	registerState("event_reinforcement_lcu", {
		inactive: { "zh-CN": "部署增援单位", en: "to deploy reinforcement units" },
		prompt(result, game, role, { data }) {
			const reinforcement = game.reinforcement
			const label = reinforcement?.labels_zh?.[reinforcement.index] || "增援单位"
			const unit = { "zh-CN": label, en: data.pieces[reinforcement?.lcus?.[reinforcement.index]]?.name || "reinforcement unit" }
			if (reinforcement?.placement_type === "desert") result.prompt("events.reinforcement.deploy_desert", { unit })
			else if (reinforcement?.type === "converted_invasion" || reinforcement?.type === "western") result.prompt("events.reinforcement.deploy_western", { unit })
			else result.prompt("events.reinforcement.deploy_standard", { unit })
			if (!result.actionsEnabled || role !== game.active) return
			const query = Engine.events.reinforcementPlacementQuery(game, data)
			result.context.reinforcementPlacement = query
			result.action("space", query.spaces)
		},
		space(game, role, noun, { data }, promptResult) {
			const side = Engine.constants.sideForRole(role)
			const reinforcement = game.reinforcement
			const pieceId = reinforcement.lcus[reinforcement.index]
			const spaceId = Number(noun)
			const placed = Engine.events.placeReinforcementLcu(game, data, pieceId, spaceId, promptResult?.context?.reinforcementPlacement)
			Engine.state.log(game, "events.log.reinforcement_deployed", {
				side: side === Engine.constants.ALLIED ? { "zh-CN": "盟军", en: "The Allies" } : { "zh-CN": "轴心国", en: "The Axis" },
				piece: Engine.state.pieceLogRef(game, pieceId),
				space: `s${spaceId}`,
			})
			if (placed.activation_eligible) {
				reinforcement.activation_spaces ||= []
				reinforcement.activation_index ??= 0
				if (!reinforcement.activation_spaces.includes(spaceId)) reinforcement.activation_spaces.push(spaceId)
			}
			if (placed.yellow_event_eligible) {
				reinforcement.yellow_event_spaces ||= []
				if (!reinforcement.yellow_event_spaces.includes(spaceId)) reinforcement.yellow_event_spaces.push(spaceId)
			}
			reinforcement.index++
			if (reinforcement.index >= reinforcement.lcus.length) {
				if (reinforcement.activation_spaces?.length) game.state = "event_reinforcement_activation"
				else {
					game.reinforcement = null
					if (game.event?.dual_ops) game.state = "ops_activate"
					else Engine.turn.finishAction(game, side)
				}
			}
		},
	})

	registerState("event_panzer_afrika_transfer", {
		prompt(result, game, role, { data }) {
			result.prompt("events.german_reinforcement.transfer")
			result.action("piece", Engine.events.legalPanzerAfrikaTransferPieces(game, data))
		},
		piece(game, role, noun, { data }) {
			Engine.events.transferPanzerAfrikaCorps(game, data, Number(noun))
			Engine.turn.finishAction(game, Engine.constants.AXIS)
		},
	})

	registerState("event_front_replacement", {
		prompt(result, game, role, { data }) {
			const reinforcement = game.reinforcement
			const label = reinforcement?.labels_zh?.[reinforcement.index] || "苏军机械化方面军"
			result.prompt("events.front.replace", {
				label: { "zh-CN": label, en: data.pieces[reinforcement?.lcus?.[reinforcement.index]]?.name || "the mechanized Front" },
			})
			result.action("piece", Engine.events.legalFrontReplacementPieces(game, data))
		},
		piece(game, role, noun, { data }) {
			const side = Engine.constants.sideForRole(role)
			const reinforcement = game.reinforcement
			Engine.events.replaceMechanizedFront(game, data, Number(noun))
			if (reinforcement.index >= reinforcement.lcus.length) {
				game.reinforcement = null
				if (game.event?.dual_ops) game.state = "ops_activate"
				else Engine.turn.finishAction(game, side)
			}
		},
	})

	registerState("event_reinforcement_activation", {
		prompt(result, game, role, { data }) {
			const reinforcement = game.reinforcement
			const spaceId = reinforcement.activation_spaces[reinforcement.activation_index]
			const yellowEventEligible = reinforcement.yellow_event_spaces?.includes(spaceId) && !game.action.move_spaces.length && !game.action.attack_spaces.length
			if (yellowEventEligible) result.prompt("events.reinforcement.antwerp_1945_choice", { space: data.spaces[spaceId].name, ops: data.cards[game.event.card_id].ops })
			else result.prompt("events.marker.space_choose", { space: data.spaces[spaceId].name })
			result.action("move_marker")
			result.action("combat_marker")
			if (yellowEventEligible) result.action("yellow_ops")
			result.action("pass")
		},
		move_marker(game, role, noun, { data, adjacency }) {
			const reinforcement = game.reinforcement
			const spaceId = reinforcement.activation_spaces[reinforcement.activation_index]
			Engine.map.recordActivationSupply(game, data, adjacency, reinforcement.side, spaceId)
			game.action.move_spaces.push(spaceId)
			reinforcement.activation_index++
			if (reinforcement.activation_index >= reinforcement.activation_spaces.length) {
				game.reinforcement = null
				game.state = "ops_move"
			}
		},
		combat_marker(game, role, noun, { data, adjacency }) {
			const reinforcement = game.reinforcement
			const spaceId = reinforcement.activation_spaces[reinforcement.activation_index]
			Engine.map.recordActivationSupply(game, data, adjacency, reinforcement.side, spaceId)
			game.action.attack_spaces.push(spaceId)
			reinforcement.activation_index++
			if (reinforcement.activation_index >= reinforcement.activation_spaces.length) {
				game.reinforcement = null
				game.state = game.action.move_spaces.length ? "ops_move" : "ops_combat"
			}
		},
		yellow_ops(game, role, noun, { data }) {
			const reinforcement = game.reinforcement
			const spaceId = reinforcement.activation_spaces[reinforcement.activation_index]
			if (!reinforcement.yellow_event_spaces?.includes(spaceId) || game.action.move_spaces.length || game.action.attack_spaces.length) throw new Error("reinforcement cannot be treated as a Yellow Event")
			const points = Number(data.cards[game.event.card_id]?.ops) || 0
			if (!points) throw new Error("reinforcement card has no OPS value")
			game.action.mode = "ops"
			game.action.points = points
			game.event.dual_ops = points
			Engine.state.log(game, "events.log.reinforcement_yellow_event", { card: `c${game.event.card_id}`, ops: points })
			game.reinforcement = null
			game.state = "ops_activate"
		},
		pass(game) {
			const reinforcement = game.reinforcement
			reinforcement.activation_index++
			if (reinforcement.activation_index >= reinforcement.activation_spaces.length) {
				game.reinforcement = null
				if (game.action.move_spaces.length) game.state = "ops_move"
				else if (game.action.attack_spaces.length) game.state = "ops_combat"
				else Engine.turn.finishAction(game, reinforcement.side)
			}
		},
	})
	registerState("event_tito_space", {
		prompt(result, game, role, { data }) {
			if (game.event?.tito_placed) {
				result.prompt("events.tito.complete")
				result.action("done")
				return
			}
			result.prompt("events.tito.space")
			result.action("space", Engine.events.legalTitoSpaces(game, data))
		},
		space(game, role, noun, { data }) {
			game.event.tito_placed = {
				piece_id: Engine.events.placeTito(game, data, Number(noun)),
				space_id: Number(noun),
			}
		},
		done(game, role) {
			Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
		},
	})

	registerState("event_panzer_refit", {
		prompt(result, game, role, { data }) {
			const selected = game.event?.panzer_refit_pieces || []
			result.prompt("events.panzer_refit.select", { count: selected.length })
			const legal = new Set(Engine.events.legalPanzerRefitPieces(game, data))
			result.action(
				"piece",
				[...legal].filter((pieceId) => selected.length < 3 || selected.includes(pieceId)),
			)
			if (selected.length >= 1 && selected.length <= 3) result.action("continue")
		},
		piece(game, role, noun, { data }) {
			Engine.events.togglePanzerRefitPiece(game, data, Number(noun))
		},
		continue(game, role, noun, { data }) {
			Engine.events.completePanzerRefit(game, data)
			game.state = "ops_activate"
		},
	})

	registerState("event_hedgehogs", {
		prompt(result, game, role, { data }) {
			const selected = game.event?.hedgehog_spaces || []
			result.prompt("events.hedgehogs.select", { count: selected.length })
			const legal = new Set(Engine.events.legalHedgehogSpaces(game, data))
			result.action(
				"space",
				[...legal].filter((spaceId) => selected.length < 3 || selected.includes(spaceId)),
			)
			if (selected.length === 3) result.action("continue")
		},
		space(game, role, noun, { data }) {
			Engine.events.toggleHedgehogSpace(game, data, Number(noun))
		},
		continue(game, role, noun, { data }) {
			Engine.events.completeHedgehogs(game, data)
			Engine.turn.finishAction(game, Engine.constants.AXIS)
		},
	})

	registerState("event_atlantic_wall", {
		prompt(result, game, role, { data }) {
			const selected = game.event?.atlantic_wall_spaces || []
			result.prompt("events.atlantic_wall.select", { count: selected.length })
			const legal = new Set(Engine.events.legalAtlanticWallSpaces(game, data))
			result.action(
				"space",
				[...legal].filter((spaceId) => selected.length < 2 || selected.includes(spaceId)),
			)
			if (selected.length === 2) result.action("continue")
		},
		space(game, role, noun, { data }) {
			Engine.events.toggleAtlanticWallSpace(game, data, Number(noun))
		},
		continue(game, role, noun, { data }) {
			Engine.events.completeAtlanticWall(game, data)
			Engine.turn.finishAction(game, Engine.constants.AXIS)
		},
	})

	registerState("event_east_wall", {
		prompt(result, game, role, { data }) {
			const selected = game.event?.east_wall_spaces || []
			result.prompt("events.east_wall.select", { count: selected.length })
			const legal = new Set(Engine.events.legalEastWallSpaces(game, data))
			result.action(
				"space",
				[...legal].filter((spaceId) => selected.length < 3 || selected.includes(spaceId)),
			)
			if (selected.length === 3) result.action("continue")
		},
		space(game, role, noun, { data }) {
			Engine.events.toggleEastWallSpace(game, data, Number(noun))
		},
		continue(game, role, noun, { data }) {
			Engine.events.completeEastWall(game, data)
			Engine.turn.finishAction(game, Engine.constants.AXIS)
		},
	})

	registerState("event_final_production_surge", {
		prompt(result, game, role, { data }) {
			const selected = game.event?.final_production_surge_pieces || []
			result.prompt("events.final_production.select", { count: selected.length })
			const legal = new Set(Engine.events.legalFinalProductionSurgePieces(game, data))
			result.action(
				"piece",
				[...legal].filter((pieceId) => selected.length < 3 || selected.includes(pieceId)),
			)
			if (selected.length === 3) result.action("continue")
		},
		piece(game, role, noun, { data }) {
			Engine.events.toggleFinalProductionSurgePiece(game, data, Number(noun))
		},
		continue(game, role, noun, { data }) {
			Engine.events.completeFinalProductionSurge(game, data)
			game.state = "ops_activate"
		},
	})

	registerState("event_remove_partisans", {
		prompt(result, game) {
			const removed = game.event?.removed_partisans?.length || 0
			const remaining = Math.max(0, (game.event?.remove_partisans || 0) - removed)
			const spaces = Engine.events.legalPartisanRemovalSpaces(game)
			if (remaining) result.prompt("events.partisan_sweep.remove", { remaining })
			else result.prompt("events.partisan_sweep.complete")
			if (remaining && spaces.length) result.action("space", spaces)
			if (!remaining || !spaces.length) result.action("done")
		},
		space(game, role, noun, { data }) {
			const spaceId = Number(noun)
			Engine.events.removePartisan(game, data, spaceId)
			game.event.removed_partisans.push(spaceId)
		},
		done(game, role) {
			Engine.turn.finishAction(game, Engine.constants.sideForRole(role))
		},
	})
}

module.exports = { register }
