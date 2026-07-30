"use strict"

function parse(text) {
	text = String(text || "").replace(/^\uFEFF/, "")
	const records = []
	let record = []
	let field = ""
	let quoted = false

	for (let i = 0; i < text.length; i++) {
		const ch = text[i]
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') {
				field += '"'
				i++
			} else if (ch === '"') {
				quoted = false
			} else {
				field += ch
			}
		} else if (ch === '"') {
			quoted = true
		} else if (ch === ",") {
			record.push(field)
			field = ""
		} else if (ch === "\n") {
			record.push(field.replace(/\r$/, ""))
			if (record.some((value) => value.trim() !== "")) records.push(record)
			record = []
			field = ""
		} else {
			field += ch
		}
	}

	if (quoted) throw new Error("CSV ended inside a quoted field")
	if (field.length || record.length) {
		record.push(field.replace(/\r$/, ""))
		if (record.some((value) => value.trim() !== "")) records.push(record)
	}
	if (records.length === 0) return []

	const headers = records.shift().map((value) => value.trim())
	return records.map((values, rowIndex) => {
		if (values.length > headers.length) throw new Error(`CSV row ${rowIndex + 2} has ${values.length} values for ${headers.length} headers`)
		const row = {}
		for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i] === undefined ? "" : values[i].trim()
		return row
	})
}

function escapeCsv(value) {
	value = value === null || value === undefined ? "" : String(value)
	if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
	return value
}

function stringify(headers, rows, { trimTrailingEmpty = false, minimumColumns = 0 } = {}) {
	const lines = [headers.map(escapeCsv).join(",")]
	for (const row of rows) {
		const values = headers.map((header) => row[header])
		if (trimTrailingEmpty) {
			while (values.length > minimumColumns && (values.at(-1) === "" || values.at(-1) === null || values.at(-1) === undefined)) values.pop()
		}
		lines.push(values.map(escapeCsv).join(","))
	}
	return `${lines.join("\n")}\n`
}

module.exports = { parse, stringify }
