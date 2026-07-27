"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const { parseHTML } = require("linkedom")

const ROOT = path.resolve(__dirname, "..")
const play = fs.readFileSync(path.join(ROOT, "play.js"), "utf8")
const html = fs.readFileSync(path.join(ROOT, "play.html"), "utf8")

function plain(value) {
	return JSON.parse(JSON.stringify(value))
}

function frontendHelpers(view, data = { spaces: [], pieces: [] }, locale = "zh-CN") {
	const end = play.indexOf("function setMenuCheck")
	const source = `${play.slice(0, end)}
uiLocale = ${JSON.stringify(locale)}
globalThis.__helpers = {
	pieceSize,
	stackPieceRank,
	stackMarkerRank,
	compareStackEntries,
	spaceClickIntent,
	reinforcementMoveTarget,
	combatCardDisplay,
	replacementPointSummary,
	generalTrackPoint,
	turnTrackPoint,
	actionTrackEntries,
	eventMarkerDescriptors,
	trackMarkerDescriptors,
	cardQueryGroups,
	cardMenuActions,
	on_prompt,
	spaceStatusText,
	pieceStatusText,
	supplyStatusCounts,
	outOfSupplySpaceIds,
	controlMarkerDescriptor,
}`
	const context = { BTB_DATA: data, view, BTBI18N: require("../modules/core/i18n.js") }
	vm.runInNewContext(source, context)
	return context.__helpers
}

test("English marker descriptions contain no Chinese or internal enum labels", () => {
	const helpers = frontendHelpers(
		{
			turn: 6,
			vp: 12,
			hand_limit: { allied: 6, axis: 7 },
			rp: { ge: 11, axis: 2, br: 3, usa: 4, su: 5, tu: 1 },
			events: { barbarossa: true, us_entry_source: 6, industrial_evacuation: true, industrial_evacuation_turn: 2 },
			invasion_usage: { turn: 6, used: true },
			orders: {
				axis: { result: "hitler_orders", fulfilled: false },
				allied: { result: "stalin_orders", fulfilled: true },
			},
			action_track: { allied: ["br_reinf", "allied_invasion"], axis: ["ge_reinf", "ops"] },
		},
		undefined,
		"en",
	)
	const descriptions = [...helpers.eventMarkerDescriptors().map((marker) => marker.title), ...helpers.trackMarkerDescriptors().map((marker) => marker.title), helpers.replacementPointSummary({ ge: 2, su: 3 })]
	for (const description of descriptions) {
		assert.doesNotMatch(description, /[\u3400-\u9fff]/)
		assert.doesNotMatch(description, /\b(?:hitler_orders|stalin_orders|br_reinf|ge_reinf)\b/)
	}
})

test("BTB counters and map use their published dimensions and optimized asset", () => {
	const helpers = frontendHelpers({ actions: {} })
	assert.equal(helpers.pieceSize({ size: "lcu" }), 58)
	assert.equal(helpers.pieceSize({ size: "scu" }), 46)
	assert.equal(helpers.pieceSize({}), 46)

	const { document } = parseHTML(html)
	const map = document.getElementById("map-image")
	assert.equal(map.getAttribute("src"), "btb%20map.webp")
	assert.equal(map.getAttribute("width"), "3400")
	assert.equal(map.getAttribute("height"), "2200")
	const source = fs.statSync(path.join(ROOT, "btb map.png"))
	const optimized = fs.statSync(path.join(ROOT, "btb map.webp"))
	assert.ok(optimized.size < source.size / 2)
})

test("legal actions map to card, space, and off-map interaction intents", () => {
	const helpers = frontendHelpers({
		actions: {
			card: [7, 8],
			play_ops: [7, 8],
			play_event: [7],
			play_sr: [8],
			space: [17],
			attack: [17],
			move: [18],
		},
	})
	assert.deepEqual(Array.from(helpers.cardMenuActions(7)), ["play_event", "play_ops"])
	assert.deepEqual(Array.from(helpers.cardMenuActions(8)), ["play_ops", "play_sr"])
	assert.deepEqual(plain(helpers.spaceClickIntent(17)), {
		type: "choice",
		verbs: ["space", "attack"],
	})
	assert.deepEqual(plain(helpers.spaceClickIntent(18)), {
		type: "action",
		verb: "move",
		verbs: ["move"],
	})
	assert.equal(helpers.reinforcementMoveTarget("allied_reserve"), "reserve:allied")
	assert.equal(helpers.reinforcementMoveTarget("axis_reserve"), "reserve:axis")
	assert.equal(helpers.reinforcementMoveTarget("allied_eliminated"), null)
})

