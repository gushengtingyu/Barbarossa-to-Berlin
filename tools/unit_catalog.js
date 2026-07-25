"use strict"

const stats = new Map()

function add(names, values) {
	for (const name of names) stats.set(name, values)
}

add(["CW_SCU", "BR_SCU"], [2, 2, 3, 1, 1, 3])
add(["SU_SCU"], [2, 1, 3, 1, 1, 3])
add(["SU_Leningrad", "SU_Northwest", "SU_West", "SU_SW", "SU_Central", "SU_Reserve", "SU_South", "SU_Caucasus"], [3, 3, 3, 2, 3, 3])
add(["SU_SW Mech"], [5, 3, 4, 3, 3, 4])
add(["IT_SCU", "HU_SCU", "BU_SCU", "RO_SCU", "SW_SCU", "TU_SCU"], [1, 1, 3, 0, 1, 3])
add(["IT_Armor SCU"], [2, 2, 4, 1, 1, 4])
add(["HU_3 Army", "RO_3 Army", "RO_4 Army", "SW_1 Army", "TU_1 Army", "TU_2 Army", "HU_2 Army"], [2, 2, 3, 1, 2, 3])
add(["GE_SCU"], [2, 1, 3, 1, 1, 3])
add(["GE_11 Army", "GE_2 Army", "GE_16 Army", "GE_18 Army", "GE_9 Army", "GE_4 Army", "GE_6 Army", "GE_17 Army", "GE_15 Army"], [5, 3, 3, 3, 3, 3])
add(["GE_1 Army", "GE_7 Army", "GE_8 Army", "GE_10 Army", "GE_14 Army", "GE_19 Army"], [3, 3, 3, 2, 3, 3])
add(["GE_Armor SCU"], [3, 2, 5, 2, 2, 5])
add(["GE_4 PzA", "GE_3 PzA", "GE_2 PzA", "GE_1 PzA", "GE_5 PzA"], [5, 3, 5, 3, 3, 5])
add(["BR_1 Army", "BR_Desert Army", "FF_1 Army"], [3, 3, 3, 2, 3, 3])
add(["BR_2 Army Mech", "BR_8 Army Mech", "CW_1 Cnd Army", "US_1 Army", "US_5 Army", "US_7 Army", "US_9 Army", "US_15 Army"], [5, 3, 4, 3, 3, 4])
add(["US_3 Army"], [6, 3, 5, 4, 3, 5])
add(["US_SCU"], [2, 2, 4, 1, 2, 4])
add(["FF_SCU"], [2, 1, 3, 1, 1, 3])
add(["SU_Don", "SU_Stalingrad", "SU_Steppe", "SU_Voronezh", "SU_Bryansk", "SU_Kalinin", "SU_Volhov"], [3, 3, 3, 2, 3, 3])
add(["SU_1 Ukr", "SU_2 Ukr", "SU_3 Ukr Mech", "SU_4 Ukr Mech", "SU_1 Baltic Mech", "SU_2 Baltic Mech", "SU_3 Baltic Mech", "SU_1 Bel Mech", "SU_2 Bel Mech", "SU_3 Bel Mech"], [5, 3, 4, 3, 3, 3])
add(["SU_Shock SCU"], [4, 1, 2, 2, 1, 2])
add(["SU_Armor SCU"], [3, 2, 4, 2, 2, 4])
add(["YU_Army"], [3, 3, 2, 2, 3, 2])
add(["IT_8 Army"], [2, 2, 3, 1, 2, 3])
add(["GE_1FJ Army"], [5, 3, 1, 3, 3, 1])
add(["GE_6SS PzA"], [5, 3, 5, 4, 3, 5])
add(["GE_PAA"], [5, 2, 5, 3, 2, 5])
add(["GE_1SS SCU", "GE_2SS SCU"], [4, 2, 5, 3, 2, 5])

const nonReplaceable = new Set(["SU_SW Mech", "SW_1 Army", "YU_Army", "IT_8 Army", "GE_1FJ Army"])

function baseName(filename) {
	return String(filename)
		.replace(/-b(?=\.)/, "")
		.replace(/\.(?:jpg|png|gif)$/i, "")
}

function get(filename) {
	const key = baseName(filename)
	const value = stats.get(key)
	if (!value) return null
	const [cf, lf, mf, rcf, rlf, rmf] = value
	return {
		cf,
		lf,
		mf,
		rcf,
		rlf,
		rmf,
		non_replaceable: nonReplaceable.has(key),
	}
}

module.exports = { baseName, get, nonReplaceable, stats }
