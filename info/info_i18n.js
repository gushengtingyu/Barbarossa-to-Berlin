"use strict"

window.addEventListener("DOMContentLoaded", () => {
	let locale = "zh-CN"
	try {
		locale = localStorage.getItem("btb.ui_locale") || locale
	} catch {
		// Browser storage is optional; Chinese remains the default.
	}
	BTBI18N.setLocale(locale)
	if (BTBI18N.getLocale() === "en") {
		for (const link of document.querySelectorAll('a[href="rules.html"]')) link.href = "../BtB%20rules-2006.pdf"
	}
	BTBI18N.translateDocument(document)
})
