"use strict"

const http = require("node:http")
const fs = require("node:fs")
const path = require("node:path")
const { stringify } = require("./csv.js")
const { build, validateSpaces, validateEdges } = require("./build_data.js")

const ROOT = path.resolve(__dirname, "..")
const CSV_DIR = path.join(ROOT, "csv")
const HOST = "127.0.0.1"
const PORT = Number(process.env.PORT || 8082)
const SPACE_HEADERS = ["id", "name", "x", "y", "w", "h", "kind", "nation", "side", "terrain", "urban", "vp", "fort", "supply", "port", "resource", "capital", "wehrkreis", "attack_requires_event"]
const SPACE_REVIEW_HEADERS = ["id", "flags"]
const EDGE_HEADERS = ["a", "b", "type"]
const EDGE_REVIEW_HEADERS = ["a", "b", "rule", "flags"]

const MIME = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".csv": "text/csv; charset=utf-8",
}

function isLocal(req) {
	return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let body = ""
		req.on("data", (chunk) => {
			body += chunk
			if (body.length > 10_000_000) reject(new Error("Request body is too large"))
		})
		req.on("end", () => resolve(body))
		req.on("error", reject)
	})
}

function json(res, status, value) {
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
	})
	res.end(JSON.stringify(value))
}

function compact(row) {
	return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== "" && value !== undefined && value !== null))
}

function saveEditorData(payload) {
	if (!Array.isArray(payload.spaces) || !Array.isArray(payload.edges)) throw new Error("spaces and edges must be arrays")
	const spaces = payload.spaces.map((row) =>
		compact({
			...row,
			id: Number(row.id),
			x: Number(row.x),
			y: Number(row.y),
			w: Number(row.w),
			h: Number(row.h),
			...(row.vp === "" || row.vp === undefined ? {} : { vp: Number(row.vp) }),
		}),
	)
	const edges = payload.edges.map((row) => compact({ ...row, a: Number(row.a), b: Number(row.b) }))
	validateSpaces(spaces)
	validateEdges(edges, new Set(spaces.map((space) => space.id)))
	const tempSpaces = path.join(CSV_DIR, ".spaces.csv.tmp")
	const tempSpaceReview = path.join(CSV_DIR, "review", ".spaces.csv.tmp")
	const tempEdges = path.join(CSV_DIR, ".edges.csv.tmp")
	const tempEdgeReview = path.join(CSV_DIR, "review", ".edges.csv.tmp")
	fs.writeFileSync(
		tempSpaces,
		stringify(
			SPACE_HEADERS,
			spaces.map((row) => ({
				...row,
				attack_requires_event: row.attack_card,
			})),
		),
		"utf8",
	)
	fs.writeFileSync(tempSpaceReview, stringify(SPACE_REVIEW_HEADERS, spaces), "utf8")
	fs.writeFileSync(tempEdges, stringify(EDGE_HEADERS, edges), "utf8")
	fs.writeFileSync(tempEdgeReview, stringify(EDGE_REVIEW_HEADERS, edges), "utf8")
	fs.renameSync(tempSpaces, path.join(CSV_DIR, "spaces.csv"))
	fs.renameSync(tempSpaceReview, path.join(CSV_DIR, "review", "spaces.csv"))
	fs.renameSync(tempEdges, path.join(CSV_DIR, "edges.csv"))
	fs.renameSync(tempEdgeReview, path.join(CSV_DIR, "review", "edges.csv"))
}

function staticPath(url) {
	const pathname = decodeURIComponent(new URL(url, `http://${HOST}`).pathname)
	const requested = pathname === "/" ? "/tools/map_editor.html" : pathname
	const result = path.resolve(ROOT, `.${requested}`)
	if (result !== ROOT && !result.startsWith(`${ROOT}${path.sep}`)) return null
	return result
}

const server = http.createServer(async (req, res) => {
	try {
		if (!isLocal(req)) return json(res, 403, { error: "Local access only" })
		if (req.method === "GET" && req.url === "/api/editor-data") {
			const { data, review } = build()
			const spaceReview = new Map(review.spaces.map((row) => [row.id, row]))
			const edgeReview = new Map(review.edges.map((row) => [row.a < row.b ? `${row.a}:${row.b}` : `${row.b}:${row.a}`, row]))
			const spaces = data.spaces.filter(Boolean).map((space) => ({
				...space,
				...(space.attack_requires_event ? { attack_card: space.attack_requires_event } : {}),
				flags: spaceReview.get(space.id)?.flags || "",
			}))
			const edges = data.edges.map((edge) => {
				const key = edge.a < edge.b ? `${edge.a}:${edge.b}` : `${edge.b}:${edge.a}`
				const audit = edgeReview.get(key)
				return {
					...edge,
					rule: audit?.rule || "",
					flags: audit?.flags || "",
				}
			})
			return json(res, 200, { spaces, edges })
		}
		if (req.method === "POST" && req.url === "/api/editor-data") {
			const payload = JSON.parse(await readBody(req))
			saveEditorData(payload)
			return json(res, 200, {
				ok: true,
				spaces: payload.spaces.length,
				edges: payload.edges.length,
			})
		}
		if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" })

		const file = staticPath(req.url)
		if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return json(res, 404, { error: "Not found" })
		res.writeHead(200, {
			"Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
		})
		fs.createReadStream(file).pipe(res)
	} catch (error) {
		console.error(error)
		json(res, 500, { error: error.message })
	}
})

server.listen(PORT, HOST, () => {
	console.log(`BTB map editor: http://${HOST}:${PORT}/tools/map_editor.html`)
})
