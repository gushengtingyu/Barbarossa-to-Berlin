"use strict"

const I18n = require("../modules/core/i18n.js")

function renderLog(game, locale = "zh-CN") {
	return (game.log || []).map((entry) => I18n.render(locale, entry))
}

function renderMessage(value, locale = "zh-CN") {
	return I18n.render(locale, value)
}

module.exports = { renderLog, renderMessage }
