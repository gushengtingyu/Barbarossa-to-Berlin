"use strict"

const { build } = require("./build_data.js")

function makeReport() {
	const { data, warnings } = build()
	const cards = data.cards.filter(Boolean)
	const spaces = data.spaces.filter(Boolean)
	const pieces = data.pieces.filter(Boolean)
	const reinforcements = Object.values(data.reinforcements || {}).flatMap((spec) => [...spec.units, ...(spec.reserves || [])])
	const placeholderCards = cards.filter((card) => /^(Allied|Axis) \d{2}$/.test(card.name)).length
	return {
		cards: {
			total: cards.length,
			complete: cards.length - placeholderCards,
			pending: placeholderCards,
		},
		spaces: { total: spaces.length },
		edges: { total: data.edges.length },
		pieces: { total: pieces.length },
		setup: { total: data.setup.length },
		reinforcements: { total: reinforcements.length },
		warnings,
	}
}

function main() {
	const report = makeReport()
	if (process.argv.includes("--json")) return console.log(JSON.stringify(report, null, 2))
	console.log("BTB 数据制作进度")
	console.log(`卡牌文字       ${report.cards.complete}/${report.cards.total}（待录入 ${report.cards.pending}）`)
	console.log(`地图空间       ${report.spaces.total}`)
	console.log(`地图连接       ${report.edges.total}`)
	console.log(`棋子 / 部署    ${report.pieces.total} / ${report.setup.total}`)
	console.log(`增援条目       ${report.reinforcements.total}`)
}

if (require.main === module) main()

module.exports = { makeReport }
