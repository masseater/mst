---
description: "Require the test config to keep the specification directory out of the coverage measurement, so the number a run reports is what the tests beside the sources reached rather than what the specifications happened to touch"
---

# require-spec-directory-outside-coverage--exclude-it-from-the-measurement

<!-- BEGIN GENERATED rule-header -->

Require the test config to keep the specification directory out of the coverage measurement, so the number a run reports is what the tests beside the sources reached rather than what the specifications happened to touch

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`require-spec-directory-outside-coverage--exclude-it-from-the-measurement.ts`](../../src/lint/oxlint/rules/testing/require-spec-directory-outside-coverage--exclude-it-from-the-measurement.ts)

<!-- END GENERATED rule-header -->

## Violation

A test config that measures coverage while the specification directory counts toward the measurement is rejected.

Two kinds of test stand in this repository and they answer for different things. A test beside its source secures coverage: it names the branches that source has to keep. A specification states a claim the package makes, and it reaches whatever code that claim happens to run through. When both count toward one number, the number stops saying what it appears to say. Code nothing checks directly reads as covered because a specification walked past it, and the missing check is discovered only when that specification is rewritten for an unrelated reason.

Keeping the specification directory out of the measurement makes the number answer one question: how much of this source the tests written for it reached.

The detection reads the exclusion list as it is written in the config. A list assembled behind an identifier, spread in from elsewhere, or built at run time cannot be read, and is reported as though the directory were absent from it.

## Fix

Put the specification directory in `test.coverage.exclude`, and secure the coverage it was carrying with tests beside the sources.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a coverage block without an exclusion list is reported
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { coverage: { thresholds: { 100: true, perFile: true } } } });

```

```ts
// an exclusion list that never names the specification directory is reported
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { coverage: { exclude: ["dist/**"], thresholds: { 100: true, perFile: true } } } });

```

Code this rule accepts.

```ts
// a coverage block leaving the specification directory out passes
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } } } });

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

Writing a specification whose only reason to exist is the coverage it produces is forbidden. The rule reads the config, not the tests, so it cannot see this, and a specification written for coverage states a claim the package does not make.

Lowering the coverage thresholds so the loss the exclusion reveals stops failing the run is forbidden. `no-lenient-coverage-threshold--demand-full-coverage` reports that separately.

Naming the specification directory in the exclusion list while pointing the specifications at another directory is forbidden. The list would carry the demanded pattern and measure the specifications all the same.

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unmeasuredCoverageExclusion` | A test config that measures coverage must not go without \`test.coverage.exclude\`. Add it and put \`{{pattern}}\` in it, then secure coverage with tests beside the sources. |
| `includedSpecDirectory` | The specification directory must not count toward the coverage measurement. \`{{pattern}}\` is absent from \`test.coverage.exclude\`. Add it, and cover the code from tests beside the sources instead. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
