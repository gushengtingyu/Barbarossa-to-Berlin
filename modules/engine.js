"use strict"

const { data, map, adjacency, turn } = require("./runtime.js")

module.exports = Object.freeze({
	data,
	constants: require("./core/constants.js"),
	unitLocations: require("./core/unit_locations.js"),
	random: require("./core/random.js"),
	state: require("./core/state.js"),
	cards: require("./systems/cards.js"),
	events: require("./systems/events.js"),
	combat: require("./systems/combat.js"),
	combatCards: require("./systems/combat_cards.js"),
	collaboration: require("./systems/collaboration.js"),
	logistics: require("./systems/logistics.js"),
	reinforcements: require("./systems/reinforcements.js"),
	replacements: require("./systems/replacements.js"),
	invasions: require("./systems/invasions.js"),
	neutrals: require("./systems/neutrals.js"),
	orders: require("./systems/orders.js"),
	resources: require("./systems/resources.js"),
	restrictions: require("./systems/restrictions.js"),
	stalin: require("./systems/stalin.js"),
	weather: require("./systems/weather.js"),
	map,
	adjacency,
	setup: require("./systems/setup.js"),
	turn,
})
