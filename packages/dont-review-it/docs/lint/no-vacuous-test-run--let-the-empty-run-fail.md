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
- Bundle: `testing`
- Source: [`no-vacuous-test-run--let-the-empty-run-fail.ts`](../../src/lint/oxlint/rules/testing/no-vacuous-test-run--let-the-empty-run-fail.ts)

<!-- END GENERATED rule-header -->

## Violation

A test configuration that lets a run finding no test file report success. `passWithNoTests` standing at any value is reported, and a value this rule cannot read as `false` is reported as its own shape.

## Fix

Delete `passWithNoTests` from the test config, so a suite that stopped being collected reaches the gate as a failure.

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

- Writing the value behind a variable so it cannot be read. That shape is reported on its own
- Passing the flag on the command line instead. The configuration then says nothing about it

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
