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

A test runner configuration (`vite.config.*`, `vitest.config.*`) whose `test` block does not declare `mockReset` and `restoreMocks` as `true`.

The judgment is settled by reading one file. The default export is followed, the argument is opened where it is wrapped in a call such as `defineConfig(...)`, and the two values under `test` are read. Only boolean literals count as declarations: a variable reference or a spread does not settle what goes in from reading that file, so it counts as undeclared.

A configuration with no `test` block is reported as well. In this repository a workspace carrying a configuration file is a workspace that runs tests, and not writing `test` has the same result as not declaring the isolation.

A key is read the same whether it is an identifier or a string literal, and where the same key is written twice the later one wins.

Nothing but configuration files is read. A file whose name merely ends in a configuration file's name (`legacy-vite.config.ts`) is out of reach.

### The invariant

A double one test set up does not survive into the next.

The test runner does not put anything back unless told to. A swapped implementation and an accumulated call record both carry straight into the next test in the same file. A test that passes on top of inherited state is green on a premise it did not set up itself. It fails the moment the order changes or the neighbouring test is deleted, and when that happens is invisible to whoever wrote it.

The rules constraining how doubles are used stand on this setting being in place. The document for `no-vi-mock-factory-behavior--use-spy-true-and-fixture` declares that premise itself, saying the vessel is built once at load while the shared setting clears the call record and the implementation before each test, so nothing carries between tests. `no-redundant-mock-reset--lift-mocks-into-fixture` forbids individual reset calls for the same reason: the shared setting already does it. With the premise missing and only those two in force, the state is "do not put anything back individually" while nothing puts anything back at all.

And the absence does not show in the test results. Everything stays green, piling up on an unchecked premise. That is the shape this repository dislikes most.

### Why every configuration file writes it

A `test` block written in the root `vite.config.ts` does not propagate to a workspace's run, as [EDR 0017](../../../../docs/engineering-decision-logs/0017-demand-full-coverage-in-every-test-config.md) confirmed by measurement. For the same reason the coverage floor is written into every configuration file, these two are declared by each configuration file itself.

Handing them out from a preset function, as `lint` and `fmt` are, is not available. Doing so would require the consumer to carry `@mst/dont-review-it` as a workspace dependency, and the task graph then cycles in both directions — through the packages `dont-review-it` depends on, and through `@mst/ai-native`, which every package including `dont-review-it` depends on. That is an upstream defect ([vite-task#411](https://github.com/voidzero-dev/vite-task/issues/411), fixed in [vite-task#414](https://github.com/voidzero-dev/vite-task/pull/414)), and [EDR 0042](../../../../docs/engineering-decision-logs/0042-apply-one-preset-at-the-root-and-report-the-exception-the-toolchain-forces.md) settles that package structure is not permanently rearranged to dodge a temporary defect with a fix upstream.

The copying is accepted knowingly: the rule carries the demanded values and the configuration files say only that the demand is met. When the values change, the rule turns every configuration file red at once.

### What is not a violation

- Files that are not configuration files
- A file whose name merely ends in a configuration file's name
- Declaring both and adding whatever a particular test setup needs inside `test`

### Configuration

None. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

The only judgment this rule carries is whether both are declared `true`. Making one of them switchable would mean a configuration could be written where the state of the switched-off side survives between tests.

## Fix

Put the two in the `test` block.

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    coverage: {
      thresholds: { 100: true, perFile: true },
    },
  },
});
```

`mockReset` drops the call record and returns the implementation before each test. `restoreMocks` removes the spy that was inserted and returns the subject to what it was. The two act on different things, so one alone does not amount to putting things back.

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

- Putting things back every time inside a shared setup file. Reading the configuration file stops settling whether the isolation is in force, and the judgment stops closing over one file
- Pouring the values in from outside through a variable or a spread. That is not accepted as a declaration
- Deleting the `test` block entirely. A configuration with no block is reported too
- A suppression directive

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
