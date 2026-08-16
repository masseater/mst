---
description: "Require every test data file to sit beside a spec of the same stem, so the data has one owner that reads it and leaves the repository with the test that gave it a reason to exist"
---

# require-spec-file-for-assets--create-matching-spec

<!-- BEGIN GENERATED rule-header -->

Require every test data file to sit beside a spec of the same stem, so the data has one owner that reads it and leaves the repository with the test that gave it a reason to exist

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`require-spec-file-for-assets--create-matching-spec.ts`](../../src/lint/oxlint/rules/testing/require-spec-file-for-assets--create-matching-spec.ts)

<!-- END GENERATED rule-header -->

## Violation

A test data file sitting in a directory that holds no spec of its own stem. A test data file is one named `<stem>.<marker>.<extension>`; the report names the spec file names that would own it.

`assetsNameMarkers` and `specFileSuffixes` settle the vocabulary; hand them the same values as the other rules that read test data.

## Fix

Write the spec that reads the file and name it after the stem the file already carries, or move the values into the spec that reads them and delete the file.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// test data with no spec of its stem anywhere
export const orderTotals = [1, 2];

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding a spec of that stem holding no test. `require-test-block-for-spec-file--add-test-or-delete-file` reports that
- Moving the data next to a spec of another stem. Ownership is the directory and the stem together

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unownedAssets` | A test data file must not sit in a directory that holds no spec of its own stem. Nothing named {{ownerNames}} sits beside it. Write the spec that reads this file and name it after the stem this file already carries, or move these values into the spec that reads them and delete this file. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
