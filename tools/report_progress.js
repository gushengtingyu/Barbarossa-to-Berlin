"use strict"

const { build } = require("./build_data.js")

function hasFlag(row, flag) {
	return String(row.flags || "")
		.split(";")
		.includes(flag)
}

function makeReport() {
	const { data, review, warnings } = build()
	const cards = data.cards.filter(Boolean)
	const spaces = data.spaces.filter(Boolean)
	const pieces = data.pieces.filter(Boolean)
	const reinforcements = Object.values(data.reinforcements || {}).flatMap((spec) => [...spec.units, ...(spec.reserves || [])])
	const placeholderCards = cards.filter((card) => /^(Allied|Axis) \d{2}$/.test(card.name)).length
	const pendingSpaces = review.spaces.filter((space) => hasFlag(space, "needs_review")).length
	const pendingEdges = review.edges.filter((edge) => hasFlag(edge, "needs_review")).length
	return {
		cards: {
			total: cards.length,
			complete: cards.length - placeholderCards,
			pending: placeholderCards,
		},
		spaces: {
			total: spaces.length,
			reviewed: spaces.length - pendingSpaces,
			pending: pendingSpaces,
		},
		edges: {
			total: data.edges.length,
			reviewed: data.edges.length - pendingEdges,
			pending: pendingEdges,
		},
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
	console.log(`地图空间复核   ${report.spaces.reviewed}/${report.spaces.total}（待复核 ${report.spaces.pending}）`)
	console.log(`地图连接复核   ${report.edges.reviewed}/${report.edges.total}（待复核 ${report.edges.pending}）`)
	console.log(`棋子 / 部署    ${report.pieces.total} / ${report.setup.total}`)
	console.log(`增援条目       ${report.reinforcements.total}`)
}

if (require.main === module) main()

module.exports = { makeReport }
