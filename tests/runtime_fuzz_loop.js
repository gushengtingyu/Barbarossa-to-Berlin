"use strict"

const assert = require("node:assert/strict")
const rules = require("../rules.js")
const States = require("../modules/states/index.js")
const Collaboration = require("../modules/systems/collaboration.js")

const PROGRESS_VERBS = ["continue", "done", "pass", "play_event", "auto_ops", "play_ops", "play_sr", "play_rp", "place_partisan"]

function makeRandom(seed) {
	let state = Number(seed) >>> 0 || 1
	return function random(limit) {
		state ^= state << 13
		state ^= state >>> 17
		state ^= state << 5
		return (state >>> 0) % limit
	}
}

function flattenActions(actions) {
	const choices = []
	for (const [verb, nouns] of Object.entries(actions || {})) {
		if (verb === "undo") continue
		if (nouns === 1) choices.push({ verb, noun: undefined })
		else for (const noun of nouns) choices.push({ verb, noun })
	}
	return choices
}

function chooseAction(actions, random) {
	const choices = flattenActions(actions)
	const optionalCards = choices.filter((choice) => choice.verb === "card")
	if (optionalCards.length && choices.some((choice) => choice.verb === "continue") && random(2) === 0) return optionalCards[random(optionalCards.length)]
	for (const verb of PROGRESS_VERBS) {
		const preferred = choices.filter((choice) => choice.verb === verb)
		if (preferred.length) return preferred[random(preferred.length)]
	}
	return choices.length ? choices[random(choices.length)] : null
}

function verifyActionShape(actions) {
	for (const [verb, nouns] of Object.entries(actions || {})) {
		assert.equal(typeof verb, "string")
		if (nouns === 1) continue
		if (nouns === 0) {
			assert.equal(verb, "undo", `${verb} is the only disabled action affordance`)
			continue
		}
		assert.ok(Array.isArray(nouns), `${verb} must be a button or noun list`)
		assert.equal(new Set(nouns.map((noun) => `${typeof noun}:${noun}`)).size, nouns.length, `${verb} contains duplicate nouns`)
	}
}

function isWaitingPrompt(prompt) {
	return typeof prompt === "string" && prompt.startsWith("等待 ")
}

function progressSignature(game) {
	return JSON.stringify({
		state: game.state,
		active: game.active,
		turn: game.turn,
		round: game.action_round,
		phase: game.phase,
		action: game.action,
		combat: game.combat,
		orders: game.orders,
		replacement: game.replacement,
		reinforcement: game.reinforcement,
	})
}

function firstDifference(actual, expected, path = "game") {
	if (Object.is(actual, expected)) return null
	if (path.endsWith(".rollback_state") && typeof actual === "string" && typeof expected === "string") {
		return firstDifference(Collaboration.decodeRollbackStates(actual), Collaboration.decodeRollbackStates(expected), `${path}<decoded>`)
	}
	if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return { path, actual, expected }
	const actualKeys = Object.keys(actual)
	const expectedKeys = Object.keys(expected)
	if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) return { path: `${path}<keys>`, actual: actualKeys, expected: expectedKeys }
	const keys = new Set([...actualKeys, ...expectedKeys])
	for (const key of keys) {
		const difference = firstDifference(actual[key], expected[key], `${path}.${key}`)
		if (difference) return difference
	}
	return null
}

function runFuzz(options = {}) {
	const seed = options.seed ?? 20260715
	const maxSteps = options.maxSteps ?? 500
	const random = makeRandom(options.choiceSeed ?? seed ^ 0x9e3779b9)
	let game = rules.setup(seed, "Campaign", options.gameOptions || {})
	let priorSignature = ""
	let repeated = 0
	let checkedLogLength = 0
	const expectEnglish = game.options.ui_locale === "en"
	const untranslated = new Set()

	for (let step = 0; step < maxSteps && game.state !== "game_over"; step++) {
		assert.doesNotThrow(() => JSON.stringify(game))
		assert.ok(States.hasState(game.state), `unregistered state ${game.state}`)
		assert.ok(rules.roles.includes(game.active), `invalid active role ${game.active}`)
		const beforeView = JSON.stringify(game)
		const view = rules.view(game, game.active)
		assert.equal(JSON.stringify(game), beforeView, `view mutated ${game.state}`)
		assert.equal(JSON.stringify(rules.view(game, game.active)), JSON.stringify(view), `unstable view in ${game.state}`)
		assert.match(view.prompt, /\S/)
		assert.equal(isWaitingPrompt(view.prompt), false, `active player received waiting prompt in ${game.state}`)
		if (expectEnglish) {
			if (options.collectEnglishGaps) {
				if (/[\u3400-\u9fff]/.test(view.prompt)) untranslated.add(`prompt:${game.state}:${view.prompt}`)
				for (const entry of view.log.slice(checkedLogLength)) if (/[\u3400-\u9fff]/.test(String(entry))) untranslated.add(`log:${game.state}:${entry}`)
			} else {
				assert.doesNotMatch(view.prompt, /[\u3400-\u9fff]/, `untranslated English prompt in ${game.state}`)
				for (const entry of view.log.slice(checkedLogLength)) assert.doesNotMatch(String(entry), /[\u3400-\u9fff]/, `untranslated English log in ${game.state}`)
			}
			checkedLogLength = view.log.length
		}
		verifyActionShape(view.actions)
		const choice = chooseAction(view.actions, random)
		assert.ok(choice, `nonterminal state ${game.state} has no progressing action`)
		game = rules.action(game, game.active, choice.verb, choice.noun)

		const signature = progressSignature(game)
		if (signature === priorSignature) repeated++
		else repeated = 0
		assert.ok(repeated < 20, `no progress after ${repeated + 1} actions in ${game.state}`)
		priorSignature = signature
	}

	const replayed = rules.replay(game.initial_seed, game.scenario, game.options, game.action_log)
	if (JSON.stringify(replayed) !== JSON.stringify(game)) {
		const difference = firstDifference(replayed, game)
		assert.fail(`recorded action replay diverged at ${difference?.path}: replay=${JSON.stringify(difference?.actual)} live=${JSON.stringify(difference?.expected)}`)
	}
	return {
		actions: game.action_log.length,
		state: game.state,
		turn: game.turn,
		untranslated: [...untranslated],
	}
}

if (require.main === module) {
	const maxSteps = Number(process.argv[2] || 1000)
	const result = runFuzz({ maxSteps })
	process.stdout.write(`${JSON.stringify(result)}\n`)
}

module.exports = { chooseAction, flattenActions, isWaitingPrompt, runFuzz }
