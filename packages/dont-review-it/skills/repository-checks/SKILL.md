---
name: repository-checks
description: >
  Run `dont-review-it check` as the single failing gate for everything lint cannot express: canonical value catalogs, duplicated declaration bodies, GitHub Actions workflow definitions and pinned action refs, catalog dependency declarations, required file shapes (AGENTS.md/CLAUDE.md, TypeScript-only tool config), telemetry wiring, preset reach, publishable package entry points, and the TanStack Intent skills shipped with published packages. Load when wiring the check into CI or a guard script, when a report names a workflow file, a manifest, or a `package.json`, when `warning:` lines appear that do not fail the run, or when a published package has to ship agent skills.
metadata:
  type: core
  library: "@mst/dont-review-it"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/dont-review-it/src/check-command.ts"
  - "masseater/mst:packages/dont-review-it/src/run-checks.ts"
  - "masseater/mst:packages/dont-review-it/src/workflows/run-workflow-checks.ts"
  - "masseater/mst:packages/dont-review-it/src/intent-skills/shipped-skills.ts"
  - "masseater/mst:packages/dont-review-it/AGENTS.md"
---

# @mst/dont-review-it — run the repository checks

This skill builds on `packages/dont-review-it/skills/core`. Read it first for how the lint preset side is wired.

The CLI has exactly one command. `check` runs every repository-wide check and exits non-zero when any of them reports a problem. There is no second subcommand, so a check that exists always runs and nobody has to remember to call it.

## requires

- **A repository root the process can read.** `--repository-root` defaults to the current working directory. Every check that has nothing to look at reports itself as skipped with a reason rather than as passing, so read the summary lines, not the exit code alone.

## Setup

```sh
pnpm exec dont-review-it check --repository-root .
```

Wire it into the one script CI and the git hooks already call, beside the other gates:

```json
{
  "scripts": {
    "guard": "vp check && vp run -r test --coverage && vp exec dont-review-it check"
  }
}
```

`check --write` rewrites the parts the repository decides on its own — entry scripts and the `metadata.library_version` of every shipped SKILL.md — and then re-runs the checks. Nothing else is rewritten.

## Core Patterns

### Read the summary before the exit code

```
checked lint-rule-docs 112 rules 0 problems 0 warnings
checked preset-adoption 9 workspaces 0 problems 2 warnings
checked intent-skills 10 manifests 0 problems 0 warnings
```

One line per check, naming the unit it counted. A check with nothing to inspect prints its skip reason — `no workspace definition`, `no workflow definition`, `no toolchain configuration`, `workspace definition does not parse` — and a count of zero. A zero-count line is not a pass; it means that check has not run.

### Fix the file a problem names, and never the report

Every problem line is `path:line message`, stating what must not stay and the imperative fix. Fix the named file. Narrowing `--repository-root` until the report disappears, or filtering the output, leaves the invariant broken and the gate green.

### Treat `warning:` as a report you cannot close by hand

```
warning: "SIGINT", "SIGTERM" is declared by more than one concept: ai-native.interrupt-signal, auto-develop.shutdown-signal
warning: vite.config.ts:51 The lint configuration must not leave dont-review-it/<rule> switched off for packages/ai-native.
```

Warnings do not count toward the exit code. They exist where the fix is a judgment call — two concepts sharing a value set may be entirely correct, and a rule switched off may be off for a reason that belongs in an engineering decision log. Anything whose fix is unique is a problem, not a warning.

### Keep workflow definitions inside the checked shape

```yaml
name: ci
on:
  push:
jobs:
  guard:
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - uses: actions/checkout@8edcb1bdb4e267140fa742c62e395cd74f332709 # v5
      - run: pnpm run guard
```

For every definition under `.github/workflows/` the checks require: parseable YAML, no trigger filter on a workflow that could be required as a gate, no `on:` block on a reusable workflow that others call, no `workflow_run` chaining, an explicit `permissions:` block on every job, one command call per `run:` block, no construct that reads a failure as a success, every action reference ending in a commit SHA with the tag in a comment, and a checkout that does not fetch the whole history. Separately, once per repository, the mechanism that raises those pinned references must be connected.

### Keep the shipped skills in agreement with the manifest

For every workspace `package.json` that has a `name` and is not `"private": true`:

```json
{
  "name": "@scope/pkg",
  "version": "1.4.0",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
```

The check requires at least one `skills/**/SKILL.md`, `skills` in the `files` allow list when that list exists, the `tanstack-intent` keyword, a `skills/CHANGELOG.md` carrying `## 1.4.0` as a heading, and `metadata.library_version: "1.4.0"` in every shipped SKILL.md. It runs in both directions: a `"private": true` package must carry none of it. Manifests with no `version` are exempt from the last two only.

The check reads the wiring, never the prose. Whether the changelog entry matches what the version actually changed is not machine-decidable, and the structure of a SKILL.md belongs to `intent validate`.

## Common Mistakes

### [CRITICAL] a check failure masked to keep a pipeline green

Wrong:

