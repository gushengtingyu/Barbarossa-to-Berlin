"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { parse, stringify } = require("./csv.js")

const ROOT = path.resolve(__dirname, "..")
const FILE = path.join(ROOT, "csv", "cards.csv")
const HEADERS = ["id", "side", "num", "ops", "remove", "cc", "dual", "dual_condition", "rp_ge", "rp_axis", "rp_br", "rp_usa", "rp_su", "name"]

const ALLIED_NAMES = [
	"Torch",
	"Soviet Reinforcements",
	"Stavka",
	"Soviet Reinforcements",
	"British Reinforcements",
	"FDR Declares War",
	"Industrial Evacuation",
	"Fortified Boxes",
	"US Build-Up",
	"NKVD Boosts Morale",
	"Sorge",
	"Bomber Command",
	"Siberians",
	"Lend-Lease",
	"Casablanca",
	"Sledgehammer",
	"Zhukov",
	"T-34",
	"Partisans",
	"Paradrop",
	"British Reinforcement",
	"Operation Uranus",
	"Clearing the Scheldt",
	"Soviet Reinforcements",
	"Enigma",
	"British Reinforcements",
	"Italy Defects",
	"US 8th Air Force",
	"Romania Defects",
	"Bulgaria Defects",
	"Soviet Reinforcements",
	"IX Tac-Air",
	"Overlord",
	"Husky",
	"Bagration",
	"ASW Victory",
	"Soviet Reinforcements",
	"US Reinforcements",
	"Soviet Reinforcements",
	"US Reinforcements",
	"US Reinforcements",
	"Tito",
	"Operation Strangle",
	"Thunderclap",
	"Avalanche",
	"Shingle",
	"The Big Three",
	"Bomb Plot",
	"Maquis",
	"Round-Up",
	"Yalta",
	"Anvil-Dragoon",
	"P-51 Mustang",
	"Finland Withdraws",
	"Patton",
]

const AXIS_NAMES = [
	"Barbarossa",
	"Von Paulus Pause",
	"OKH Conference",
	"Taifun",
	"Panzergruppe Guderian",
	"Panzer Refit",
	"Hedgehogs",
	"Hitler Declares War",
	"Hitler Takes Command",
	"Desert Fox",
	"Italian Naval Sortie",
	"Nordlicht",
	"Krim",
	"Fall Blau",
	"Wolfpacks",
	"Speer",
	"Banzai!",
	"Devil's Gardens",
	"Luftwaffe Supply",
	"Kammhuber Line",
	"Herkules",
	"German Reinforcements",
	"Axis Satellites",
	"German Reinforcements",
	"Stuka",
	"Totaler Krieg!",
	"Fall Zitadelle",
	"Skorzeny",
	"FW-190",
	"Kesselring",
	"Achse",
	"German Reinforcements",
	"German Reinforcements",
	"German Reinforcements",
	"German Reinforcements",
	"German Reinforcements",
	"German Reinforcements",
	"Atlantic Wall",
	"East Wall",
	"Anti-Partisan Sweep",
	"Panther",
	"Tiger",
	"Panzerfaust",
	"Volkssturm",
	"Vergeltungs-Waffe",
	"Manstein",
	"Model",
	"Heinrici",
	"Weichs",
	"Foreign Armies East",
	"Anti-Partisan Sweep",
	"Final Production Surge",
	"Wacht am Rhein",
	"The Bunker",
	"National Redoubt",
]

const ALLIED_OPS = [4, 4, 2, 4, 4, 4, 5, 2, 4, 2, 3, 3, 3, 5, 3, 5, 2, 2, 3, 2, 4, 5, 4, 3, 5, 5, 2, 2, 3, 2, 4, 5, 5, 5, 5, 3, 4, 3, 5, 3, 3, 3, 3, 2, 4, 3, 2, 2, 2, 4, 2, 4, 4, 2, 5]
const AXIS_OPS = [5, 4, 2, 4, 4, 4, 5, 2, 4, 2, 3, 3, 3, 5, 3, 5, 2, 2, 3, 2, 5, 4, 4, 3, 4, 5, 3, 2, 2, 2, 4, 5, 5, 5, 5, 5, 4, 3, 5, 3, 3, 3, 3, 2, 4, 3, 2, 2, 2, 4, 2, 4, 4, 2, 3]

