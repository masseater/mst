# @mst/lint-rule-authoring

What each published version changes for the packages that install it, and for the agents that load the skills shipped beside this file.

## 0.0.0

- `createWorkspaceLintRule`, the factory every custom rule in this repository is written through, together with the `WorkspaceLintRule` type it produces.
- A rule tester that runs a rule over valid and invalid sources without starting the whole lint.
- A `check` CLI that finds rules under the directories each manifest declares in `lintRules`, reconciles every workspace's `docs/lint/index.md` and every `docs/lint/<rule>.md` with them, and reports what is missing, unmarked, stale, or still carrying the seeded text. `--write` seeds the absent documents and regenerates every generated region.
- Optional OpenTelemetry metrics for the time each custom rule spends, exported only when the environment asks for them.
