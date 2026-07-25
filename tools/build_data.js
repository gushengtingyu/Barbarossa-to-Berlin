"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { parse } = require("./csv.js")

const ROOT = path.resolve(__dirname, "..")
const CSV_DIR = path.join(ROOT, "csv")
const OUTPUT_FILE = path.join(ROOT, "data.js")
const MAP_WIDTH = 3400
const MAP_HEIGHT = 2200
const REINFORCEMENT_BOARD_WIDTH = 1320
const REINFORCEMENT_BOARD_HEIGHT = 1020

const NATION_SIDES = Object.freeze({
	br: "allied",
	cw: "allied",
	ff: "allied",
	su: "allied",
	us: "allied",
	yu: "allied",
	bu: "axis",
	ge: "axis",
	hu: "axis",
	it: "axis",
	ro: "axis",
	sw: "neutral",
	tu: "neutral",
})

const TABLES = {
	cards: {
		file: "cards.csv",
		numbers: ["id", "num", "ops", "rp_ge", "rp_axis", "rp_br", "rp_usa", "rp_su"],
		booleans: ["remove", "cc", "dual"],
	},
	spaces: {
		file: "spaces.csv",
		numbers: ["id", "x", "y", "w", "h", "vp"],
		booleans: ["urban", "fort", "port", "capital"],
	},
	edges: { file: "edges.csv", numbers: ["a", "b"], booleans: [] },
	pieces: {
		file: "pieces.csv",
		numbers: ["id", "cf", "lf", "mf", "rcf", "rlf", "rmf"],
		booleans: [],
	},
	setup: {
		file: "setup_campaign.csv",
		numbers: ["piece_id", "space_id"],
		booleans: ["reduced"],
	},
	reinforcements: {
		file: "reinforcements.csv",
		numbers: ["card_id", "sequence", "piece_id", "count"],
		booleans: ["reduced"],
	},
	reinforcement_board: {
		file: "reinforcement_board.csv",
		numbers: ["piece_id", "x", "y", "w", "h"],
		booleans: [],
	},
}

const REVIEW_TABLES = {
	spaces: {
		file: path.join("review", "spaces.csv"),
		numbers: ["id"],
		booleans: [],
	},
	edges: {
		file: path.join("review", "edges.csv"),
		numbers: ["a", "b"],
		booleans: [],
	},
	pieces: {
		file: path.join("review", "pieces.csv"),
		numbers: ["id"],
		booleans: [],
	},
	setup: {
		file: path.join("review", "setup_campaign.csv"),
		numbers: ["piece_id"],
		booleans: [],
	},
}

function asNumber(value, table, row, field) {
	if (value === "") return undefined
	const result = Number(value)
	if (!Number.isFinite(result)) throw new Error(`${table} row ${row}: ${field} must be numeric`)
	return result
}

function asBoolean(value, table, row, field) {
	if (value === "") return undefined
	if (["1", "true", "yes"].includes(String(value).toLowerCase())) return true
	if (["0", "false", "no"].includes(String(value).toLowerCase())) return false
	throw new Error(`${table} row ${row}: ${field} must be true/false or 1/0`)
}

function normalizeRow(table, row, index = 0, schemas = TABLES) {
	const schema = schemas[table]
	if (!schema) throw new Error(`Unknown CSV table: ${table}`)
	const normalized = {}
	for (const [field, raw] of Object.entries(row)) {
		let value = raw
		if (schema.numbers.includes(field)) value = asNumber(raw, table, index + 2, field)
		if (schema.booleans.includes(field)) value = asBoolean(raw, table, index + 2, field)
		if (value !== "" && value !== undefined) normalized[field] = value
	}
	return normalized
}

function loadSchemaTables(schemas) {
	const tables = {}
	for (const [table, schema] of Object.entries(schemas)) {
		const file = path.join(CSV_DIR, schema.file)
		if (!fs.existsSync(file)) throw new Error(`Missing CSV source: ${file}`)
		tables[table] = parse(fs.readFileSync(file, "utf8")).map((row, index) => normalizeRow(table, row, index, schemas))
	}
	return tables
}

function loadTables() {
	return loadSchemaTables(TABLES)
}

function loadReviewTables() {
	return loadSchemaTables(REVIEW_TABLES)
}

