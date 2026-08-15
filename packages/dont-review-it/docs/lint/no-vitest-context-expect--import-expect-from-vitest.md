---
description: "Disallow reading `expect` out of the context a test block hands its callback, so every assertion in the suite runs through the one `expect` the file imported from the test runner"
---

# no-vitest-context-expect--import-expect-from-vitest

<!-- BEGIN GENERATED rule-header -->

Disallow reading `expect` out of the context a test block hands its callback, so every assertion in the suite runs through the one `expect` the file imported from the test runner

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-vitest-context-expect--import-expect-from-vitest.ts`](../../src/lint/oxlint/rules/no-vitest-context-expect--import-expect-from-vitest.ts)

<!-- END GENERATED rule-header -->

## Violation

`expect` read out of the context a test block hands its callback, either taken in the parameter pattern or reached off the context inside the body.

## Fix

Import `expect` from the test runner and call that binding, leaving the callback parameter holding only the fixtures the test uses.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// taking expect out of the context is reported
it("names a behaviour", ({ expect }) => {
  expect(runSut()).toBe(1);
});
```

```ts
// reaching expect through the context binding is reported
it("names a behaviour", (ctx) => {
  ctx.expect(runSut()).toBe(1);
});
```

Code this rule accepts.

```ts
// asserting through the imported binding passes
import { expect } from "vitest";
it("names a behaviour", ({ subject }) => {
  expect(subject).toBe(1);
});
```

```ts
// taking fixtures apart by name passes
it("names a behaviour", ({ subject, options }) => {});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the destructured key so the name no longer reads as `expect`. The assertion still runs through the context's entry
- Binding the context as a whole and reaching `expect` off it. `no-test-context-escape--destructure-fixtures-by-name` reports that shape too

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `destructuredContextExpect` | A test callback must not take \`expect\` out of the test context. Import \`expect\` from the test runner and leave the callback parameter holding only the fixtures this test uses. |
| `reachedContextExpect` | A test callback must not reach \`expect\` through the test context. Import \`expect\` from the test runner and call that binding. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
