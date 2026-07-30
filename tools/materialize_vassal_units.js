"use strict"

const fs = require("node:fs")

const path = require("node:path")
const { data } = require("../data.js")
const { stringify } = require("./csv.js")
const { buildDraft } = require("./import_vassal.js")
const catalog = require("./unit_catalog.js")

const ROOT = path.resolve(__dirname, "..")
const PIECES_FILE = path.join(ROOT, "csv", "pieces.csv")
const SETUP_FILE = path.join(ROOT, "csv", "setup_campaign.csv")
const PIECE_HEADERS = ["id", "nation", "name", "size", "unit_type", "cf", "lf", "mf", "rcf", "rlf", "rmf", "asset", "traits", "reduced_asset"]
const SETUP_HEADERS = ["piece_id", "space_id", "location", "reduced"]

function normalizeName(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "")
}

function imagePair(piece) {
	const full = piece.images.find((name) => !/-b\.(?:jpg|png|gif)$/i.test(name)) || piece.image_current
	const reduced = piece.images.find((name) => /-b\.(?:jpg|png|gif)$/i.test(name)) || ""
	return { full, reduced }
}

function buildUnitTables() {
	const draft = buildDraft()
	const sourcePieces = draft.piece_slots.filter((piece) => piece.size !== "marker" || piece.entry_name === "Stalin")
	const pieces = sourcePieces.map((piece) => {
		const sourceImages = imagePair(piece)
		const images = piece.gpid === 140 ? { full: "SU_SW Mech.jpg", reduced: "SU_SW.jpg" } : sourceImages
		const values = piece.entry_name === "Stalin" ? {} : catalog.get(images.full)
		if (piece.entry_name !== "Stalin" && !values) throw new Error(`missing reviewed counter values for ${images.full}`)
		return {
			id: piece.gpid,
			nation: piece.nation || (piece.entry_name === "Stalin" ? "su" : ""),
			name: piece.entry_name,
			size: piece.size,
			unit_type: piece.unit_type,
			...(values || {}),
			asset: images.full,
			traits: values?.non_replaceable ? "non_replaceable" : "",
			reduced_asset: piece.gpid === 140 ? images.reduced : "",
		}
	})
	pieces.push({
		id: 997,
		nation: "su",
		name: "SU Southwest Front (Infantry)",
		size: "lcu",
		unit_type: "army",
		...catalog.get("SU_SW.jpg"),
		asset: "SU_SW.jpg",
		traits: "",
		reduced_asset: "",
	})
	const runtimePieceIds = new Set(pieces.filter((piece) => piece.size !== "marker").map((piece) => piece.id))
	const aliases = new Map([
		["hellfirepass", "helltirepass"],
		["palmero", "palermo"],
	])
	const spacesByName = new Map(data.spaces.filter(Boolean).map((space) => [normalizeName(space.name), space.id]))
	const setup = []
	for (const source of draft.setup) {
		if (!runtimePieceIds.has(source.gpid)) continue
		const normalized = aliases.get(normalizeName(source.location)) || normalizeName(source.location)
		const spaceId = normalized === "homs" ? 191 : spacesByName.get(normalized)
		let location = ""
		if (!spaceId) {
			if (/reserve/i.test(source.location)) location = `reserve:${source.side}`
			else if (source.location === "Anywhere in Turkey") location = "setup_choice:turkey"
			else if (source.location === "Occupied France") location = "setup_choice:occupied_france"
			else location = "available"
		}
		setup.push({
			piece_id: source.gpid,
			space_id: spaceId || "",
			location,
			reduced: source.reduced,
		})
	}
	return { pieces, setup }
}

function main() {
	const tables = buildUnitTables()
	if (!process.argv.includes("--write")) {
		console.log(`Validated pieces=${tables.pieces.length}, setup=${tables.setup.length}; pass --write to update CSV sources`)
		return
	}
	const existing = fs.readFileSync(PIECES_FILE, "utf8").trim().split(/\r?\n/).length - 1
	if (existing > 0 && !process.argv.includes("--force")) throw new Error("pieces.csv is not empty; pass --force to replace generated unit data")
	fs.writeFileSync(PIECES_FILE, stringify(PIECE_HEADERS, tables.pieces), "utf8")
	fs.writeFileSync(SETUP_FILE, stringify(SETUP_HEADERS, tables.setup), "utf8")
	console.log(`Updated pieces=${tables.pieces.length}, setup=${tables.setup.length}`)
}

if (require.main === module) main()

module.exports = { buildUnitTables, imagePair, normalizeName }