function assertUnique(rows, field, table) {
	const seen = new Map()
	for (let i = 0; i < rows.length; i++) {
		const value = rows[i][field]
		if (value === undefined) throw new Error(`${table} row ${i + 2}: missing ${field}`)
		if (seen.has(value)) throw new Error(`${table}: duplicate ${field} ${value} at rows ${seen.get(value)} and ${i + 2}`)
		seen.set(value, i + 2)
	}
}

function keyForEdge(edge) {
	return edge.a < edge.b ? `${edge.a}:${edge.b}` : `${edge.b}:${edge.a}`
}

function indexReview(rows, key, table) {
	const result = new Map()
	for (const row of rows) {
		const id = key(row)
		if (result.has(id)) throw new Error(`${table}: duplicate review row ${id}`)
		result.set(id, row)
	}
	return result
}

function requireReview(review, key, table) {
	const row = review.get(key)
	if (!row) throw new Error(`${table}: missing review row ${key}`)
	return row
}

function reducedAsset(asset) {
	const extension = path.extname(asset || "")
	if (!extension) return undefined
	return `${asset.slice(0, -extension.length)}-b${extension}`
}

function deriveCards(rows) {
	return rows.map((row) => ({
		...row,
		deck: row.num <= 25 ? "blitzkrieg" : "total_war",
	}))
}

function deriveSpaces(rows, reviewRows) {
	const reviewById = indexReview(reviewRows, (row) => row.id, "review/spaces")
	const spaces = rows.map((row) => {
		requireReview(reviewById, row.id, "review/spaces")
		return { ...row }
	})
	if (reviewById.size !== spaces.length) throw new Error("review/spaces must contain exactly one row for every space")
	return spaces
}

function deriveEdges(rows, reviewRows) {
	const reviewByKey = indexReview(reviewRows, keyForEdge, "review/edges")
	const edges = rows.map((row) => {
		requireReview(reviewByKey, keyForEdge(row), "review/edges")
		return { ...row }
	})
	if (reviewByKey.size !== edges.length) throw new Error("review/edges must contain exactly one row for every edge")
	return edges
}

function derivePieces(rows, reviewRows) {
	const reviewById = indexReview(reviewRows, (row) => row.id, "review/pieces")
	const pieces = rows.map((row) => {
		requireReview(reviewById, row.id, "review/pieces")
		const { asset, reduced_asset, ...piece } = row
		return {
			...piece,
			side: NATION_SIDES[row.nation],
			image_full: asset,
			...(row.size === "marker" ? {} : { image_reduced: reduced_asset || reducedAsset(asset) }),
		}
	})
	if (reviewById.size !== pieces.length) throw new Error("review/pieces must contain exactly one row for every piece")
	return pieces
}

function deriveSetup(rows, reviewRows) {
	const reviewByPiece = indexReview(reviewRows, (row) => row.piece_id, "review/setup_campaign")
	const setup = rows.map((row) => {
		requireReview(reviewByPiece, row.piece_id, "review/setup_campaign")
		return { ...row }
	})
	if (reviewByPiece.size !== setup.length) throw new Error("review/setup_campaign must contain exactly one row for every setup row")
	return setup
}

function deriveReinforcements(rows) {
	const result = {}
	for (const row of rows.slice().sort((a, b) => a.card_id - b.card_id || a.sequence - b.sequence)) {
		const spec = (result[row.card_id] ||= {
			card_id: row.card_id,
			units: [],
			reserves: [],
		})
		if (row.kind === "map" || row.kind === "replace") {
			spec.units.push({
				kind: row.kind,
				piece_id: row.piece_id,
				placement: row.placement,
				label_zh: row.label_zh,
				...(row.reduced ? { reduced: true } : {}),
			})
		} else {
			spec.reserves.push({
				nation: row.nation,
				count: row.count,
				label_zh: row.label_zh,
				...(row.selector_name ? { selector_name: row.selector_name } : {}),
				...(row.selector_names ? { selector_names: row.selector_names.split(";").filter(Boolean) } : {}),
			})
		}
	}
	return result
}

