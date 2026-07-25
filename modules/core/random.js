"use strict"

const MODULUS = 2147483647
const MULTIPLIER = 48271

function normalizeSeed(seed) {
	let value = Number(seed) || 1
	value = Math.trunc(value) % MODULUS
	if (value <= 0) value += MODULUS - 1
	return value
}

function next(state) {
	state.seed = (normalizeSeed(state.seed) * MULTIPLIER) % MODULUS
	return state.seed
}

function random(state, range) {
	if (!Number.isInteger(range) || range <= 0) throw new Error(`random range must be a positive integer: ${range}`)
	return next(state) % range
}

function shuffle(state, list) {
	for (let i = list.length - 1; i > 0; i--) {
		const j = random(state, i + 1)
		const value = list[i]
		list[i] = list[j]
		list[j] = value
	}
	return list
}

module.exports = { MODULUS, MULTIPLIER, next, normalizeSeed, random, shuffle }