// Transcribed from the printed RP boxes on images/A01-A55 and images/X01-X55.
const ALLIED_RP = [
	[2, 2, 4],
	[2, 2, 4],
	[1, 1, 2],
	[2, 2, 4],
	[2, 2, 4],
	[2, 2, 4],
	[2, 3, 6],
	[1, 1, 2],
	[2, 2, 4],
	[1, 1, 2],
	[1, 2, 3],
	[1, 2, 3],
	[1, 2, 3],
	[2, 3, 6],
	[1, 2, 3],
	[2, 3, 6],
	[1, 1, 2],
	[1, 1, 2],
	[1, 2, 3],
	[1, 1, 2],
	[2, 2, 4],
	[2, 3, 6],
	[2, 2, 4],
	[1, 2, 3],
	[2, 3, 6],
	[2, 3, 6],
	[1, 1, 2],
	[1, 1, 2],
	[1, 2, 3],
	[1, 1, 2],
	[2, 2, 4],
	[2, 3, 6],
	[2, 3, 6],
	[2, 3, 6],
	[2, 3, 6],
	[1, 2, 3],
	[2, 2, 4],
	[1, 2, 3],
	[2, 3, 6],
	[1, 2, 3],
	[1, 2, 3],
	[1, 2, 3],
	[1, 2, 3],
	[1, 1, 2],
	[2, 2, 4],
	[1, 2, 3],
	[1, 1, 2],
	[1, 1, 2],
	[1, 1, 2],
	[2, 2, 4],
	[1, 1, 2],
	[2, 2, 4],
	[2, 2, 4],
	[1, 1, 2],
	[2, 3, 6],
]
const AXIS_RP = [
	[4, 2],
	[3, 1],
	[2, 0],
	[3, 1],
	[3, 1],
	[3, 1],
	[4, 2],
	[2, 0],
	[3, 1],
	[2, 0],
	[2, 1],
	[2, 1],
	[2, 1],
	[4, 2],
	[2, 1],
	[4, 2],
	[2, 0],
	[2, 0],
	[2, 1],
	[2, 0],
	[4, 2],
	[3, 1],
	[3, 1],
	[2, 1],
	[3, 1],
	[4, 2],
	[2, 1],
	[2, 0],
	[2, 0],
	[2, 0],
	[3, 1],
	[4, 2],
	[4, 2],
	[4, 2],
	[4, 2],
	[4, 2],
	[3, 1],
	[2, 1],
	[4, 2],
	[2, 1],
	[2, 1],
	[2, 1],
	[2, 1],
	[2, 0],
	[3, 1],
	[2, 1],
	[2, 0],
	[2, 0],
	[2, 0],
	[3, 1],
	[2, 0],
	[3, 1],
	[3, 1],
	[2, 0],
	[2, 1],
]

const SETS = {
	allied: {
		remove: new Set([1, 2, 4, 5, 6, 7, 9, 11, 13, 14, 15, 16, 19, 21, 22, 23, 24, 26, 27, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54]),
		cc: new Set([8, 10, 17, 18, 20]),
		dual: new Set([15, 22, 25, 29, 30, 31, 32, 35, 37, 39, 47, 51, 55]),
		conditional: new Set([3, 7, 13]),
	},
	axis: {
		remove: new Set([1, 2, 3, 4, 6, 7, 8, 9, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 39, 43, 44, 45, 46, 49, 50, 52, 53, 54, 55]),
		cc: new Set([10, 18, 30, 41, 42, 43, 44, 47, 48, 49]),
		dual: new Set([3, 5, 6, 12, 13, 19, 25, 28, 31, 46, 50, 53]),
		conditional: new Set(),
	},
}

function catalog() {
	const result = []
	for (const [side, names, ops, rp] of [
		["allied", ALLIED_NAMES, ALLIED_OPS, ALLIED_RP],
		["axis", AXIS_NAMES, AXIS_OPS, AXIS_RP],
	]) {
		if (names.length !== 55 || ops.length !== 55 || rp.length !== 55) throw new Error(`${side} catalog must contain 55 cards`)
		for (let index = 0; index < 55; index++) {
			const num = index + 1
			const replacement =
				side === "allied"
					? {
							rp_br: rp[index][0],
							rp_usa: rp[index][1],
							rp_su: rp[index][2],
							rp_ge: "",
							rp_axis: "",
						}
					: {
							rp_ge: rp[index][0],
							rp_axis: rp[index][1],
							rp_br: "",
							rp_usa: "",
							rp_su: "",
						}
			result.push({
				id: side === "allied" ? num : 55 + num,
				side,
				num,
				ops: ops[index],
				remove: SETS[side].remove.has(num),
				cc: SETS[side].cc.has(num),
				dual: SETS[side].dual.has(num),
				dual_condition: SETS[side].conditional.has(num) ? "stalin_in_moscow" : "",
				name: names[index],
				...replacement,
			})
		}
	}
	return result
}

function merge(rows) {
	const metadata = new Map(catalog().map((card) => [`${card.side}:${card.num}`, card]))
	return rows.map((row) => {
		const card = metadata.get(`${row.side}:${row.num}`)
		if (!card) throw new Error(`missing rulebook metadata for ${row.side}:${row.num}`)
		return { ...row, ...card }
	})
}

function main() {
	const rows = parse(fs.readFileSync(FILE, "utf8"))
	const merged = merge(rows)
	if (!process.argv.includes("--write")) {
		console.log(`Validated rulebook metadata for ${merged.length} cards; pass --write to update cards.csv`)
		return
	}
	fs.writeFileSync(FILE, stringify(HEADERS, merged), "utf8")
	console.log(`Updated ${FILE} with ${merged.length} rulebook card-list records`)
}

if (require.main === module) main()

module.exports = {
	ALLIED_NAMES,
	ALLIED_OPS,
	ALLIED_RP,
	AXIS_NAMES,
	AXIS_OPS,
	AXIS_RP,
	catalog,
	merge,
}
