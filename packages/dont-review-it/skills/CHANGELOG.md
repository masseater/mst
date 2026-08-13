# @mst/dont-review-it

What each published version changes for the packages that install it, and for the agents that load the skills shipped beside this file.

## 0.0.0

- `dontReviewItPreset`, the single published config, whose `fmt` and `lint` functions each return the object the matching Vite+ block must own outright.
- `lint` carries the oxlint rule sets of `@mst/lint-rule-authoring`, `@mst/dont-review-it`, and `@mst/verified-specifications`, every rule at error severity, registered together with the js plugin that holds the custom rules.
- `fmt` fixes the formatting choices that change a diff without changing what a reader sees: markdown paragraphs collapse to one line, and imports sort by origin.
- Both functions read the three git ignore paths oxlint and oxfmt do not read and turn them into `ignorePatterns`.
- Shared tsconfig presets published as subpath exports (`./tsconfig/app.json`, `./tsconfig/library.json`).
- A `check` CLI that runs every check the lint toolchain cannot express: canonical values, duplicated bodies, workflow definitions, dependency declarations, preset adoption, entry composition, and the packaging of shipped agent skills.
