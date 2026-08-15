# @mst/dont-review-it

What each published version changes for the packages that install it, and for the agents that load the skills shipped beside this file.

## 0.0.0

- `dontReviewItPreset`, the single published config, whose `fmt` and `lint` functions each return the object the matching Vite+ block must own outright.
- `lint` carries the oxlint rule sets of `@mst/lint-rule-authoring`, `@mst/dont-review-it`, and `@mst/verified-specifications`, every rule at error severity, registered together with the js plugin that holds the custom rules.
- `fmt` fixes the formatting choices that change a diff without changing what a reader sees: markdown paragraphs collapse to one line, and imports sort by origin.
- Both functions read the three git ignore paths oxlint and oxfmt do not read and turn them into `ignorePatterns`.
- Shared tsconfig presets published as subpath exports (`./tsconfig/app.json`, `./tsconfig/library.json`).
- A `check` CLI that runs every check the lint toolchain cannot express, in one command that exits non-zero on the first problem: entry composition, canonical values and the concepts that share a value set, duplicated declaration bodies, workflow definitions and the mechanism that raises their pinned action refs, the lint rule index and the rule documents, catalog dependency declarations, the required form of files a repository cannot do without, how far the preset actually reaches, whether each workspace declares its own measurement, whether a publishable package resolves once published, and the packaging of shipped agent skills.
- `check --write` rewrites only what the repository decides on its own: entry scripts, and the `metadata.library_version` of every shipped SKILL.md.
- `@mst/dont-review-it/vitest`, a `standardIoTest` fixture that captures what a test writes to `process.stdout` and `process.stderr`.
- `skills/core/references/lint-rules.md`, shipped beside the skill, listing every custom rule the preset registers and what it rejects.
