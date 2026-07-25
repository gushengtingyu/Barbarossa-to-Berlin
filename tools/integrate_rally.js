"use strict"

const fs = require("fs")
const path = require("path")
const { prepareRallySource } = require("./prepare_rally_source.js")

const ROOT = path.resolve(__dirname, "..")
const SERVER = path.resolve(ROOT, "..", "server")
const TITLE_ID = "barbarossa-to-berlin"
const TARGET = path.join(SERVER, "public", TITLE_ID)

function sameTarget(link, expected) {
	try {
		return path.resolve(fs.realpathSync(link)) === path.resolve(fs.realpathSync(expected))
	} catch {
		return false
	}
}

function ensureLink(source) {
	if (fs.existsSync(TARGET)) {
		const stat = fs.lstatSync(TARGET)
		if (!stat.isSymbolicLink()) throw new Error(`integration target exists and is not the BTB Rally link: ${TARGET}`)
		if (sameTarget(TARGET, source)) return "existing"
		fs.unlinkSync(TARGET)
	}
	fs.symlinkSync(source, TARGET, process.platform === "win32" ? "junction" : "dir")
	return "linked"
}

function registerTitle() {
	const Database = require(path.join(SERVER, "node_modules", "better-sqlite3"))
	const db = new Database(path.join(SERVER, "db"))
	try {
		db.prepare(
			`
			insert into titles (title_id, title_name, bgg, is_symmetric, is_hidden)
			values (?, ?, ?, 0, 0)
			on conflict(title_id) do update set
				title_name=excluded.title_name,
				bgg=excluded.bgg,
				is_symmetric=excluded.is_symmetric,
				is_hidden=excluded.is_hidden
		`,
		).run(TITLE_ID, "WWII: Barbarossa to Berlin", 3353)
		return db.prepare("select * from titles where title_id=?").get(TITLE_ID)
	} finally {
		db.close()
	}
}

function integrate() {
	if (!fs.existsSync(path.join(SERVER, "server.js")) || !fs.existsSync(path.join(SERVER, "db"))) throw new Error(`Rally server not found at ${SERVER}`)
	const source = prepareRallySource()
	const link = ensureLink(source)
	const title = registerTitle()
	console.log(JSON.stringify({ source, target: TARGET, link, title }, null, 2))
}

integrate()