test("combat-card display separates played cards from retained cards without duplication", () => {
	const helpers = frontendHelpers({
		combat: { cc_played: { allied: [8], axis: [98] } },
		combat_cards: { allied: [8, 10], axis: [98, 103] },
	})
	assert.deepEqual(plain(helpers.combatCardDisplay()), {
		played: [8, 98],
		retained: [10, 103],
	})
})

test("replacement and card-query summaries omit empty groups", () => {
	const helpers = frontendHelpers({ actions: {} })
	assert.equal(
		helpers.replacementPointSummary({
			ge: 3,
			axis: 1,
			br: 0,
			usa: 2,
			su: 4,
			tu: 0,
		}),
		"RP · 德 3 · 轴 1 · 美 2 · 苏 4",
	)
	assert.equal(helpers.replacementPointSummary({ ge: 0, axis: 0, br: 0, usa: 0, su: 0, tu: 0 }), "")
	assert.deepEqual(plain(helpers.cardQueryGroups("discard", [8, 10])), [{ title: "我的弃牌堆", cards: [8, 10] }])
	assert.deepEqual(
		plain(
			helpers.cardQueryGroups("removed", {
				allied: [20],
				axis: [65],
			}),
		),
		[
			{ title: "盟军移出游戏", cards: [20] },
			{ title: "轴心国移出游戏", cards: [65] },
		],
	)
})

test("card queries use a non-modal panel while rollback confirmation remains modal", () => {
	const { document } = parseHTML(html)
	const panel = document.getElementById("card_list_panel")
	assert.equal(panel.tagName, "DIV")
	assert.equal(panel.hasAttribute("hidden"), true)
	assert.deepEqual(
		[...document.querySelectorAll("dialog")].map((element) => element.id),
		["propose_rollback_dialog", "review_rollback_dialog"],
	)
})

test("supply and map status helpers summarize public state", () => {
	const spaces = []
	spaces[7] = {
		id: 7,
		name: "测试城",
		kind: "land",
		side: "axis",
		terrain: "forest",
		urban: true,
		vp: 1,
		fort: true,
		port: true,
	}
	const pieces = []
	pieces[3] = {
		id: 3,
		name: "测试军",
		side: "allied",
		cf: 4,
		lf: 3,
		mf: 3,
		rcf: 2,
		rlf: 3,
		rmf: 2,
	}
	pieces[4] = {
		id: 4,
		name: "测试标记",
		side: "allied",
		size: "marker",
	}
	const helpers = frontendHelpers(
		{
			control: { 7: "allied" },
			destroyed_forts: [],
			trench: { 7: 2 },
			stand_fast: { 7: "stalin" },
			partisans: [7],
			pieces: { 3: 7, 4: 7 },
			reduced: [3],
			actions: {},
		},
		{ spaces, pieces },
	)
	assert.deepEqual(plain(helpers.supplyStatusCounts({ pieces: { 1: "full", 2: "full", 3: "limited", 4: "oos" } })), {
		full: 2,
		limited: 1,
		oos: 1,
	})
	assert.equal(helpers.spaceStatusText(spaces[7]), "测试城 · 控制：盟军 · 森林 · 城市 · VP 1 · 港口 · 要塞 · 战壕 2 · 坚守 · 游击队 · 1个单位")
	assert.equal(helpers.pieceStatusText(3), "测试军（减员） · 盟军 · 2-3-2 · 测试城")
})

test("stack ordering keeps markers, full units, reduced units, and action markers stable", () => {
	const helpers = frontendHelpers({ actions: {} })
	const entries = [
		[1, {}, 51, helpers.stackMarkerRank("trench")],
		[11, {}, 58, helpers.stackPieceRank({ size: "lcu" }, false)],
		[12, {}, 58, helpers.stackPieceRank({ size: "lcu" }, true)],
		[20, {}, 46, helpers.stackPieceRank({ size: "scu" }, false)],
		[10, {}, 58, helpers.stackPieceRank({ size: "lcu" }, false)],
		[0, {}, 51, helpers.stackMarkerRank("move")],
	].sort(helpers.compareStackEntries)
	assert.deepEqual(
		entries.map((entry) => entry[0]),
		[1, 11, 10, 12, 20, 0],
	)
	assert.equal(helpers.stackMarkerRank("control"), -1)
	assert.equal(helpers.stackMarkerRank("combat"), 4)
	assert.ok(helpers.stackMarkerRank("oos") > helpers.stackMarkerRank("combat"))
})

