---
description: "Disallow a test config that lets a run finding no test file report success, so a suite that stopped being collected reaches the gate as a failure instead of as a green run"
---

# no-vacuous-test-run--let-the-empty-run-fail

<!-- BEGIN GENERATED rule-header -->

Disallow a test config that lets a run finding no test file report success, so a suite that stopped being collected reaches the gate as a failure instead of as a green run

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-vacuous-test-run--let-the-empty-run-fail.ts`](../../src/lint/oxlint/rules/no-vacuous-test-run--let-the-empty-run-fail.ts)

<!-- END GENERATED rule-header -->

## Violation

A test runner configuration carrying a declaration that lets a run finding no test file end in success.

Only files whose name starts with `vite.config` or `vitest.config` and whose extension is one of `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs` are read. Nothing else is looked at. The set of file names used for that judgment is shared with [no-lenient-coverage-threshold--demand-full-coverage](./no-lenient-coverage-threshold--demand-full-coverage.md), which demands a coverage floor, so what counts as a test configuration never drifts apart between the two.

What is read is the expression the file default-exports. Where it is wrapped in a call such as `defineConfig({ ... })`, the first argument is entered. From there the `test` object literal is entered, and the `passWithNoTests` property alone is read.

There are two reports.

Where `passWithNoTests` is `true`, that property is reported. That is the declaration telling Vitest to end in success with zero test files.

Where `passWithNoTests` is something other than `false` whose value cannot be read from this file alone, the same property is reported. A reference to a variable, shorthand, an expression evaluated at run time and a non-boolean literal all land here. With the value living outside the configuration file, reading that file settles nothing about which way an empty run falls.

`passWithNoTests: false` passes. It is the same as the default, and it is a writer stating outright that an empty run counts as a failure, which is the state this rule asks for. The property being absent passes as well.

A configuration the `test` block cannot be entered from is not reported at all: no default export, a default export pointing at a variable, a `test` that is not an object literal. Reporting an unreadable configuration already belongs to the rule demanding a coverage floor over the same file. Two rules reporting the same unreadability would put two fixes side by side for one cause.

A key of the same name outside `test` is not read. Vitest reads this choice under `test` alone, and the same spelling elsewhere is a different setting.

### The invariant

The first layer is that this declaration makes a run where no test ran and a run where every test passed come out the same. A gate reads the exit status alone, so the two are not told apart. When `vp run -r test` comes back green, nothing about what was actually confirmed in that workspace can be read from the status.

The second layer is the route this declaration typically arrives by: the run failed, so it was stopped. An empty run fails when no test was collected, and the cause is either that no test was written or that the collection settings were broken. Both are fixed in the tests and the collection, not in the configuration. `passWithNoTests: true` is the shortest line that clears the red without touching either, and what the red was cannot be recovered afterwards.

The third layer is that this declaration permanently removes the chance of noticing that collection broke. Even in a workspace where tests really exist, a change to a glob or to `include` can drop files out of collection. Without the declaration the next run fails immediately; with it, the tests reaching zero passes as a green run. A failing test gets fixed by somebody; a test that stopped running is noticed by nobody.

The fourth layer is that this declaration spreads easily through a repository. Allowing an empty run in one workspace writes the premise "a workspace may carry no tests" into the configuration, and the next person adding a workspace copies it as the established practice. Packages without tests can multiply while the gate stays green, so the multiplying shows up nowhere.

"A check that did not run is not counted as a success" is a norm [the enforcement guideline](../../../../docs/guidelines/enforcement.md) already carries, and this rule is what enforces it over the test runner's configuration.

### Configuration

None. There is no workspace where an empty run may count as a success, so there is no axis to loosen.

Tests being present is not required. This rule reads the declaration in the configuration file alone, and whether test files exist cannot be told without reading the file system. Judging the declaration and the reality in one rule would leave both violations controllable only through one setting.

## Fix

Delete `passWithNoTests` from the configuration, then fix what made the run empty.

Where no test was written, write one. Pick one behaviour the workspace publishes whose breaking would break another workspace, and place one test claiming it. One is enough to make the run non-empty, and from there the coverage floor demands the rest.

Where tests are written but not collected, fix the collection. Check that where test files sit and how they are spelled match what the runner looks for. In this repository tests sit in the same directory as the source they test, so check that the collection range covers the source tree.

Where the workspace should carry no tests, what to remove is the test run itself. Dropping the `test` script from the manifest states outright that the workspace runs no tests, and nothing has to count an empty run as a success. Allowing it by declaration says "this runs tests" and "it need not run" at once, and the configuration cannot say which is true.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a run told to pass when it found no test file is reported
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { passWithNoTests: true } });
```

```ts
// the outcome handed over by a binding is reported
// in vite.config.ts
import { passWithNoTests } from "./shared.ts";
export default { test: { passWithNoTests } };
```

Code this rule accepts.

```ts
// an empty run spelled out as a failure passes
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { passWithNoTests: false } });
```

```ts
// the same key outside the test block is not the option the run reads
// in vite.config.ts
export default { passWithNoTests: true, test: {} };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Passing `--passWithNoTests` on the command line for the same effect. This rule reads configuration files alone, so it is not detected, while nothing changes about an empty run coming out green. Worse, invocations are scattered across the manifest, the CI definition and shell history, which makes "since when has it been like this" harder to trace than writing it in the configuration
- Escaping the value into a constant in another file or an environment variable. This rule reports anything whose value is not settled in this file, so this shape is detected. Even were a spelling found that escapes detection, the configuration file still cannot say which way an empty run falls
- Placing an empty test file to make the run non-empty. One file is collected so the run stops failing, while the behaviours being confirmed stay at zero. A test file with no test block, and a test block with no claim, are each reported by another rule
- Moving it inside `test.projects` to hide the name. Vitest reads this choice outside the projects only, so the declaration does nothing where it landed. A declaration that does nothing reads, to whoever comes next, as "empty runs are allowed"
- Taking the test run out of the gate to clear the red. A check that does not run sees even less than an empty one. How something joins the gate belongs to [the enforcement guideline](../../../../docs/guidelines/enforcement.md)
- Silencing that one file with a suppression directive. Not counting an empty run as a success is an agreement across the whole repository, so an exemption per file is that agreement being voided

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `vacuousTestRun` | A test config must not let a run that found no test file report success. Delete \`passWithNoTests\` from the test config. |
| `unsettledEmptyRunOutcome` | A test config must not spell \`passWithNoTests\` as a value other than \`false\`. Delete \`passWithNoTests\` from the test config. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
