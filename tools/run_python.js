"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const scriptArgs = process.argv.slice(2)
if (scriptArgs.length === 0) throw new Error("Usage: node tools/run_python.js <script.py> [args]")

const ROOT = path.resolve(__dirname, "..")
const projectPython = path.join(ROOT, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")

const candidates = []
if (process.env.PYTHON) candidates.push([process.env.PYTHON, []])
if (fs.existsSync(projectPython)) candidates.push([projectPython, []])
candidates.push(["python3", []], ["python", []])
if (process.platform === "win32") candidates.push(["py", ["-3"]])

for (const [command, prefix] of candidates) {
	const probe = spawnSync(command, [...prefix, "--version"], {
		stdio: "ignore",
	})
	if (probe.error || probe.status !== 0) continue
	const result = spawnSync(command, [...prefix, ...scriptArgs], {
		stdio: "inherit",
	})
	if (result.error) throw result.error
	process.exit(result.status === null ? 1 : result.status)
}

throw new Error("Python 3 was not found. Run `npm run python:sync` or set PYTHON to a compatible interpreter.")
