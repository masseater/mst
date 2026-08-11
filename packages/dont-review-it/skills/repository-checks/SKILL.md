---
name: repository-checks
description: >
  Run `dont-review-it check` as the single failing gate for the checks lint
  cannot express: canonical values annotations, duplicated declaration
  bodies, GitHub Actions workflow definitions, and TanStack Intent skills
  shipped with published packages. Load when wiring the check into CI or
  guard scripts, when a check report names a workflow file or a package
  manifest, or when a published package must ship agent skills.
metadata:
  type: core
  library: "@mst/dont-review-it"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/dont-review-it/src/run-cli.ts"
  - "masseater/mst:packages/dont-review-it/src/run-checks.ts"
  - "masseater/mst:packages/dont-review-it/src/workflows/run-workflow-checks.ts"
  - "masseater/mst:packages/dont-review-it/src/intent-skills/shipped-skills.ts"
---

# @mst/dont-review-it — run the repository checks

This skill builds on `packages/dont-review-it/skills/core`. Read it first
for how the lint preset side is wired.

The CLI has exactly one command. `check` runs every repository-wide check
and exits nonzero when any of them reports. There is no second subcommand,
so a check that exists always runs.

## Setup

```sh
pnpm exec dont-review-it check --repository-root .
```

`--repository-root` defaults to the current working directory. Wire the
command into the one script your CI and hooks already call, next to the
other gates:

```json
{
  "scripts": {
    "guard": "vp check && vp run -r test --coverage && vp exec dont-review-it check"
  }
}
```

## Core Patterns

### Read a report and fix the named file

Every problem line is `path:line message`. The message states what must not
stay and the imperative fix. Fix the named file; do not filter the output
and do not re-run with a narrower root to make the report disappear.

### Keep workflow definitions inside the checked shape

The workflow checks require, for every definition under
`.github/workflows/`: parseable YAML, no trigger filter on a gating
workflow, no `on:` block in a reusable workflow called by others, no
`workflow_run` chaining, an explicit `permissions:` block on every job, one
command call per `run:` block, and no construct that reads a failure as a
success.

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

### Keep agent skills in agreement with the manifest

For every workspace `package.json` that has a `name` and is not
`"private": true`, the check requires three things: at least one
`skills/**/SKILL.md`, a `"skills"` entry in the `files` array, and the
`"tanstack-intent"` keyword. Scaffold missing skills with
`npx @tanstack/intent@latest scaffold` and validate them with
`npx @tanstack/intent@latest validate`.

```json
{
  "name": "@scope/pkg",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
```

The check runs in both directions: a `"private": true` package must carry
none of those three, because a skill that never ships announces a
distribution surface that does not exist.

## Common Mistakes

### [CRITICAL] check failure masked to keep a pipeline green

Wrong:

```yaml
- run: pnpm exec dont-review-it check || true
```

Correct:

```yaml
- run: pnpm run guard
```

The appended `|| true` reads every failure as a success, so the gate keeps
its name while enforcing nothing; the masked-failure check reports exactly
this rewrite, including `continue-on-error` and swallowed exit codes.

Source: masseater/mst:packages/dont-review-it/src/workflows/checks/masked-failure.ts

### [HIGH] gating workflow narrowed by its own trigger

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

A required job that filters its own trigger never runs on the excluded
changes, and the branch protection reads the absent run as satisfied.

Source: masseater/mst:packages/dont-review-it/src/workflows/checks/gating-trigger-filter.ts

### [HIGH] job left on undeclared default permissions

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

A job without a `permissions:` block runs on whatever the repository
default grants, so the scopes it holds are invisible in review.

Source: masseater/mst:packages/dont-review-it/src/workflows/checks/declared-permissions.ts

### [MEDIUM] run block holding a command sequence

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

A sequence written into the workflow file cannot be executed locally, so CI
and local runs drift; the single-command-run check requires one command
call whose sequence a script owns.

Source: masseater/mst:packages/dont-review-it/src/workflows/checks/single-command-run.ts

### [HIGH] published package shipped without its agent skills

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

The package publishes fine, but agents that install it discover no skills:
either the `skills/` directory is missing, or it exists and the tarball
omits it, or discovery skips the package for lack of the keyword. The
shipped-skills check reports each missing piece by name.

Source: masseater/mst:packages/dont-review-it/src/intent-skills/shipped-skills.ts

### [MEDIUM] internal package left carrying skill wiring

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

A package that npm never publishes still advertises skills through its
keyword, files entry, or a leftover `skills/` directory, so discovery
reports a surface nobody can install; the check names each leftover piece.

Source: masseater/mst:packages/dont-review-it/src/intent-skills/shipped-skills.ts

## See also

- `packages/agentic-documents/skills/core` — the document checks run as the
  same kind of single-entry, nonzero-exit gate.