function deriveReinforcementBoard(rows) {
	const entries = rows.map((row) => ({
		...row,
		card_ids: row.card_ids.split(";").filter(Boolean).map(Number),
	}))
	return {
		width: REINFORCEMENT_BOARD_WIDTH,
		height: REINFORCEMENT_BOARD_HEIGHT,
		slots: entries.filter((row) => row.kind === "piece"),
		tokens: entries.filter((row) => row.kind === "token"),
		card_areas: entries.filter((row) => row.kind === "card"),
	}
}

function deriveReinforcementCatalog(reinforcements, cards, pieces) {
	return Object.values(reinforcements)
		.map((spec) => {
			const card = cards.find((candidate) => candidate.id === spec.card_id)
			if (!card) throw new Error(`reinforcement catalog: unknown card ${spec.card_id}`)
			return {
				card_id: card.id,
				side: card.side,
				number: card.num,
				name: card.name,
				name_zh: card.name_zh,
				units: spec.units,
				reserves: spec.reserves.map((reserve) => {
					const sample = pieces.find(
						(piece) =>
							piece?.side === card.side &&
							piece.nation === reserve.nation &&
							piece.size === "scu" &&
							(!reserve.selector_name || piece.name === reserve.selector_name) &&
							(!reserve.selector_names || reserve.selector_names.includes(piece.name)),
					)
					if (!sample) throw new Error(`reinforcement catalog card ${card.id}: no sample piece for ${reserve.nation} reserve`)
					return { ...reserve, sample_piece_id: sample.id }
				}),
			}
		})
		.sort((a, b) => a.side.localeCompare(b.side) || a.number - b.number || a.card_id - b.card_id)
}

function validateCards(cards, warnings) {
	assertUnique(cards, "id", "cards")
	const keys = new Set()
	const counts = { allied: 0, axis: 0 }
	let placeholderNames = 0
	for (const card of cards) {
		if (!(card.side in counts)) throw new Error(`cards ${card.id}: invalid side ${card.side}`)
		if (!Number.isInteger(card.num) || card.num < 1 || card.num > 55) throw new Error(`cards ${card.id}: num must be 1..55`)
		const expectedId = card.side === "allied" ? card.num : 55 + card.num
		if (card.id !== expectedId) throw new Error(`cards ${card.side}:${card.num}: unstable derived id`)
		const key = `${card.side}:${card.num}`
		if (keys.has(key)) throw new Error(`cards: duplicate ${key}`)
		keys.add(key)
		counts[card.side]++
		const expectedDeck = card.num <= 25 ? "blitzkrieg" : "total_war"
		if (card.deck !== expectedDeck) throw new Error(`cards ${card.id}: expected deck ${expectedDeck}`)
		if (!Number.isInteger(card.ops) || card.ops < 2 || card.ops > 5) throw new Error(`cards ${card.id}: invalid OPS value`)
		const rpFields = card.side === "allied" ? ["rp_br", "rp_usa", "rp_su"] : ["rp_ge", "rp_axis"]
		for (const field of rpFields) if (!Number.isInteger(card[field]) || card[field] < 0) throw new Error(`cards ${card.id}: missing ${field}`)
		if (!card.name) throw new Error(`cards ${card.id}: missing reviewed name`)
		if (!card.name_zh) throw new Error(`cards ${card.id}: missing reviewed Chinese name`)
		for (const language of ["CN", "EN"]) {
			const asset = path.join(ROOT, `cards.${language}`, `card_${card.side}_${String(card.num).padStart(2, "0")}.webp`)
			if (!fs.existsSync(asset)) throw new Error(`cards ${card.id}: missing ${language} asset ${path.basename(asset)}`)
		}
		if (/^(Allied|Axis) \d{2}$/.test(card.name || "")) placeholderNames++
	}
	if (counts.allied !== 55 || counts.axis !== 55) throw new Error(`cards: expected 55 per side, got allied=${counts.allied}, axis=${counts.axis}`)
	if (placeholderNames) warnings.push(`cards: ${placeholderNames} names are placeholders pending rules transcription`)
}

