# @mst/dont-review-it

What each published version changes for the packages that install it, and for
the agents that load the skills shipped beside this file.

## 0.0.0

- An oxlint preset whose every rule ships at error severity, registered
  together with the js plugin that carries the custom rules.
- `withGitExcludes`, which reads the three git ignore paths oxlint and oxfmt do
  not read and turns them into `ignorePatterns`.
- Shared tsconfig presets published as subpath exports (`./tsconfig/app.json`,
  `./tsconfig/library.json`).
- A `check` CLI that runs every check the lint toolchain cannot express:
  canonical values, duplicated bodies, workflow definitions, dependency
  declarations, preset adoption, entry composition, and the packaging of
  shipped agent skills.
