---
description: "Require a spec that derives tests from `standardIoTest` to pin both captured streams with a snapshot, so every change to what the command prints surfaces as a diff"
---

# require-standard-io-snapshot--pin-both-streams

<!-- BEGIN GENERATED rule-header -->

Require a spec that derives tests from `standardIoTest` to pin both captured streams with a snapshot, so every change to what the command prints surfaces as a diff

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`require-standard-io-snapshot--pin-both-streams.ts`](../../src/lint/oxlint/rules/require-standard-io-snapshot--pin-both-streams.ts)

<!-- END GENERATED rule-header -->

## Violation

A spec deriving tests from `standardIoTest` that leaves one of the two captured streams unpinned. Each of `stdout` and `stderr` is reported where no test takes it as a subject and pins it with an inline snapshot, directly or through a fixture that reads from it.

## Fix

Add a test taking that stream as its subject and pinning it with `toMatchInlineSnapshot()`, so every change to what the command prints surfaces as a diff.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// pinning stdout alone leaves stderr unpinned
import { standardIoTest } from "@mst/dont-review-it/vitest";
standardIoTest("pins stdout", ({ stdout }) => {
  expect(stdout.text).toMatchInlineSnapshot();
});
```

```ts
// a snapshot rooted at a binding unrelated to the streams pins neither of them
import { standardIoTest } from "@mst/dont-review-it/vitest";
standardIoTest("snapshots an unrelated subject", ({ stdout, stderr }) => {
  expect(buffer.text).toMatchInlineSnapshot();
});
```

Code this rule accepts.

```ts
// the stream bindings standing as the subjects pin both streams
import { standardIoTest } from "@mst/dont-review-it/vitest";
const it = standardIoTest.extend("theRun", { auto: true }, () => {
  runTheCli();
});
it("pins stdout", ({ stdout }) => {
  expect(stdout).toMatchInlineSnapshot();
});
it("pins stderr", ({ stderr }) => {
  expect(stderr).toMatchInlineSnapshot();
});
```

```ts
// a stream reached through a chain of fixtures still counts as pinned
import { standardIoTest } from "@mst/dont-review-it/vitest";
const it = standardIoTest
  .extend("theRun", ({ stdout }) => runTheCli(stdout))
  .extend("theOutcomeOfTheRun", ({ theRun }) => theRun.settle())
  .extend("theStandardErrorOfARun", ({ stderr }) => {
    runTheCli();
    return stderr.text();
  });
it("pins stdout through the chain", ({ theOutcomeOfTheRun }) => {
  expect(theOutcomeOfTheRun).toMatchInlineSnapshot();
});
it("pins stderr", ({ theStandardErrorOfARun }) => {
  expect(theStandardErrorOfARun).toMatchInlineSnapshot();
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Asserting the stream's text against a literal instead. What the command prints then moves without a diff to read
- Pinning one stream and leaving the other. Each is reported on its own

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `missingSnapshot` | A spec that derives tests from \`standardIoTest\` must not leave \`{{name}}\` unpinned. Add a test taking \`{{name}}\` as its subject and pinning it with \`toMatchInlineSnapshot()\`, or pin a fixture that reads from it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
