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

A test runner configuration that declares no coverage floor, or one whose floor falls short of what the repository demands.

Only files whose name starts with `vite.config` or `vitest.config` and whose extension is one of `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs` are read. Nothing else is looked at. A Vite+ setup gathers the configuration into `vite.config.ts`, while a setup using Vitest on its own may keep a separate `vitest.config.ts`, and the same demand has to hold wherever it is written.

What is read is the expression the file default-exports. Where it is wrapped in a call such as `defineConfig({ ... })`, the first argument is entered. From there the object literals `test`, `coverage` and `thresholds` are entered in turn, and `branches`, `functions`, `lines` and `statements` are read one at a time.

There are four reports.

Where `thresholds` could not be reached, one report is raised. No `test`, no `coverage`, no `thresholds`, no default export, and a default export pointing at a variable whose literal cannot be read all collapse into it. Telling apart where the walk stopped would not change the fix, which is to write `thresholds`.

Where `thresholds` is there and a metric carries no numeric literal, that metric is reported. Both the property being absent and its value not being a numeric literal — a variable reference, something poured in by a spread, a computed expression — land here. With the value outside the configuration file, reading that file does not settle the floor, so it counts as undeclared.

Where `thresholds` carries a numeric literal below what is demanded, that metric is reported. Equal to or above the demand passes: `thresholds` is a floor, and standing above it is not a problem.

Where `thresholds` was reached, `perFile` is checked for `true`. Anything else raises one report. That judgment is independent of the per-metric ones, so both can be reported at once.

Vitest's shorthand `thresholds: { 100: true }` is treated as 100 on every metric, with the key written either as a numeric or a string literal. The demand never exceeds 100, so this shorthand satisfies all four. `100: false` is treated as declaring nothing.

Where the same key is written twice, the later one is taken, because that is the one that takes effect at run time.

What this rule reads is the declaration, not the measured value. Whether a declared floor is actually checked depends on coverage measurement being enabled, which is outside the lint's jurisdiction.

### The invariant

The first layer is that coverage with no declared floor only prints numbers and enforces nothing. A coverage report says how things are right now. Without a floor, a commit that lowered the value and one that raised it are treated identically. A state that depends on somebody reading the report and noticing is indistinguishable from a state where nobody is looking.

The second layer is that a floor below 100 declares how much unverified code is acceptable. Writing 90 is an agreement that code without tests may exist up to 10%. Nobody specifies where that 10% is, so in practice it collects in the hardest places to write, as the allowance for skipping tests. And when the allowance fills up, the move that gets made is lowering the floor rather than adding tests — a one-line change that hides among the others in a review.

The third layer is that when the allowance is settled per configuration file, no repository-wide standard exists any more. Workspaces reading 90, 85 and 80 leave no record of what deliberation produced each number. Putting the demand in the rule and letting configuration files say only "the demand is met" makes changing the standard a change in one place, and makes the change itself visible as a diff.

The fourth layer is that a floor read against a package total says nothing about which file it belongs to. While the total demands 100 it agrees with per-file, and the moment an option lowers even one metric the meaning changes. A total of 90 means "one file without tests still passes as long as well-written files make up the difference", and which files are covering for which does not show in the number. A newly added file can land without tests and, in a package large enough, the total will not move. `perFile` is demanded to pin the floor as something said about every file rather than about an average.

The fifth layer is that writing only one metric breaks the most quietly. A configuration setting `lines` to 100 looks strict, and with `branches` missing, not a single branch need have been taken. Line coverage does not see branches, so in that combination code that ran every line while executing only one side of a branch scores full marks. All four are demanded together because one being loose thins the meaning of the other three.

### Configuration

- `branches`, `functions`, `lines`, `statements` (optional, numbers): the floor demanded of that metric, from 0 to 100. All default to 100. A metric left unnamed keeps its default, so lowering one never drops the other three quietly

```jsonc
["error", { "branches": 90 }]
```

There is no way to lower `perFile`. Whether the floor is read per file is how the floor is read at all, not a number that can be lowered.

There is no way to vary the demand per workspace. A coverage floor is one agreement about how much unverified code this repository allows, and letting each workspace hold a different number would mean the agreement does not exist. Where one workspace genuinely has different circumstances, either it belongs in another repository or the demand comes down for the whole one.

Coverage measurement being enabled is not required. This rule reads the declaration in the configuration file, not how the tests are launched. Whether measurement is on can also change with CLI arguments and the environment, and cannot be settled by reading the configuration file. Judging the declaration and the launch in one rule would leave both violations controllable only through one setting.

## Fix

Write `test.coverage.thresholds` in the configuration file, put the demanded number on all four metrics, and add `perFile: true`. Where 100 on every metric is right, `thresholds: { 100: true, perFile: true }` says the same thing.

Where writing the declaration leaves the measured value below the floor, what needs fixing is the code, not the floor. What is not reached is usually a failure path that "cannot happen". Where you judge it unreachable, confirm whether it really is unreachable or whether a caller can produce that state. In the first case the branch itself is unnecessary and deleting it raises the coverage; in the second, a test is needed.

Where circumstances keep the whole repository from meeting the floor, what comes down is the rule's option, not the configuration file. Lowered through the option, the number is settled once for the repository and reaches every configuration file as the same demand. Lowering configuration files one at a time leaves the reason in that file alone, and nobody can judge whether the others should carry the same looseness.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a full threshold checked against the package total is reported
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({
  test: {
    coverage: { thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 } },
  },
});
```

```ts
// a metric left out is reported on its own
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({
  test: {
    coverage: { thresholds: { functions: 100, lines: 100, statements: 100, perFile: true } },
  },
});
```

Code this rule accepts.

```ts
// every metric spelled out at full coverage, checked file by file, passes
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({
  test: {
    coverage: {
      thresholds: { branches: 100, functions: 100, lines: 100, statements: 100, perFile: true },
    },
  },
});
```

```ts
// the shorthand that demands full coverage on every metric at once passes
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { coverage: { thresholds: { 100: true, perFile: true } } } });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Deleting the whole `test` block from the configuration to stop the report. It comes out as the same report for having no `thresholds`, and even if it could be taken out of reach, what lies beyond is the state of having no floor at all
- Adding files that fall short to `coverage.exclude` to meet the floor. They leave the denominator so the number rises, and not one line of unverified code is gone. Exclusion is for what was never a measurement target, not for what you would rather not measure
- Escaping the `thresholds` values into constants in another file. The floor stops being settled by reading the configuration file, so this rule treats it as undeclared. Write the floor as a number where it is used
- Removing `perFile` to pass on the total. The files that fall short stay exactly as they were and only the number goes green. Which files fall short cannot be read off a total, so the moment it is removed, so is any answer to "what is left to do"
- Removing from the configuration only the metric you cannot meet. The removed metric is reported, and even if the report could be suppressed, nobody will notice however far that metric falls afterwards
- Silencing that one file with a suppression directive. The floor is an agreement across the whole repository, so an exemption per file is that agreement being voided
- Using the options to lower the repository's demand to the measured value to get through. The options settle what this repository demands; they are not for ratifying today's measurement. If it comes down, leave in the commit message when it goes back up

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
