---
name: core
description: >
  Adopt @mst/dont-review-it in a Vite+ repository: wire the oxlint preset and
  js plugin into vite.config.ts lint/fmt blocks, wrap the config with
  withGitExcludes, extend the shared tsconfig presets, and verify custom-rule
  wiring with a violating probe file. Load when configuring oxlint/oxfmt with
  this preset, when a dont-review-it/* rule reports, or when checking whether
  the preset is actually active.
metadata:
  type: core
  library: "@mst/dont-review-it"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/dont-review-it/src/configs/oxlint.ts"
  - "masseater/mst:packages/dont-review-it/src/configs/with-git-excludes.ts"
  - "masseater/mst:packages/dont-review-it/docs/lint/no-standalone-tsconfig--extend-shared-preset.md"
---

# @mst/dont-review-it — adopt the preset

The preset holds machine-enforced answers to writing questions that would
otherwise be raised in code review. Every rule ships at error severity, and
every rule's fix is unique: the report message tells you what to do, and the
matching file in `packages/dont-review-it/docs/lint/` tells you why.

## Setup

In the repository root `vite.config.ts`:

```ts
import { oxlint as dontReviewItOxlint, withGitExcludes } from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: withGitExcludes({}),
  lint: withGitExcludes({
    extends: [dontReviewItOxlint],
  }),
});
```

The preset already registers the js plugin
(`@mst/dont-review-it/plugin`) through its `jsPlugins` entry, keeps the
default oxlint plugin set, and turns `reportUnusedDisableDirectives` into an
error, so suppression comments that stopped matching anything fail the lint.

## Core Patterns

### Extend a shared tsconfig preset

Every `tsconfig.json` must extend one of the shipped presets; the
`no-standalone-tsconfig--extend-shared-preset` rule reports one written from
scratch.

```json
{
  "extends": "@mst/dont-review-it/tsconfig/library.json",
  "include": ["src"]
}
```

Use `@mst/dont-review-it/tsconfig/app.json` for application workspaces and
`library.json` for published packages.

### Verify that a custom rule is wired

Place a file that violates a known rule, lint exactly that file, and delete
it afterwards:

```sh
echo "export default {}" > src/wiring-probe.ts
vp lint src/wiring-probe.ts
rm src/wiring-probe.ts
```

The run must report `dont-review-it/no-default-export--use-named-export`.
A green lint over the probe file means the plugin is not wired.

### Respond to a report

Each report message states the prohibition and the imperative fix, and ends
with the repository-relative path of the rule's document. Apply the fix the
message names; read the document when you need the reasoning. Do not add a
disable directive: unused directives are themselves errors, and the
suppression question is answered by fixing the code.

## Common Mistakes

### [HIGH] ignorePatterns placed in the extended preset

Wrong:

```ts
export const myPreset = defineConfig({
  extends: [dontReviewItOxlint],
  ignorePatterns: [".agents/"],
});
```

Correct:

```ts
export default defineConfig({
  lint: withGitExcludes({
    extends: [dontReviewItOxlint],
    ignorePatterns: [".agents/"],
  }),
});
```

oxlint keeps only the extending side's `ignorePatterns` and silently drops
the ones a preset ships through `extends`, so the wrapper must run on the
object handed to `defineConfig` itself; the
`no-unwrapped-toolchain-config--wrap-with-git-excludes` rule reports a
config that forgets it.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [HIGH] lint.plugins written as an addition

Wrong:

```ts
lint: withGitExcludes({
  extends: [dontReviewItOxlint],
  plugins: ["vitest"],
}),
```

Correct:

```ts
lint: withGitExcludes({
  extends: [dontReviewItOxlint],
  plugins: ["unicorn", "typescript", "oxc", "vitest"],
}),
```

`plugins` replaces the base plugin set instead of extending it, so naming
one plugin silently disables the default `unicorn`/`typescript`/`oxc` rules
while the lint stays green.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [HIGH] print-config diff read as proof of js plugin wiring

Wrong:

```sh
vp lint --print-config | grep dont-review-it
```

Correct:

```sh
echo "export default {}" > src/wiring-probe.ts
vp lint src/wiring-probe.ts
rm src/wiring-probe.ts
```

`--print-config` resolves built-in rules only and never lists rules coming
from a `jsPlugins` entry or an extended preset, so an empty diff or grep
confirms nothing; only a violating probe file proves the rule fires.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [MEDIUM] tsconfig written from scratch

Wrong:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "esnext"
  }
}
```

Correct:

```json
{
  "extends": "@mst/dont-review-it/tsconfig/library.json",
  "include": ["src"]
}
```

A standalone tsconfig drifts from the shared compiler options without any
check noticing the drift, and the
`no-standalone-tsconfig--extend-shared-preset` rule reports it.

Source: masseater/mst:packages/dont-review-it/docs/lint/no-standalone-tsconfig--extend-shared-preset.md

## See also

- `packages/dont-review-it/skills/repository-checks` — the checks that lint
  cannot express run through the `dont-review-it check` CLI.
- `packages/lint-rule-authoring/skills/core` — adding a rule to this preset
  starts at the factory that package provides.
