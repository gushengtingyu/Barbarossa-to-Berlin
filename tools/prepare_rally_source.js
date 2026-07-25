"use strict"

const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

const ROOT = path.resolve(__dirname, "..")
const RUNTIME_MANIFEST = path.join(ROOT, "rally-assets.json")
const COVER_MANIFEST = path.join(ROOT, "cover-assets.json")
const COVER_VARIANTS = ["cover.1x.jpg", "cover.2x.jpg", "thumbnail.jpg"]

function readRuntimeManifest() {
	let manifest
	try {
		manifest = JSON.parse(fs.readFileSync(RUNTIME_MANIFEST, "utf8"))
	} catch {
		throw new Error("missing or invalid rally-assets.json")
	}
	for (const field of ["files", "directories"])
		if (!Array.isArray(manifest[field]) || manifest[field].some((entry) => typeof entry !== "string" || !entry || path.isAbsolute(entry) || entry.split(/[\\/]/).includes("..")))
			throw new Error(`rally-assets.json ${field} must contain safe relative paths`)
	const entries = [...manifest.files, ...manifest.directories]
	if (new Set(entries).size !== entries.length) throw new Error("rally-assets.json contains duplicate entries")
	return Object.freeze({
		files: Object.freeze(manifest.files.slice()),
		directories: Object.freeze(manifest.directories.slice()),
	})
}

function sha256(file) {
	return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function validateCoverAssets() {
	if (!fs.existsSync(COVER_MANIFEST)) throw new Error("missing cover-assets.json; run npm run assets:cover")
	let manifest
	try {
		manifest = JSON.parse(fs.readFileSync(COVER_MANIFEST, "utf8"))
	} catch {
		throw new Error("invalid cover-assets.json; run npm run assets:cover")
	}
	const expected = [
		{ ...(manifest.source || {}), file: "cover.png" },
		...COVER_VARIANTS.map((file) => ({
			...((manifest.variants || {})[file] || {}),
			file,
		})),
	]
	for (const asset of expected) {
		const file = asset && asset.file
		const source = file && path.join(ROOT, file)
		if (!file || !asset.sha256 || !fs.existsSync(source) || sha256(source) !== asset.sha256) throw new Error(`cover assets are out of date; run npm run assets:cover`)
	}
}

function prepareRallySource() {
	const manifest = readRuntimeManifest()
	for (const relative of manifest.files) {
		const asset = path.join(ROOT, relative)
		if (!fs.existsSync(asset) || !fs.statSync(asset).isFile()) throw new Error(`missing Rally runtime file: ${relative}`)
	}
	for (const relative of manifest.directories) {
		const asset = path.join(ROOT, relative)
		if (!fs.existsSync(asset) || !fs.statSync(asset).isDirectory()) throw new Error(`missing Rally runtime directory: ${relative}`)
	}
	validateCoverAssets()
	return ROOT
}

if (require.main === module) console.log(`Rally source ready: ${prepareRallySource()}`)

module.exports = { prepareRallySource, readRuntimeManifest, ROOT }
