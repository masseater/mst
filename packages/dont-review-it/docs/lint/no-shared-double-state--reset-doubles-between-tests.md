---
description: "Require the test config to declare that doubles are reset and restored before each test, so a spec that passes on the state its neighbour installed is impossible rather than merely unlikely"
---

# no-shared-double-state--reset-doubles-between-tests

<!-- BEGIN GENERATED rule-header -->

Require the test config to declare that doubles are reset and restored before each test, so a spec that passes on the state its neighbour installed is impossible rather than merely unlikely

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-shared-double-state--reset-doubles-between-tests.ts`](../../src/lint/oxlint/rules/no-shared-double-state--reset-doubles-between-tests.ts)

<!-- END GENERATED rule-header -->

## Violation

A test runner configuration that does not declare `mockReset` and `restoreMocks` as `true` inside `test`. A configuration with no `test` block at all is reported once; otherwise each of the two settings is reported where it is missing or not `true`.

Only `vite.config` and `vitest.config` files are read.

## Fix

Declare both settings in the `test` block.

```ts
export default defineConfig({ test: { mockReset: true, restoreMocks: true } });
```

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a config that declares no test block is reported once
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ lint: {} });

```

```ts
// a setting declared false is reported where it stands
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { mockReset: false, restoreMocks: true } });

```

Code this rule accepts.

```ts
// the settings declared beside the rest of the test options pass
// in vite.config.ts
import { defineConfig } from "vite-plus";
export default defineConfig({ test: { mockReset: true, restoreMocks: true, coverage: { thresholds: { 100: true, perFile: true } } } });

```

```ts
// a vitest config outside a vite-plus setup is held to the same demand
// in vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { mockReset: true, restoreMocks: true } });

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Resetting the doubles by hand in the specs instead. `no-redundant-mock-reset--lift-mocks-into-fixture` reports that
- Deleting the `test` block. The same demand comes back as the missing-block report

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `missingTestBlock` | A test config must not leave the doubles a test installs standing for the next test. \`{{path}}\` is absent from this config, so nothing takes them down. Add it and declare {{settings}} as \`true\`. |
| `sharedDoubleState` | A double installed by one test must not be left standing for the next one. \`{{setting}}\` is not declared \`true\` in \`test\`, so the call records and the implementations one test set are what the next test starts from. Declare \`{{setting}}: true\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