function validateSpaces(spaces, { requireAttributes = true } = {}) {
	assertUnique(spaces, "id", "spaces")
	const kinds = new Set(["land", "sr", "beach"])
	const terrains = new Set(["clear", "desert", "mountain", "forest", "swamp"])
	const sides = new Set(["axis", "allied", "neutral"])
	const supplies = new Set(["axis", "allied", "allied_scheldt", "axis_limited"])
	const resources = new Set(["oil", "iron"])
	for (const space of spaces) {
		for (const field of ["x", "y", "w", "h"]) if (!Number.isFinite(space[field])) throw new Error(`spaces ${space.id}: missing ${field}`)
		if (space.x < 0 || space.y < 0 || space.w <= 0 || space.h <= 0) throw new Error(`spaces ${space.id}: invalid rectangle`)
		if (space.x + space.w > MAP_WIDTH || space.y + space.h > MAP_HEIGHT) throw new Error(`spaces ${space.id}: rectangle is outside ${MAP_WIDTH}x${MAP_HEIGHT} map`)
		if (!kinds.has(space.kind)) throw new Error(`spaces ${space.id}: invalid kind ${space.kind}`)
		if (space.kind === "land" && !terrains.has(space.terrain)) throw new Error(`spaces ${space.id}: invalid terrain ${space.terrain}`)
		if (space.kind !== "land" && space.terrain !== undefined) throw new Error(`spaces ${space.id}: ${space.kind} spaces may not have terrain`)
		if (requireAttributes && !sides.has(space.side)) throw new Error(`spaces ${space.id}: invalid side ${space.side}`)
		if (requireAttributes && !space.nation) throw new Error(`spaces ${space.id}: missing nation`)
		if (space.supply !== undefined && !supplies.has(space.supply)) throw new Error(`spaces ${space.id}: invalid supply ${space.supply}`)
		if (space.resource !== undefined && !resources.has(space.resource)) throw new Error(`spaces ${space.id}: invalid resource ${space.resource}`)
		if (space.kind === "beach" && !/^[A-U]$/.test(space.beach_letter || "")) throw new Error(`spaces ${space.id}: beach spaces require beach_letter A..U`)
		if (space.kind !== "beach" && space.beach_letter !== undefined) throw new Error(`spaces ${space.id}: only beach spaces may define beach_letter`)
	}
}

function validateEdges(edges, spaceIds) {
	const seen = new Set()
	const validTypes = new Set(["regular", "river", "sr"])
	for (let i = 0; i < edges.length; i++) {
		const edge = edges[i]
		if (!spaceIds.has(edge.a) || !spaceIds.has(edge.b)) throw new Error(`edges row ${i + 2}: unknown endpoint`)
		if (edge.a === edge.b) throw new Error(`edges row ${i + 2}: self edge`)
		if (!validTypes.has(edge.type)) throw new Error(`edges row ${i + 2}: invalid type ${edge.type}`)
		const key = keyForEdge(edge)
		if (seen.has(key)) throw new Error(`edges row ${i + 2}: duplicate edge ${key}`)
		seen.add(key)
	}
}

function validatePieces(pieces) {
	assertUnique(pieces, "id", "pieces")
	for (const piece of pieces) {
		if (!new Set(["allied", "axis", "neutral"]).has(piece.side)) throw new Error(`pieces ${piece.id}: nation ${piece.nation} has no side mapping`)
		if (!new Set(["lcu", "scu", "marker"]).has(piece.size)) throw new Error(`pieces ${piece.id}: invalid size ${piece.size}`)
		if (!piece.image_full) throw new Error(`pieces ${piece.id}: missing asset`)
	}
}

