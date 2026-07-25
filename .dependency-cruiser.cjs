"use strict"

module.exports = {
	forbidden: [
		{
			name: "no-circular-dependencies",
			severity: "error",
			from: {},
			to: { circular: true }
		},
		{
			name: "core-is-foundational",
			severity: "error",
			from: { path: "^modules/core/" },
			to: { path: "^(?:rules\\.js|modules/(?:systems|states)/|modules/(?:engine|runtime|view)\\.js)" }
		},
		{
			name: "systems-do-not-depend-upward",
			severity: "error",
			from: { path: "^modules/systems/" },
			to: { path: "^(?:rules\\.js|data\\.js|modules/states/|modules/(?:engine|runtime|view)\\.js)" }
		},
		{
			name: "states-do-not-depend-on-adapters",
			severity: "error",
			from: { path: "^modules/states/" },
			to: { path: "^(?:rules\\.js|data\\.js|modules/(?:engine|view)\\.js)" }
		},
		{
			name: "view-does-not-depend-on-adapters",
			severity: "error",
			from: { path: "^modules/view\\.js$" },
			to: { path: "^(?:rules\\.js|data\\.js|modules/engine\\.js)" }
		},
		{
			name: "compatibility-engine-is-not-a-production-dependency",
			severity: "error",
			from: { pathNot: "^modules/engine\\.js$" },
			to: { path: "^modules/engine\\.js$" }
		}
	],
	options: {
		doNotFollow: { path: "^node_modules" }
	}
}
