"use strict"

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const assert = require("node:assert/strict")
const { build, serialize, validateSpaces, validateEdges, writeGeneratedFile } = require("../tools/build_data.js")
const { makeReport } = require("../tools/report_progress.js")

const ROOT = path.resolve(__dirname, "..")

test("card assets are paired by side, number, and language", () => {
	for (const language of ["CN", "EN"]) {
		for (const side of ["allied", "axis"]) {
			for (let num = 1; num <= 55; num++) {
				const name = `card_${side}_${String(num).padStart(2, "0")}.webp`
				assert.equal(fs.existsSync(path.join(ROOT, `cards.${language}`, name)), true, `${language}/${name}`)
			}
		}
	}
})

test("CSV sources build a deterministic data module", () => {
	const first = build()
	const second = build()
	assert.equal(first.data.cards.length, 111)
	assert.equal(
		first.data.cards.slice(1).every((card) => typeof card.name_zh === "string" && card.name_zh.length > 0),
		true,
	)
	assert.equal(first.data.cards[1].name_zh, "火炬行动")
	assert.equal(first.data.cards[56].name_zh, "巴巴罗萨")
	const alliedFiveOpsCards = first.data.cards.filter((card) => card?.side === "allied" && card.ops === 5)
	assert.equal(alliedFiveOpsCards.length, 12)
	assert.equal(
		alliedFiveOpsCards.every((card) => card.rp_su === 5),
		true,
	)
	assert.equal(serialize(first.data), serialize(second.data))
})

test("generated data writes are atomic and skip unchanged content", () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "btb-data-"))
	const file = path.join(directory, "data.js")
	try {
		assert.equal(writeGeneratedFile(file, "first\n"), true)
		assert.equal(writeGeneratedFile(file, "first\n"), false)
		assert.equal(writeGeneratedFile(file, "second\n"), true)
		assert.equal(fs.readFileSync(file, "utf8"), "second\n")
		assert.deepEqual(fs.readdirSync(directory), ["data.js"])
	} finally {
		fs.rmSync(directory, { recursive: true, force: true })
	}
})

test("generated runtime data excludes authored-data audit and compatibility fields", () => {
	const { data } = build()
	assert.equal(
		data.cards.filter(Boolean).every((card) => !("event_key" in card) && !("sr" in card)),
		true,
	)
	assert.equal(
		data.spaces.filter(Boolean).every((space) => !("flags" in space) && !("beach" in space) && !("attack_card" in space)),
		true,
	)
	assert.equal(
		data.edges.every((edge) => !("flags" in edge) && !("rule" in edge)),
		true,
	)
	assert.equal(
		data.pieces.filter(Boolean).every((piece) => !("flags" in piece)),
		true,
	)
	assert.equal(
		data.setup.every((row) => !("scenario" in row) && !("flags" in row)),
		true,
	)
})

