# VASSAL source archive

This directory contains review-only source material from the VASSAL module.
It is not part of the Rally runtime and must not override reviewed CSV data.

- `buildFile`: input for `npm run import:vassal` and related review tools.
- `moduledata`: original VASSAL module metadata retained for provenance.
- `images-unused/`: artwork with no references in runtime code, authored data,
  tests, tools, or documentation at the time it was archived.

Before restoring an archived image to `images/`, add an explicit runtime or
authored-data reference and a focused test.
