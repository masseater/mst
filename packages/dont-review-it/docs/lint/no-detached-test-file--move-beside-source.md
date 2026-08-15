---
description: "Require a test file to sit in the directory of the source it tests under that source's name, so the pair is tied together by the path and a test cannot be left behind when its source moves"
---

# no-detached-test-file--move-beside-source

<!-- BEGIN GENERATED rule-header -->

Require a test file to sit in the directory of the source it tests under that source's name, so the pair is tied together by the path and a test cannot be left behind when its source moves

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-detached-test-file--move-beside-source.ts`](../../src/lint/oxlint/rules/no-detached-test-file--move-beside-source.ts)

<!-- END GENERATED rule-header -->

## Violation

Two things are read of every file whose name ends in a test suffix.

- Whether the source it names exists in the same directory. The source name is the suffix dropped and that suffix's extension put back, so `widget.test.tsx` looks for `widget.tsx` alone. Nothing there is the main report, and it covers both a test parked elsewhere and a test whose subject is gone
- Whether a directory named `test`, `tests`, `__tests__` or `spec` stands anywhere on the path. This is read only when the source does exist, and it catches the source being moved into the test tree as well

`testFileSuffixes` adds to the defaults `.test.ts`, `.test.tsx`, `.spec.ts` and `.spec.tsx` rather than replacing them, and the longest matching suffix wins. `exemptPaths` holds runs of path segments matched on segment boundaries.

## Fix

Move the test into the directory of the source it tests and name it after that source. Where the subject is gone, find the module that now owns the behaviour and fold the test into that module's test, or delete it.

Where the secondary report stands, the implementation moves too: return it among the modules that use it and take the test along.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a test file parked in an isolation directory is reported
export const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Placing an empty file at the expected path. Existence is all that is read, and what is left is a test with no subject
- Renaming the test out of the suffix vocabulary. Only the detection stops
- Widening `exemptPaths` until it swallows a tree. Keep an entry narrow enough to settle by reading it

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `detachedTestFile` | A test file must not sit apart from the source it tests. Nothing exists at \`{{sourcePath}}\`. Move this file into the directory of the source it tests and name it after that source. |
| `testOnlyDirectory` | A test file must not sit under a directory that exists only to hold tests. This file sits under \`{{directory}}\`. Move the source it tests back among the modules that use it, and move this file with it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
