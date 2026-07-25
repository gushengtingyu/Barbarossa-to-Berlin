"use strict"

const fs = require("node:fs")
const path = require("node:path")

const ROOT = path.resolve(__dirname, "..")
const DEFAULT_SOURCE = path.join(ROOT, "assets", "source", "vassal", "buildFile")
const DEFAULT_OUTPUT = path.join(ROOT, "outputs", "vassal-draft.json")

function decodeXml(value) {
	return String(value || "")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
}

function attributes(source) {
	const result = {}
	for (const match of source.matchAll(/([\w:.-]+)="([^"]*)"/g)) result[match[1]] = decodeXml(match[2])
	return result
}

function unique(values) {
	return [...new Set(values)]
}

function extractImages(source) {
	return unique([...source.matchAll(/([A-Za-z0-9_ &'().+-]+\.(?:jpg|png|gif))/gi)].map((match) => match[1].trim()))
}

function inferPiece(entryName, source) {
	const images = extractImages(source)
	const currentImage = source.match(/piece;;;([^;]+\.(?:jpg|png|gif));/i)?.[1] || images.at(-1) || ""
	const prototype = source.match(/prototype;([AX]_(?:LCU|SCU))/)?.[1] || ""
	const nation = currentImage.match(/^([A-Z]{2})_/)?.[1]?.toLowerCase() || ""
	let side = prototype.startsWith("A_") ? "allied" : prototype.startsWith("X_") ? "axis" : "neutral"
	let size = prototype.endsWith("LCU") ? "lcu" : prototype.endsWith("SCU") ? "scu" : "marker"
	if (["sw", "tu"].includes(nation)) side = "neutral"
	if (entryName === "Stalin") size = "marker"
	const lowered = `${entryName} ${currentImage}`.toLowerCase()
	const unitType = /pz|panzer|mech|armor/.test(lowered) ? "mechanized" : size === "lcu" ? "army" : size === "scu" ? "corps" : "marker"
	return {
		entry_name: entryName,
		side,
		nation,
		size,
		unit_type: unitType,
		image_current: currentImage,
		images,
		reduced: /-b\.(?:jpg|png|gif)$/i.test(currentImage),
		flags: ["vassal_import", "needs_review"],
	}
}

function parsePieceSlots(xml) {
	const result = []
	const pattern = /<VASSAL\.build\.widget\.PieceSlot\b([^>]*)>([\s\S]*?)<\/VASSAL\.build\.widget\.PieceSlot>/g
	for (const match of xml.matchAll(pattern)) {
		const attr = attributes(match[1])
		result.push({
			gpid: Number(attr.gpid),
			...inferPiece(attr.entryName, decodeXml(match[2])),
		})
	}
	return result
}

function parseSetupStacks(xml) {
	const result = []
	const stackPattern = /<VASSAL\.build\.module\.map\.SetupStack\b([^>]*)>([\s\S]*?)<\/VASSAL\.build\.module\.map\.SetupStack>/g
	const piecePattern = /<VASSAL\.build\.widget\.PieceSlot\b([^>]*)>([\s\S]*?)<\/VASSAL\.build\.widget\.PieceSlot>/g
	for (const stackMatch of xml.matchAll(stackPattern)) {
		const stack = attributes(stackMatch[1])
		for (const pieceMatch of stackMatch[2].matchAll(piecePattern)) {
			const piece = attributes(pieceMatch[1])
			result.push({
				scenario: "Campaign",
				gpid: Number(piece.gpid),
				location: stack.location || stack.name,
				x: Number(stack.x),
				y: Number(stack.y),
				...inferPiece(piece.entryName, decodeXml(pieceMatch[2])),
			})
		}
	}
	return result
}

function parseMapRegions(xml) {
	const result = []
	const pattern = /<VASSAL\.build\.module\.map\.boardPicker\.board\.mapgrid\.Zone\b([^>]*)\/?\s*>/g
	for (const match of xml.matchAll(pattern)) {
		const attr = attributes(match[1])
		result.push({
			name: attr.name,
			path: attr.path,
			flags: ["vassal_import", "needs_review"],
		})
	}
	return result
}

function buildDraft(sourceFile = DEFAULT_SOURCE) {
	const xml = fs.readFileSync(sourceFile, "utf8")
	const pieceSlots = parsePieceSlots(xml)
	const setup = parseSetupStacks(xml)
	const mapRegions = parseMapRegions(xml)
	return {
		meta: {
			source: path.basename(sourceFile),
			policy: "Draft only. The v1.3 rulebook, clarifications, card text, and map remain authoritative.",
			piece_slot_count: pieceSlots.length,
			setup_piece_count: setup.length,
			map_region_count: mapRegions.length,
		},
		piece_slots: pieceSlots,
		setup,
		map_regions: mapRegions,
	}
}

function main() {
	const sourceArg = process.argv.find((arg) => arg.startsWith("--source="))?.slice(9)
	const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9)
	const source = path.resolve(sourceArg || DEFAULT_SOURCE)
	const output = path.resolve(outputArg || DEFAULT_OUTPUT)
	const draft = buildDraft(source)
	if (process.argv.includes("--write")) {
		if (fs.existsSync(output) && !process.argv.includes("--force")) throw new Error(`${output} already exists; pass --force to replace the generated draft`)
		fs.mkdirSync(path.dirname(output), { recursive: true })
		fs.writeFileSync(output, `${JSON.stringify(draft, null, 2)}\n`, "utf8")
		console.log(`Wrote ${output}`)
	}
	console.log(`VASSAL draft: piece slots=${draft.meta.piece_slot_count}, setup pieces=${draft.meta.setup_piece_count}, map regions=${draft.meta.map_region_count}`)
}

if (require.main === module) main()

module.exports = {
	attributes,
	buildDraft,
	decodeXml,
	extractImages,
	inferPiece,
	parseMapRegions,
	parsePieceSlots,
	parseSetupStacks,
}