test("CSV schema stores authored facts once and derives stable runtime fields", () => {
	const header = (file) =>
		fs
			.readFileSync(path.join(ROOT, "csv", file), "utf8")
			.split(/\r?\n/, 1)[0]
			.split(",")
	assert.deepEqual(header("cards.csv"), ["id", "side", "num", "ops", "remove", "cc", "dual", "dual_condition", "rp_ge", "rp_axis", "rp_br", "rp_usa", "rp_su", "name", "name_zh"])
	assert.deepEqual(header("pieces.csv"), ["id", "nation", "name", "size", "unit_type", "cf", "lf", "mf", "rcf", "rlf", "rmf", "asset", "traits", "reduced_asset"])
	assert.deepEqual(header("edges.csv"), ["a", "b", "type"])
	assert.deepEqual(header("reinforcements.csv"), ["card_id", "sequence", "kind", "piece_id", "nation", "count", "placement", "label_zh", "selector_name", "selector_names", "reduced"])
	assert.deepEqual(header("reinforcement_board.csv"), ["id", "kind", "card_ids", "piece_id", "token", "x", "y", "w", "h"])
	assert.deepEqual(header("spaces.csv"), ["id", "name", "x", "y", "w", "h", "kind", "nation", "side", "terrain", "urban", "vp", "fort", "supply", "port", "resource", "capital", "wehrkreis", "attack_requires_event", "beach_letter"])
	assert.equal(fs.existsSync(path.join(ROOT, "csv", "setup.csv")), false)
	assert.equal(fs.existsSync(path.join(ROOT, "csv", "ui.csv")), false)
	assert.equal(fs.existsSync(path.join(ROOT, "csv", "space_layout.csv")), false)

	const { data } = build()
	assert.deepEqual([data.cards[1].id, data.cards[56].id], [1, 56])
	assert.equal(data.cards[56].deck, "blitzkrieg")
	const germanPiece = data.pieces.find((piece) => piece?.nation === "ge" && piece.size !== "marker")
	assert.equal(germanPiece.side, "axis")
	assert.match(germanPiece.image_reduced, /-b\.[a-z]+$/i)
	assert.equal(data.pieces.filter(Boolean).filter((piece) => piece.traits === "non_replaceable").length, 5)
	const southwest = data.pieces[140]
	assert.deepEqual([southwest.cf, southwest.lf, southwest.mf, southwest.rcf, southwest.rlf, southwest.rmf], [5, 3, 4, 3, 3, 3])
	assert.equal(southwest.image_full, "SU_SW Mech.jpg")
	assert.equal(southwest.image_reduced, "SU_SW.jpg")
	assert.equal(data.pieces[997].image_full, "SU_SW.jpg")
	assert.deepEqual(
		data.reinforcements[4].units.map((unit) => unit.piece_id),
		[469, 474, 475, 476, 477, 478],
	)
	assert.equal(
		data.reinforcements[4].units.every((unit) => unit.placement === "lcu_style"),
		true,
	)
	assert.deepEqual(
		data.reinforcements[13].units.map((unit) => unit.piece_id),
		[462, 465, 466, 467, 468],
	)
	assert.equal(
		data.reinforcements[13].units.every((unit) => unit.placement === "lcu_style"),
		true,
	)
	assert.deepEqual(
		data.reinforcements[31].units.map((unit) => unit.piece_id),
		[451, 452, 453, 454],
	)
	assert.equal(
		data.reinforcements[31].units.every((unit) => unit.kind === "replace" && unit.placement === "front_upgrade"),
		true,
	)
	assert.deepEqual(
		data.reinforcements[37].units.map((unit) => unit.piece_id),
		[455, 456, 457],
	)
	assert.deepEqual(
		data.reinforcements[39].units.map((unit) => unit.piece_id),
		[459, 460, 461],
	)
	assert.deepEqual(data.reinforcements[2].reserves, [
		{
			nation: "su",
			count: 4,
			label_zh: "苏军集团军",
			selector_name: "SU SCU",
		},
	])
	assert.equal(
		data.reinforcements[87].units.every((unit) => unit.reduced === true),
		true,
	)
	assert.deepEqual(data.reinforcements[79].reserves[1].selector_names, ["GE 1SS Armor Corps", "GE 2SS Armor Corps"])
})

test("reinforcement board manifest covers every printed live counter and card group", () => {
	const { data } = build()
	const board = data.reinforcement_board
	assert.deepEqual([board.width, board.height], [1320, 1020])
	assert.equal(board.slots.length, 86)
	assert.equal(board.tokens.length, 5)
	assert.equal(board.card_areas.length, 32)
	assert.equal(new Set(board.card_areas.flatMap((area) => area.card_ids)).size, 37)
	assert.deepEqual(
		data.setup
			.filter((row) => row.location === "available" && !board.slots.some((slot) => slot.piece_id === row.piece_id))
			.map((row) => row.piece_id)
			.sort((a, b) => a - b),
		[578, 579, 580, 581],
	)
	for (const pieceId of [401, 413, 419, 427, 483, 492, 518, 556, 559, 564, 573]) assert.equal(board.slots.some((slot) => slot.piece_id === pieceId), true, `piece ${pieceId}`)
	for (const cardId of [1, 16, 21, 33, 34, 42, 45, 46, 50, 52, 62, 77, 78, 93, 94, 109])
		assert.equal(board.card_areas.some((area) => area.card_ids.includes(cardId)), true, `card ${cardId}`)
})

