---
name: core
description: >
  Adopt @mst/dont-review-it in a Vite+ repository: call `dontReviewItPreset.fmt()` and `dontReviewItPreset.lint()` inside the `fmt` and `lint` blocks of `vite.config.ts`, extend `@mst/dont-review-it/tsconfig/app.json` or `library.json` from every tsconfig, capture process output in tests with `standardIoTest` from `@mst/dont-review-it/vitest`, and prove a custom rule is wired with a violating probe file. Load when configuring oxlint or oxfmt with this preset, when a `dont-review-it/*` rule reports, when `ignorePatterns` or `lint.plugins` seem to have no effect, or when checking whether the preset is actually active.
metadata:
  type: core
  library: "@mst/dont-review-it"
  library_version: "0.0.0"
sources:
  - "masseater/mst:packages/dont-review-it/src/configs/preset.ts"
  - "masseater/mst:packages/dont-review-it/AGENTS.md"
  - "masseater/mst:packages/dont-review-it/docs/lint/no-unwrapped-toolchain-config--call-the-preset-for-the-block.md"
  - "masseater/mst:packages/dont-review-it/docs/lint/no-standalone-tsconfig--extend-shared-preset.md"
---

# @mst/dont-review-it — adopt the preset

The preset holds machine-enforced answers to writing questions that would otherwise be raised in code review. Only questions with one answer are in it; anything whose answer depends on the situation is left to a human. Every rule ships at error severity, every report names a unique fix, and the matching file under `docs/lint/` carries the reasoning the message deliberately leaves out.

## requires

- **Vite+, with the toolchain configuration consolidated in `vite.config.ts`.** The package declares `vite-plus` as a peer dependency and both preset functions return the object a Vite+ block owns. There is no path that applies this preset from `.oxlintrc.json` — a repository that keeps its oxlint configuration in a separate file cannot adopt it without moving that configuration first.

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

Each function returns the whole object its block must own: the patterns git is told to ignore, and — for `lint` — the rule sets of `@mst/lint-rule-authoring` and `@mst/dont-review-it` together with the JS plugin that holds the custom rules, or — for `fmt` — the formatting choices this repository fixes. Whatever you pass in layers on top: `lint({ rules: { ... } })` keeps your rules, and an `extends` you pass lands after the shipped presets.

The preset also keeps oxlint's default plugin set and turns `reportUnusedDisableDirectives` into an error, so a suppression comment that has stopped matching anything fails the lint instead of quietly persisting.

## Core Patterns

### Extend a shared tsconfig preset

```json
{
  "extends": "@mst/dont-review-it/tsconfig/library.json",
  "include": ["src"]
}
```

`library.json` for published packages, `app.json` for application workspaces. A tsconfig written from scratch is reported by `no-standalone-tsconfig--extend-shared-preset`.

### Prove a custom rule actually fires

```sh
echo "export default {}" > src/wiring-probe.ts
vp lint src/wiring-probe.ts
rm src/wiring-probe.ts
```

The run must report `dont-review-it/no-default-export--use-named-export`. A green lint over the probe means the JS plugin is not wired — there is no other signal, because an unwired plugin produces no error, no warning, and no diagnostic of its own.

### Capture process output in a test instead of building a double

```ts
import { standardIoTest } from "@mst/dont-review-it/vitest";
import { expect } from "vite-plus/test";

standardIoTest("writes the usage line to stderr", ({ stderr }) => {
  runCli(["--unknown"]);
  expect(stderr.text()).toContain("Usage:");
});
```

`stdout` and `stderr` are auto-applied fixtures holding the captured chunks and a `text()` join. Both are restored after the test.

### Respond to a report

Each message states the prohibition and the imperative fix, and ends with the repository-relative path of the rule's document. Apply the fix the message names; open the document when you need the reasoning. Do not add a disable directive — an unused one is itself an error, and the suppression question was already answered by writing the rule.

## Common Mistakes

### [HIGH] ignorePatterns placed in an extended preset

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

oxlint's config merge keeps only the extending side's `ignorePatterns` and drops the ones an `extends` target ships, without an error or a warning — so the preset function must produce the object handed to `defineConfig` itself. `no-unwrapped-toolchain-config--call-the-preset-for-the-block` reports a config that forgets to call it.

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

`plugins` replaces the base plugin set rather than extending it, so naming one plugin silently switches off the default `unicorn`, `typescript`, and `oxc` rules — dozens of them — while the lint goes on passing and the diff shows one added line.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [HIGH] a print-config diff read as proof of JS plugin wiring

Wrong:

```sh
vp lint --print-config
```

Correct:

```sh
echo "export default {}" > src/wiring-probe.ts
vp lint src/wiring-probe.ts
rm src/wiring-probe.ts
```

`--print-config` resolves built-in rules only; it never lists a rule that arrives through a `jsPlugins` entry or an extended preset, so adding one produces an empty diff and the check confirms nothing it was meant to confirm.

Source: masseater/mst:.claude/rules/ai-generated/gotchas.md

### [HIGH] a GitHub alert written with its body on the next line

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

`fmt` sets `proseWrap: "never"`, so a blockquote whose marker and body form one paragraph is joined into a single line, which GitHub renders as an ordinary blockquote with `[!IMPORTANT]` as literal text. A `>`-only line makes the marker its own paragraph, which survives the join.

Source: masseater/mst:docs/engineering-decision-logs/0046-let-the-formatter-own-where-markdown-lines-break.md

### [MEDIUM] a tsconfig written from scratch

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

A standalone tsconfig drifts from the shared compiler options one release at a time, and nothing compares the two — the workspace keeps type-checking, against weaker settings than everything around it.

Source: masseater/mst:packages/dont-review-it/docs/lint/no-standalone-tsconfig--extend-shared-preset.md

### [MEDIUM] a second exported config added beside the preset

Wrong:

```ts
export const dontReviewItStrictPreset = { lint: () => ({ ... }) };
```

Correct:

```ts
export const dontReviewItPreset = { fmt, lint };
```

One rule set applies at the root and reaches the whole repository; a second entry point makes the reach depend on which one a repository wired, which puts the adoption decision back where the preset exists to remove it.

Source: masseater/mst:packages/dont-review-it/AGENTS.md

## Reference

```
@mst/dont-review-it                    dontReviewItPreset { fmt, lint }
@mst/dont-review-it/plugin             the oxlint jsPlugins entry (registered by the preset)
@mst/dont-review-it/vitest             standardIoTest, CapturedStream
@mst/dont-review-it/tsconfig/app.json      application workspaces
@mst/dont-review-it/tsconfig/library.json  published packages
dont-review-it check                   the repository-wide checks (see the sibling skill)
```

`specs/` is the one place the rule set narrows itself: an override there switches the required spelling to `.spec.ts`, drops the source-adjacency requirement, and caps `describe` nesting.

## See also

- `packages/dont-review-it/skills/repository-checks` — the checks lint cannot express, run from the same package through the `dont-review-it check` CLI.
- `packages/lint-rule-authoring/skills/core` — adding a rule to this preset starts at the factory that package provides.