function validateReferences(tables) {
	const cardIds = new Set(tables.cards.map((card) => card.id))
	const pieceIds = new Set(tables.pieces.map((piece) => piece.id))
	const spaceIds = new Set(tables.spaces.map((space) => space.id))
	for (const row of tables.setup) {
		if (!pieceIds.has(row.piece_id)) throw new Error(`setup: unknown piece ${row.piece_id}`)
		if (row.space_id !== undefined && !spaceIds.has(row.space_id)) throw new Error(`setup: unknown space ${row.space_id}`)
		if (row.space_id === undefined && !row.location) throw new Error(`setup: piece ${row.piece_id} needs space_id or location`)
	}
	const reinforcementKeys = new Set()
	const cardSequences = new Map()
	for (const row of tables.reinforcement_rows) {
		const key = `${row.card_id}:${row.sequence}`
		if (reinforcementKeys.has(key)) throw new Error(`reinforcements: duplicate ${key}`)
		reinforcementKeys.add(key)
		if (!cardIds.has(row.card_id)) throw new Error(`reinforcements: unknown card ${row.card_id}`)
		if (!Number.isInteger(row.sequence) || row.sequence < 1) throw new Error(`reinforcements ${key}: invalid sequence`)
		if (!["map", "replace", "reserve"].includes(row.kind)) throw new Error(`reinforcements ${key}: invalid kind ${row.kind}`)
		if (!cardSequences.has(row.card_id)) cardSequences.set(row.card_id, [])
		cardSequences.get(row.card_id).push(row.sequence)
		if (row.kind === "map" || row.kind === "replace") {
			if (!pieceIds.has(row.piece_id)) throw new Error(`reinforcements ${key}: unknown piece ${row.piece_id}`)
			const placements = row.kind === "replace" ? ["front_upgrade"] : ["standard", "lcu_style", "desert", "western"]
			if (!placements.includes(row.placement)) throw new Error(`reinforcements ${key}: invalid placement ${row.placement}`)
			if (!row.label_zh) throw new Error(`reinforcements ${key}: missing label_zh`)
		} else {
			if (!row.nation || !Number.isInteger(row.count) || row.count < 1) throw new Error(`reinforcements ${key}: reserve entry requires nation and positive count`)
		}
	}
	for (const [cardId, sequences] of cardSequences) {
		sequences.sort((a, b) => a - b)
		for (let index = 0; index < sequences.length; index++) if (sequences[index] !== index + 1) throw new Error(`reinforcements card ${cardId}: sequence must be contiguous`)
	}
	const boardIds = new Set()
	const boardPieceIds = new Set()
	const boardCardIds = new Set()
	const tokenKinds = new Set(["german_trench", "atlantic_wall_trench"])
	for (const row of [...tables.reinforcement_board.slots, ...tables.reinforcement_board.tokens, ...tables.reinforcement_board.card_areas]) {
		if (!row.id || boardIds.has(row.id)) throw new Error(`reinforcement_board: missing or duplicate id ${row.id || ""}`)
		boardIds.add(row.id)
		if (!["piece", "token", "card"].includes(row.kind)) throw new Error(`reinforcement_board ${row.id}: invalid kind ${row.kind}`)
		if (!Array.isArray(row.card_ids) || row.card_ids.length === 0 || row.card_ids.some((cardId) => !cardIds.has(cardId))) throw new Error(`reinforcement_board ${row.id}: invalid card_ids`)
		for (const cardId of row.card_ids) boardCardIds.add(cardId)
		for (const field of ["x", "y", "w", "h"]) if (!Number.isFinite(row[field])) throw new Error(`reinforcement_board ${row.id}: missing ${field}`)
		const outside =
			row.kind === "card"
				? row.w <= 0 || row.h <= 0 || row.x < 0 || row.y < 0 || row.x + row.w > REINFORCEMENT_BOARD_WIDTH || row.y + row.h > REINFORCEMENT_BOARD_HEIGHT
				: row.w <= 0 || row.h <= 0 || row.x - row.w / 2 < 0 || row.y - row.h / 2 < 0 || row.x + row.w / 2 > REINFORCEMENT_BOARD_WIDTH || row.y + row.h / 2 > REINFORCEMENT_BOARD_HEIGHT
		if (outside)
			throw new Error(`reinforcement_board ${row.id}: rectangle is outside ${REINFORCEMENT_BOARD_WIDTH}x${REINFORCEMENT_BOARD_HEIGHT} board`)
		if (row.kind === "piece") {
			if (!pieceIds.has(row.piece_id) || boardPieceIds.has(row.piece_id)) throw new Error(`reinforcement_board ${row.id}: unknown or duplicate piece ${row.piece_id}`)
			boardPieceIds.add(row.piece_id)
		} else if (row.piece_id !== undefined) {
			throw new Error(`reinforcement_board ${row.id}: only piece rows may set piece_id`)
		}
		if (row.kind === "token" && !tokenKinds.has(row.token)) throw new Error(`reinforcement_board ${row.id}: invalid token ${row.token}`)
		if (row.kind === "card" && row.token !== undefined) throw new Error(`reinforcement_board ${row.id}: card rows may not set token`)
	}
	const chartCards = new Set([...Object.keys(tables.reinforcements).map(Number), 1, 16, 21, 33, 34, 42, 45, 46, 50, 52, 62, 77, 78, 93, 94, 109])
	for (const cardId of chartCards) if (!boardCardIds.has(cardId)) throw new Error(`reinforcement_board: missing printed card ${cardId}`)
	const availablePieceIds = new Set(tables.setup.filter((row) => row.location === "available").map((row) => row.piece_id))
	for (const pieceId of boardPieceIds) if (!availablePieceIds.has(pieceId)) throw new Error(`reinforcement_board: piece ${pieceId} is not available at setup`)
	const expectedOffBoardPool = [578, 579, 580, 581]
	const unmappedAvailable = [...availablePieceIds].filter((pieceId) => !boardPieceIds.has(pieceId)).sort((a, b) => a - b)
	if (JSON.stringify(unmappedAvailable) !== JSON.stringify(expectedOffBoardPool)) throw new Error(`reinforcement_board: unexpected unmapped available pieces ${unmappedAvailable.join(",")}`)
}

