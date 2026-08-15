---
description: "Require a file named as a spec to declare at least one test block that runs, so naming a file a spec costs a check that actually executes rather than buying the standing of a spec for free"
---

# require-test-block-for-spec-file--add-test-or-delete-file

<!-- BEGIN GENERATED rule-header -->

Require a file named as a spec to declare at least one test block that runs, so naming a file a spec costs a check that actually executes rather than buying the standing of a spec for free

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`require-test-block-for-spec-file--add-test-or-delete-file.ts`](../../src/lint/oxlint/rules/testing/require-test-block-for-spec-file--add-test-or-delete-file.ts)

<!-- END GENERATED rule-header -->

## Violation

A file named as a spec that declares no test block that runs. Three reports: no block at all, grouping blocks alone, and every block held back — marked as skipped or as todo, standing without a body, or driven by a table written out empty.

`specFileSuffixes` settles which names are read as specs.

## Fix

Write the block that checks what the subject is expected to do, or delete the file together with the test data named after its stem.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a file with nothing in it names a spec that checks nothing
// in report.test.ts

```

```ts
// blocks marked as skipped run nothing
// in report.test.ts
it.skip("carries the id", () => {
  expect(summarise("a").id).toBe("a");
});
```

Code this rule accepts.

```ts
// a block that runs carries the file
// in report.test.ts
it("carries the id", ({ report }) => {
  expect(report.id).toBe("a");
});
```

```ts
// one block that runs is enough, however many are held back beside it
// in report.test.ts
it.skip("carries the id", () => {});
it.todo("carries the total");
it("carries the name", ({ report }) => {
  expect(report.name).toBe("a");
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Leaving a group in place of the block it promises. A group checks nothing of its own
- Marking every block as skipped or as todo and keeping the file's standing as a spec

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `noTestBlock` | A file named as a spec must not stand without a test block that runs. This one declares no block at all. Write the block that checks what the subject is expected to do, or delete this file together with the test data named after its stem. |
| `onlyGroupingBlocks` | A file named as a spec must not stand on grouping blocks alone. The groups here hold no test block, and a group checks nothing of its own. Write the block each group promises, or delete this file together with the test data named after its stem. |
| `heldBackTestBlocks` | A file named as a spec must not stand on test blocks that are all held back. Every block here is marked as skipped or as todo, left standing without a body, or driven by a table written out empty. Write a block that runs, or delete this file together with the test data named after its stem. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