test("printed tracks map game state to stable BTB artwork coordinates", () => {
	const helpers = frontendHelpers({
		turn: 18,
		vp: 17,
		active: "Allied",
		hand_limit: { allied: 8, axis: 7 },
		rp: { ge: 13, axis: 2, br: 1, usa: 0, su: 4 },
		orders: {
			axis: { result: "okw_mo", fulfilled: false },
			allied: { result: "soviet_mo", fulfilled: true },
		},
		action_track: { allied: ["ops"], axis: ["sr"] },
		action: { track: "one_ops" },
		events: { industrial_evacuation: true, industrial_evacuation_turn: 10 },
	})
	assert.deepEqual(plain(helpers.generalTrackPoint(7)), [128, 1506])
	assert.deepEqual(plain(helpers.turnTrackPoint(18)), [3095, 1517])
	assert.deepEqual(plain(helpers.actionTrackEntries("allied")), ["ops", "one_ops"])
	const markers = new Map(helpers.trackMarkerDescriptors().map((marker) => [marker.key, marker]))
	assert.deepEqual([markers.get("turn").x, markers.get("turn").y], [3095, 1517])
	assert.equal(markers.get("rp:ge").asset, "GE Repl +10.jpg")
	assert.deepEqual([markers.get("rp:ge").x, markers.get("rp:ge").y], [128, 1846])
	assert.equal(markers.get("orders:axis").asset, "Axis Order.jpg")
	assert.deepEqual([markers.get("orders:axis").x, markers.get("orders:axis").y], [3192, 357])
	assert.deepEqual([markers.get("action:allied:2").x, markers.get("action:allied:2").y], [719, 2092])
	assert.deepEqual([markers.get("event:industrial_evacuation").x, markers.get("event:industrial_evacuation").y], plain(helpers.turnTrackPoint(14)))
	for (const marker of markers.values()) assert.equal(fs.existsSync(path.join(ROOT, "images", marker.asset)), true, marker.asset)
})

test("persistent reminders use the reinforcement board and scheduled events use the turn track", () => {
	const helpers = frontendHelpers({
		turn: 5,
		events: {
			lend_lease: true,
			speer: true,
			us_entry: true,
			us_entry_source: 6,
			industrial_evacuation: true,
			industrial_evacuation_turn: 3,
		},
		invasion_usage: { turn: 5, used: 16 },
	})
	const reminders = new Map(helpers.eventMarkerDescriptors().map((marker) => [marker.key, marker]))
	assert.equal(reminders.get("lend_lease").asset, "Lend-Lease.jpg")
	assert.equal(reminders.get("speer").side, "axis")
	assert.equal(reminders.get("us_entry").asset, "FDR Declares War.jpg")
	assert.equal(reminders.get("allied_invasion").asset, "Allied Invasion.jpg")
	assert.equal(reminders.has("industrial_evacuation"), false)
	const tracks = new Map(helpers.trackMarkerDescriptors().map((marker) => [marker.key, marker]))
	assert.deepEqual([tracks.get("event:industrial_evacuation").x, tracks.get("event:industrial_evacuation").y], plain(helpers.turnTrackPoint(7)))
})

test("out-of-supply and control markers derive from public board state", () => {
	const helpers = frontendHelpers({
		pieces: [null, 7, 7, 8],
		oos: [1, 2],
		control: [null, "neutral"],
		actions: {},
	})
	assert.deepEqual(
		[...helpers.outOfSupplySpaceIds()].sort((a, b) => a - b),
		[7],
	)
	assert.equal(helpers.controlMarkerDescriptor({ id: 1, side: "allied" }), null)
	assert.equal(helpers.controlMarkerDescriptor({ id: 1, side: "neutral" }), null)
	assert.equal(helpers.controlMarkerDescriptor({ id: 1, side: "allied" }, { control: [null, "axis"] }).asset, "German Control.jpg")
})

test("unit log references preserve recorded full and reduced strength", () => {
	const helpers = frontendHelpers({ actions: {}, reduced: [1] }, { spaces: [], pieces: [null, { id: 1, name: "GE 16 Army", side: "axis" }] })
	const full = helpers.on_prompt("P1减员")
	const reduced = helpers.on_prompt("p1消灭")
	assert.match(full, />GE 16 Army<\/span>减员/)
	assert.doesNotMatch(full, /（减员）减员/)
	assert.match(reduced, />（GE 16 Army）<\/span>消灭/)
})
