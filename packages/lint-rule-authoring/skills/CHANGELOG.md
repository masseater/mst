# @mst/lint-rule-authoring

What each published version changes for the packages that install it, and for the agents that load the skills shipped beside this file.

## 0.0.0

- `createWorkspaceLintRule`, the factory every custom rule in this repository is written through, together with the `WorkspaceLintRule` type it produces.
- A rule tester that runs a rule over valid and invalid sources without starting the whole lint.
- A `lint-rule-authoring check` CLI that reports stale generated rule indexes and regenerates them with `--write`.
- Optional OpenTelemetry metrics for the time each custom rule spends, exported only when the environment asks for them.
