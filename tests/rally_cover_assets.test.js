"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const ROOT = path.resolve(__dirname, "..")

function sha256(file) {
	return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function jpegSize(file) {
	const data = fs.readFileSync(file)
	assert.equal(data.readUInt16BE(0), 0xffd8, `${path.basename(file)} must be a JPEG`)
	let offset = 2
	while (offset + 9 < data.length) {
		while (data[offset] === 0xff) ++offset
		const marker = data[offset++]
		if (marker === 0xd8 || marker === 0xd9) continue
		const length = data.readUInt16BE(offset)
		if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
			return {
				width: data.readUInt16BE(offset + 5),
				height: data.readUInt16BE(offset + 3),
			}
		}
		offset += length
	}
	throw new Error(`JPEG size marker not found in ${file}`)
}

test("Rally cover variants are synchronized with the canonical BTB cover", () => {
	const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "cover-assets.json"), "utf8"))
	assert.equal(manifest.source.file, "cover.png")
	assert.equal(manifest.source.sha256, sha256(path.join(ROOT, "cover.png")))

	const expected = {
		"cover.1x.jpg": { width: 150, height: 200 },
		"cover.2x.jpg": { width: 300, height: 400 },
		"thumbnail.jpg": { width: 108, height: 144 },
	}
	for (const [file, size] of Object.entries(expected)) {
		assert.deepEqual(jpegSize(path.join(ROOT, file)), size)
		assert.equal(manifest.variants[file].sha256, sha256(path.join(ROOT, file)))
		assert.equal(manifest.variants[file].width, size.width)
		assert.equal(manifest.variants[file].height, size.height)
	}
})