test("the generated rulebook reference preserves the authoritative development anchors", () => {
	const markdown = fs.readFileSync(path.join(ROOT, "docs", "BTB_RULES_2006_v1.3.md"), "utf8")
	for (let number = 1; number <= 20; number++) assert.match(markdown, new RegExp(`^## ${number}\\.0 `, "m"))
	assert.match(markdown, /^### 7\.62 Reinforcement Event Cards$/m)
	assert.match(markdown, /Neither player may play a Reinforcement card on the June 41 turn\./)
	assert.match(markdown, /^2\. 4 SOVIET REINFORCEMENTS\*: Place Don, Stalingrad, Steppe and Voronezh Fronts\./m)
	assert.match(markdown, /^24\. 3 SOVIET REINFORCEMENTS\*: Place Bryansk, Kalinin, and Volkhov Fronts\./m)
	assert.match(markdown, /^## Additional Clarifications$/m)
})

test("BTB card deck boundary is 25 Blitzkrieg and 30 Total War cards per side", () => {
	const { data } = build()
	for (const side of ["allied", "axis"]) {
		const cards = data.cards.filter((card) => card && card.side === side)
		assert.equal(cards.filter((card) => card.deck === "blitzkrieg").length, 25)
		assert.equal(cards.filter((card) => card.deck === "total_war").length, 30)
	}
})

test("generated map data contains only valid endpoints", () => {
	const { data } = build()
	const ids = new Set(data.spaces.filter(Boolean).map((space) => space.id))
	assert.equal(ids.size, 352)
	assert.equal(data.edges.length, 658)
	assert.equal(
		data.edges.every((edge) => ids.has(edge.a) && ids.has(edge.b)),
		true,
	)
})

test("progress report exposes remaining authored-data work", () => {
	const report = makeReport()
	assert.deepEqual(report.cards, { total: 110, complete: 110, pending: 0 })
	assert.equal(report.spaces.total, 352)
	assert.equal(report.spaces.reviewed + report.spaces.pending, 352)
	assert.equal(report.edges.reviewed + report.edges.pending, report.edges.total)
	assert.equal(report.reinforcements.total, 57)
})

test("map schema enforces the rules-book terrain and connection enums", () => {
	assert.throws(
		() =>
			validateSpaces([
				{
					id: 1,
					name: "X",
					x: 0,
					y: 0,
					w: 50,
					h: 50,
					kind: "land",
					terrain: "plains",
					nation: "ge",
					side: "axis",
				},
			]),
		/invalid terrain/,
	)
	assert.throws(() => validateEdges([{ a: 1, b: 2, type: "limited" }], new Set([1, 2])), /invalid type/)
})

test("map attributes cover every space and preserve combined terrain symbols", () => {
	const { data } = build()
	const spaces = data.spaces.filter(Boolean)
	assert.equal(
		spaces.every((space) => space.nation && ["axis", "allied", "neutral"].includes(space.side)),
		true,
	)
	assert.equal(
		spaces.filter((space) => space.kind === "land").every((space) => ["clear", "desert", "mountain", "forest", "swamp"].includes(space.terrain)),
		true,
	)
	assert.equal(data.spaces[376].terrain, "forest")
	assert.equal(data.spaces[376].urban, true)
	assert.equal(data.spaces[27].terrain, "mountain")
	assert.equal(data.spaces[30].terrain, "forest")
})

test("the six former Polish spaces belong to Germany without changing their printed attributes", () => {
	const { data } = build()
	const spaces = data.spaces.filter(Boolean)
	const ids = [96, 97, 306, 307, 308, 309]
	assert.deepEqual(
		ids.map((id) => {
			const space = data.spaces[id]
			return {
				id: space.id,
				name: space.name,
				nation: space.nation,
				side: space.side,
				supply: Boolean(space.supply),
				resource: Boolean(space.resource),
				urban: Boolean(space.urban),
				vp: Number(space.vp) || 0,
				wehrkreis: space.wehrkreis || null,
			}
		}),
		[
			{ id: 96, name: "Lodz Kalisch", nation: "ge", side: "axis", supply: false, resource: false, urban: false, vp: 0, wehrkreis: null },
			{ id: 97, name: "Krakow", nation: "ge", side: "axis", supply: false, resource: false, urban: false, vp: 0, wehrkreis: "K" },
			{ id: 306, name: "Warsaw", nation: "ge", side: "axis", supply: false, resource: false, urban: true, vp: 1, wehrkreis: null },
			{ id: 307, name: "Radom", nation: "ge", side: "axis", supply: false, resource: false, urban: false, vp: 0, wehrkreis: null },
			{ id: 308, name: "Lublin", nation: "ge", side: "axis", supply: false, resource: false, urban: false, vp: 0, wehrkreis: null },
			{ id: 309, name: "Tarnow", nation: "ge", side: "axis", supply: false, resource: false, urban: false, vp: 0, wehrkreis: null },
		],
	)
	assert.equal(
		spaces.some((space) => space.nation === "pl"),
		false,
	)
})

test("printed map symbols and special attack restrictions are represented as authored facts", () => {
	const { data } = build()
	const spaces = data.spaces.filter(Boolean)
	assert.equal(spaces.filter((space) => Number(space.vp) > 0).length, 53)
	assert.deepEqual(
		spaces
			.filter((space) => space.fort)
			.map((space) => space.name)
			.sort(),
		["Brest", "Konigsberg", "Leningrad", "Ruhr", "Sevastopol"],
	)
	assert.equal(spaces.filter((space) => space.port).length, 33)
	assert.equal(spaces.filter((space) => space.capital).length, 11)
	assert.equal(spaces.filter((space) => space.wehrkreis).length, 19)
	assert.deepEqual(
		spaces.filter((space) => space.attack_requires_event).map((space) => [space.name, space.attack_requires_event]),
		[
			["Maikop", "fall_blau"],
			["Armavir", "fall_blau"],
			["Stalingrad", "fall_blau"],
			["Chelyabiinsk", "axis_no_entry"],
			["Sverdlovsk", "axis_no_entry"],
			["Leningrad", "nordlicht"],
			["Moscow", "taifun"],
		],
	)
	for (const [a, b] of [
		[294, 303],
		[285, 323],
		[286, 328],
	]) {
		assert.equal(
			data.edges.some((edge) => edge.type === "sr" && ((edge.a === a && edge.b === b) || (edge.a === b && edge.b === a))),
			true,
		)
	}
	assert.deepEqual(Object.fromEntries(["regular", "river", "sr"].map((type) => [type, data.edges.filter((edge) => edge.type === type).length])), { regular: 543, river: 77, sr: 38 })
	for (const neighbor of [48, 51]) {
		assert.equal(
			data.edges.some((edge) => edge.type === "regular" && ((edge.a === 47 && edge.b === neighbor) || (edge.a === neighbor && edge.b === 47))),
			true,
		)
	}
	assert.equal(
		data.edges.some((edge) => (edge.a === 48 && edge.b === 51) || (edge.a === 51 && edge.b === 48)),
		false,
	)
	assert.equal(
		data.edges.some((edge) => edge.a === 373 && edge.b === 372 && edge.type === "sr"),
		true,
	)
	assert.deepEqual(
		{
			name: data.spaces[185].name,
			nation: data.spaces[185].nation,
			side: data.spaces[185].side,
		},
		{ name: "Ardebil", nation: "ir", side: "allied" },
	)
})

test("1941 initial control handles neutral and North Africa exceptions", () => {
	const { data } = build()
	assert.equal(data.spaces[7].side, "axis") // Bordeaux: Occupied France
	assert.equal(data.spaces[25].side, "neutral") // Marseille: Vichy France
	assert.equal(data.spaces[257].side, "allied") // Tobruk exception
	assert.equal(data.spaces[265].side, "axis") // Tripoli
	assert.equal(data.spaces[271].side, "neutral") // Vichy Tunisia
	assert.equal(data.spaces[292].side, "neutral") // Sweden
})
