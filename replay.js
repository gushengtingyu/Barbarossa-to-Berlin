"use strict"
;(function () {
	const moduleCache = new Map()
	const textEncoder = new TextEncoder()
	const textDecoder = new TextDecoder()

	function bytesToBase64(bytes) {
		let text = ""
		for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
		return btoa(text)
	}

	function base64ToBytes(text) {
		const binary = atob(text)
		const bytes = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i)
		return bytes
	}

	function makeBuffer(value, encoding) {
		let bytes
		if (typeof value === "string") {
			bytes = encoding === "base64" ? base64ToBytes(value) : textEncoder.encode(value)
		} else if (value instanceof ArrayBuffer) {
			bytes = new Uint8Array(value)
		} else if (ArrayBuffer.isView(value)) {
			bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		} else {
			bytes = new Uint8Array(value || [])
		}

		bytes.toString = function (format = "utf8") {
			if (format === "base64") return bytesToBase64(bytes)
			if (format === "utf8" || format === "utf-8") return textDecoder.decode(bytes)
			return Array.prototype.join.call(bytes, ",")
		}
		return bytes
	}

	function installBufferShim() {
		if (typeof window.Buffer === "undefined") window.Buffer = { from: makeBuffer }
	}

	const zlibShim = Object.freeze({
		deflateSync(input) {
			return makeBuffer(input)
		},
		inflateSync(input) {
			return makeBuffer(input)
		},
		deflateRawSync(input) {
			return makeBuffer(input)
		},
		inflateRawSync(input) {
			return makeBuffer(input)
		},
	})

	function normalizeModuleUrl(path, parentUrl) {
		if (path === "zlib" || path === "node:zlib") return "node:zlib"
		if (!path.endsWith(".js")) path += ".js"
		const base = parentUrl ? new URL(".", parentUrl) : new URL("./", window.location.href)
		return new URL(path, base).href
	}

	async function btbRequire(path, parentUrl = null) {
		const url = normalizeModuleUrl(path, parentUrl)
		if (url === "node:zlib") return zlibShim
		if (moduleCache.has(url)) return moduleCache.get(url).exports

		const module = { exports: {} }
		moduleCache.set(url, module)
		try {
			const response = await fetch(url)
			if (!response.ok) throw new Error(`Cannot load replay module ${path}: HTTP ${response.status} (${url})`)

			const source = await response.text()
			const dependencies = new Set()
			for (const match of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)) dependencies.add(match[1])
			for (const dependency of dependencies) await btbRequire(dependency, url)

			function localRequire(dependency) {
				const dependencyUrl = normalizeModuleUrl(dependency, url)
				if (dependencyUrl === "node:zlib") return zlibShim
				const dependencyModule = moduleCache.get(dependencyUrl)
				if (!dependencyModule) throw new Error(`Replay module ${dependency} was not preloaded from ${url}`)
				return dependencyModule.exports
			}

			Function("module", "exports", "require", source)(module, module.exports, localRequire)
			return module.exports
		} catch (error) {
			moduleCache.delete(url)
			throw error
		}
	}

	async function loadCommonReplay() {
		try {
			installBufferShim()
			window.__btb_replay_require = (path) => btbRequire(path)

			const response = await fetch("/common/replay.js")
			if (!response.ok) throw new Error(`Cannot load common replay script: HTTP ${response.status}`)

			const source = await response.text()
			let patched = source.replace(/async function require\(path\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction snap_from_state/, "async function require(path) {\n\treturn window.__btb_replay_require(path)\n}\n\nfunction snap_from_state")
			if (patched === source) throw new Error("Cannot patch common replay module loader")

			let debugPatchCount = 0
			patched = patched.replace(/^([ \t]*)s\.log\.push\((.*)\)[ \t]*\r?$/gm, (_match, indent, argumentsText) => {
				debugPatchCount += 1
				return `${indent}s = rules.replay_debug_log(s, ${argumentsText})`
			})
			const debugMode = globalThis.params?.mode === "debug" || new URL(window.location.href).searchParams.get("mode") === "debug"
			if (debugMode && (debugPatchCount !== 3 || patched.includes("s.log.push("))) throw new Error(`Cannot patch common replay debug logs: expected 3, patched ${debugPatchCount}`)

			const script = document.createElement("script")
			script.text = patched + "\n//# sourceURL=/barbarossa-to-berlin/replay-common-adapter.js"
			document.body.appendChild(script)
		} catch (error) {
			console.error(error)
			document.getElementById("prompt").textContent = "ERROR loading replay: " + error
		}
	}

	loadCommonReplay()
})()
