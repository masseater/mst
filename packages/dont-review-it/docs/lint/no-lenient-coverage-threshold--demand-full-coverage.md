---
description: "Require the test config to demand full coverage on every metric, so the amount of untested code that is allowed to stay is a decision written down once rather than whatever the suite happens to reach"
---

# no-lenient-coverage-threshold--demand-full-coverage

<!-- BEGIN GENERATED rule-header -->

Require the test config to demand full coverage on every metric, so the amount of untested code that is allowed to stay is a decision written down once rather than whatever the suite happens to reach

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-lenient-coverage-threshold--demand-full-coverage.ts`](../../src/lint/oxlint/rules/no-lenient-coverage-threshold--demand-full-coverage.ts)

<!-- END GENERATED rule-header -->

## Violation

A test runner configuration whose coverage floor is absent or falls short. Only `vite.config` and `vitest.config` files are read; the default-exported expression is entered, through a wrapping call such as `defineConfig({ ... })`, then `test`, `coverage` and `thresholds` in turn.

Four reports. `thresholds` not being reachable at all is one. A metric carrying no numeric literal there is another, whether the property is absent or its value is a reference, a spread or a computed expression. A numeric literal below what is demanded is the third. `perFile` not set to `true` is the fourth, and it is independent of the others.

`branches`, `functions`, `lines` and `statements` each default to a demand of 100 and can be lowered one at a time. The shorthand `thresholds: { 100: true }` satisfies all four, and where a key is written twice the later one is read.

## Fix

Write `test.coverage.thresholds` with the demanded number on all four metrics and `perFile: true`. Where 100 everywhere is right, `thresholds: { 100: true, perFile: true }` says the same thing.

Where the measured value falls short, cover the code. An unreachable branch is a branch to delete.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a full threshold checked against the package total is reported
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { coverage: { thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 } } } });

```

```ts
// a metric left out is reported on its own
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { coverage: { thresholds: { functions: 100, lines: 100, statements: 100, perFile: true } } } });

```

Code this rule accepts.

```ts
// every metric spelled out at full coverage, checked file by file, passes
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { coverage: { thresholds: { branches: 100, functions: 100, lines: 100, statements: 100, perFile: true } } } });

```

```ts
// the shorthand that demands full coverage on every metric at once passes
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { coverage: { thresholds: { 100: true, perFile: true } } } });

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Deleting the `test` block. The same report stands for having no `thresholds`
- Adding the files that fall short to `coverage.exclude`. They leave the denominator and nothing is covered
- Escaping the numbers into constants in another file. The floor stops being readable here and counts as undeclared
- Removing `perFile` to pass on the package total

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `missingCoverageThresholds` | A test config must not measure coverage without demanding a number. \`{{path}}\` is absent from this config. Add it and set {{requirement}} together with \`perFile: true\`. |
| `aggregateCoverageThreshold` | A coverage threshold must not be checked against the package total. \`perFile\` is not set to \`true\` in \`test.coverage.thresholds\`. Add it. |
| `unsetCoverageThreshold` | A coverage metric must not be left without a threshold. \`{{metric}}\` carries no number in \`test.coverage.thresholds\`. Set it to {{required}}. |
| `lenientCoverageThreshold` | A coverage threshold must not sit below what this repository demands. \`{{metric}}\` is declared as {{declared}} against a demanded {{required}}. Raise it to {{required}} and cover the code that made you lower it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
