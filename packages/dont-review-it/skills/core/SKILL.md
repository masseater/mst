---
name: core
description: >
  Adopt @mst/dont-review-it in a Vite+ repository: call dontReviewItPreset.fmt() and dontReviewItPreset.lint() in the vite.config.ts fmt and lint blocks, extend the shared tsconfig presets, and verify custom-rule wiring with a violating probe file. Load when configuring oxlint/oxfmt with this preset, when a dont-review-it/* rule reports, or when checking whether the preset is actually active.
metadata:
  type: core
  library: "@mst/dont-review-it"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/dont-review-it/src/configs/preset.ts"
  - "masseater/mst:packages/dont-review-it/docs/lint/no-unwrapped-toolchain-config--call-the-preset-for-the-block.md"
  - "masseater/mst:packages/dont-review-it/docs/lint/no-standalone-tsconfig--extend-shared-preset.md"
---

# @mst/dont-review-it — adopt the preset

The preset holds machine-enforced answers to writing questions that would otherwise be raised in code review. Every rule ships at error severity, and every rule's fix is unique: the report message tells you what to do, and the matching file in `packages/dont-review-it/docs/lint/` tells you why.

## Setup

In the repository root `vite.config.ts`:

```ts
import { dontReviewItPreset } from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: dontReviewItPreset.fmt(),
  lint: dontReviewItPreset.lint(),
});
```

Each function returns the object the block must own outright: the patterns git is told to ignore, and — for `lint` — the rule sets of `@mst/lint-rule-authoring`, `@mst/dont-review-it`, and `@mst/verified-specifications`, or — for `fmt` — the formatting choices this repository fixes. Anything you pass in is layered on top: `lint({ rules: { ... } })` keeps your rules, and an `extends` you pass lands after the shipped presets.

The preset already registers the js plugin (`@mst/dont-review-it/plugin`) through its `jsPlugins` entry, keeps the default oxlint plugin set, and turns `reportUnusedDisableDirectives` into an error, so suppression comments that stopped matching anything fail the lint.

## Core Patterns

### Extend a shared tsconfig preset

Every `tsconfig.json` must extend one of the shipped presets; the `no-standalone-tsconfig--extend-shared-preset` rule reports one written from scratch.

```json
{
  "extends": "@mst/dont-review-it/tsconfig/library.json",
  "include": ["src"]
}
```

Use `@mst/dont-review-it/tsconfig/app.json` for application workspaces and `library.json` for published packages.

### Verify that a custom rule is wired

Place a file that violates a known rule, lint exactly that file, and delete it afterwards:

```sh
echo "export default {}" > src/wiring-probe.ts
vp lint src/wiring-probe.ts
rm src/wiring-probe.ts
```

The run must report `dont-review-it/no-default-export--use-named-export`. A green lint over the probe file means the plugin is not wired.

### Respond to a report

Each report message states the prohibition and the imperative fix, and ends with the repository-relative path of the rule's document. Apply the fix the message names; read the document when you need the reasoning. Do not add a disable directive: unused directives are themselves errors, and the suppression question is answered by fixing the code.

## Common Mistakes

### [HIGH] ignorePatterns placed in the extended preset

Wrong:

```ts
export const myPreset = defineConfig({
  extends: [somePreset],
  ignorePatterns: [".agents/"],
});
```

Correct:

```ts
export default defineConfig({
  lint: dontReviewItPreset.lint({
    ignorePatterns: [".agents/"],
  }),
});
```

oxlint keeps only the extending side's `ignorePatterns` and silently drops the ones a preset ships through `extends`, so the preset function must produce the object handed to `defineConfig` itself; the `no-unwrapped-toolchain-config--call-the-preset-for-the-block` rule reports a config that forgets it.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [HIGH] lint.plugins written as an addition

Wrong:

```ts
lint: dontReviewItPreset.lint({
  plugins: ["vitest"],
}),
```

Correct:

```ts
lint: dontReviewItPreset.lint({
  plugins: ["unicorn", "typescript", "oxc", "vitest"],
}),
```

`plugins` replaces the base plugin set instead of extending it, so naming one plugin silently disables the default `unicorn`/`typescript`/`oxc` rules while the lint stays green.

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

`--print-config` resolves built-in rules only and never lists rules coming from a `jsPlugins` entry or an extended preset, so an empty diff or grep confirms nothing; only a violating probe file proves the rule fires.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [HIGH] GitHub alert written with its body on the next line

Wrong:

```md
> [!IMPORTANT] Install through the official installer.
```

Correct:

```md
> [!IMPORTANT]
>
> Install through the official installer.
```

`fmt` sets `proseWrap: "never"`, so a blockquote whose marker and body form one paragraph is joined into `> [!IMPORTANT] Install through...`, which GitHub renders as a plain blockquote with the marker as literal text. A `>`-only line makes the marker its own paragraph, which survives the join and still renders as an alert.

Source: masseater/mst:docs/engineering-decision-logs/0046-let-the-formatter-own-where-markdown-lines-break.md

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

A standalone tsconfig drifts from the shared compiler options without any check noticing the drift, and the `no-standalone-tsconfig--extend-shared-preset` rule reports it.

Source: masseater/mst:packages/dont-review-it/docs/lint/no-standalone-tsconfig--extend-shared-preset.md

## See also

- `packages/dont-review-it/skills/repository-checks` — the checks that lint cannot express run through the `dont-review-it check` CLI.
- `packages/lint-rule-authoring/skills/core` — adding a rule to this preset starts at the factory that package provides.