function indexed(rows) {
	const result = [null]
	for (const row of rows) result[row.id] = row
	return result
}

function build() {
	const source = loadTables()
	const review = loadReviewTables()
	const warnings = []
	const tables = {
		cards: deriveCards(source.cards),
		spaces: deriveSpaces(source.spaces, review.spaces),
		edges: deriveEdges(source.edges, review.edges),
		pieces: derivePieces(source.pieces, review.pieces),
		setup: deriveSetup(source.setup, review.setup),
		reinforcement_rows: source.reinforcements,
		reinforcements: deriveReinforcements(source.reinforcements),
		reinforcement_board: deriveReinforcementBoard(source.reinforcement_board),
	}
	tables.reinforcement_catalog = deriveReinforcementCatalog(tables.reinforcements, tables.cards, tables.pieces)
	validateCards(tables.cards, warnings)
	validateSpaces(tables.spaces)
	validateEdges(tables.edges, new Set(tables.spaces.map((space) => space.id)))
	validatePieces(tables.pieces)
	validateReferences(tables)

	return {
		data: {
			meta: {
				title: "WWII: Barbarossa to Berlin",
				version: 1,
				map: { width: MAP_WIDTH, height: MAP_HEIGHT },
				sources: { cards: "rulebook_v1.3_card_list;english_card_face" },
			},
			cards: indexed(tables.cards),
			spaces: indexed(tables.spaces),
			edges: tables.edges,
			pieces: indexed(tables.pieces),
			setup: tables.setup,
			reinforcements: tables.reinforcements,
			reinforcement_catalog: tables.reinforcement_catalog,
			reinforcement_board: tables.reinforcement_board,
		},
		review,
		warnings,
	}
}

function serialize(data) {
	return `"use strict"\n\n// Generated by tools/build_data.js from reviewed csv/*.csv sources. Do not edit.\nconst data = ${JSON.stringify(data, null, "\t")}\n\nif (typeof module !== "undefined") module.exports = { data }\nif (typeof globalThis !== "undefined") globalThis.BTB_DATA = data\n`
}

function writeGeneratedFile(file, content) {
	if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return false
	const temporary = `${file}.${process.pid}.tmp`
	try {
		fs.writeFileSync(temporary, content, "utf8")
		fs.renameSync(temporary, file)
	} catch (error) {
		fs.rmSync(temporary, { force: true })
		throw error
	}
	return true
}

function main() {
	const { data, warnings } = build()
	for (const warning of warnings) console.warn(`warning: ${warning}`)
	if (!process.argv.includes("--check")) {
		const written = writeGeneratedFile(OUTPUT_FILE, serialize(data))
		console.log(`${written ? "Generated" : "Unchanged"} ${OUTPUT_FILE}`)
	}
	console.log(`Validated cards=${data.cards.filter(Boolean).length}, spaces=${data.spaces.filter(Boolean).length}, ` + `edges=${data.edges.length}, pieces=${data.pieces.filter(Boolean).length}`)
}

if (require.main === module) main()

module.exports = {
	build,
	serialize,
	writeGeneratedFile,
	loadTables,
	loadReviewTables,
	normalizeRow,
	validateSpaces,
	validateEdges,
	deriveCards,
	deriveSpaces,
	derivePieces,
	deriveReinforcementCatalog,
	deriveReinforcements,
	reducedAsset,
	NATION_SIDES,
	MAP_WIDTH,
	MAP_HEIGHT,
}
