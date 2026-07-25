"use strict"

const { data } = require("../data.js")
const map = require("./systems/map.js")

const adjacency = map.buildAdjacency(data)
const turn = require("./systems/turn.js").create(Object.freeze({ data, map, adjacency }))

module.exports = Object.freeze({ data, map, adjacency, turn })