```yaml
- run: pnpm exec dont-review-it check || true
```

Correct:

```yaml
- run: pnpm run guard
```

The appended `|| true` reads every failure as a success, so the required job keeps its name and its green tick while enforcing nothing; the masked-failure check reports exactly this rewrite, along with `continue-on-error` and swallowed exit codes.

Source: masseater/mst:packages/dont-review-it/src/workflows/checks/masked-failure.ts

### [HIGH] a gating workflow narrowed by its own trigger

Wrong:

```yaml
on:
  push:
    paths: ["src/**"]
```

Correct:

```yaml
on:
  push:
```

A required job that filters its own trigger never starts on the excluded changes, and branch protection reads a run that never happened as a requirement already satisfied — so the gate passes hardest on exactly the changes it declined to look at.

Source: masseater/mst:packages/dont-review-it/src/workflows/checks/gating-trigger-filter.ts

### [HIGH] a job left on undeclared default permissions

Wrong:

```yaml
jobs:
  guard:
    runs-on: ubuntu-latest
```

Correct:

```yaml
jobs:
  guard:
    runs-on: ubuntu-latest
    permissions: {}
```

A job without a `permissions:` block runs on whatever the repository default grants, so the token's scopes are decided in a settings page nobody reads during review and can widen without a single line of the workflow changing.

Source: masseater/mst:packages/dont-review-it/src/workflows/checks/declared-permissions.ts

### [HIGH] a published package shipped without its agent skills

Wrong:

```json
{
  "name": "@scope/pkg",
  "files": ["dist"]
}
```

Correct:

```json
{
  "name": "@scope/pkg",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
```

The package publishes without complaint, and agents that install it discover nothing: either `skills/` is absent, or it exists and the tarball omits it, or discovery skips the package for lack of the keyword. Each missing piece is reported by name.

Source: masseater/mst:packages/dont-review-it/src/intent-skills/shipped-skills.ts

### [HIGH] a published entry point left pointing at TypeScript source

Wrong:

```json
{
  "bin": { "my-cli": "./src/cli.ts" },
  "files": ["dist"]
}
```

Correct:

```json
{
  "bin": { "my-cli": "./src/cli.ts" },
  "files": ["dist"],
  "publishConfig": { "bin": { "my-cli": "./dist/cli.mjs" } }
}
```

A workspace link resolves to the real path, so Node opens the source file outside `node_modules` and strips its types happily; published, the same file lands under `node_modules` and Node refuses with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. The check reads the entry as `publishConfig` leaves it, and also reports an entry the `files` allow list does not carry.

Source: masseater/mst:packages/dont-review-it/AGENTS.md

### [MEDIUM] a run block holding a command sequence

Wrong:

```yaml
- run: |
    pnpm install
    pnpm test
```

Correct:

```yaml
- run: pnpm run guard
```

A sequence written into the workflow file cannot be executed locally, so what CI runs and what a developer runs drift apart with nothing comparing them; the single-command-run check requires one command call whose sequence a script owns.

Source: masseater/mst:packages/dont-review-it/src/workflows/checks/single-command-run.ts

### [MEDIUM] an internal package left carrying skill wiring

Wrong:

```json
{
  "name": "@scope/internal",
  "private": true,
  "keywords": ["tanstack-intent"]
}
```

Correct:

```json
{
  "name": "@scope/internal",
  "private": true
}
```

npm never publishes the package, so the keyword, the `files` entry, and any leftover `skills/` directory advertise a distribution surface nobody can install — and the discovery listing gives no sign that the package it names is unreachable.

Source: masseater/mst:packages/dont-review-it/src/intent-skills/shipped-skills.ts

## Reference

```
check                      unit             what it reads
entry-composition          manifest         the scripts a repository's entry points compose
canonical-values           source file      @canonical-values annotations and their declarations
equivalent-concepts        concept          value sets shared by two concepts (warning only)
duplicated-bodies          declaration      declaration bodies repeated across the repository
workflow-definitions       definition       .github/workflows/*.yml against the policy above
action-updates             configuration    that pinned refs have a mechanism raising them
lint-rule-index            workspace        docs/lint/index.md against the rule implementations
lint-rule-docs             rule             docs/lint/<rule>.md against the rule and its tests
dependency-declarations    manifest         catalog entries shared by two or more workspaces
required-file-form         package root     AGENTS.md/CLAUDE.md, tool config outside TypeScript
preset-adoption            workspace        preset rules switched off, and where (warning only)
telemetry-wiring           package root     that a workspace declares its own measurement
shippable-packages         manifest         published entries, files, and private dependencies
intent-skills              manifest         skills, keyword, files, changelog, library_version
```

`--write` touches entry scripts and shipped skill versions only. Everything else in the report is fixed by hand.

## See also

- `packages/dont-review-it/skills/core` — the lint preset half of the same package, and the probe that proves a custom rule is wired.
- `packages/agentic-documents/skills/core` — the document checks, run as the same kind of single-entry, non-zero-exit gate.
