"use strict"

const ALLIED = "allied"
const AXIS = "axis"
const ALLIED_ROLE = "Allied"
const AXIS_ROLE = "Axis"
const ROLES = Object.freeze([ALLIED_ROLE, AXIS_ROLE])
const SCENARIOS = Object.freeze(["Campaign"])
const SCHEMA_VERSION = 5
const DATA_VERSION = 1
const RULESET_VERSION = 1

function sideForRole(role) {
	if (role === ALLIED_ROLE) return ALLIED
	if (role === AXIS_ROLE) return AXIS
	return null
}

function roleForSide(side) {
	if (side === ALLIED) return ALLIED_ROLE
	if (side === AXIS) return AXIS_ROLE
	return null
}

function otherSide(side) {
	if (side === ALLIED) return AXIS
	if (side === AXIS) return ALLIED
	throw new Error(`unknown side: ${side}`)
}

module.exports = Object.freeze({
	ALLIED,
	AXIS,
	ALLIED_ROLE,
	AXIS_ROLE,
	DATA_VERSION,
	ROLES,
	SCENARIOS,
	SCHEMA_VERSION,
	RULESET_VERSION,
	otherSide,
	roleForSide,
	sideForRole,
})
