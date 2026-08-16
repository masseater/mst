---
description: "Disallow a lint suppression comment in the files these rules run on, so a report ends in a repair to the code or a repair to the rule and never in a comment that takes the report away"
---

# no-lint-suppression-in-spec--fix-the-violation

<!-- BEGIN GENERATED rule-header -->

Disallow a lint suppression comment in the files these rules run on, so a report ends in a repair to the code or a repair to the rule and never in a comment that takes the report away

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: no
- Bundle: `testing`
- Source: [`no-lint-suppression-in-spec--fix-the-violation.ts`](../../src/lint/oxlint/rules/testing/no-lint-suppression-in-spec--fix-the-violation.ts)

<!-- END GENERATED rule-header -->

## Violation

A comment whose first token directs a lint suppression: the line, next-line and whole-file spellings of the `eslint-` and `oxlint-` families, and the `-enable` spelling that closes a range. Whether rule names are listed, whether grounds follow `--`, and whether the suppression actually silences anything are none of them conditions.

A direction to the type checker, the `mock-factory-exemption` registration and prose that merely names a spelling past the first token are all left alone. No filtering by file kind is done; which files this reaches is settled by the shared lint configuration.

An automatic fix deletes the comment.

## Fix

Fix the violation being reported. Where the report is wrong, fix what the rule detects. Those two are the only ways a report ends.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// grounds written after the separator leave the suppression standing
// oxlint-disable-next-line forbid-weak-matcher--use-exact-matcher -- the matcher reads a floating clock
it("adds", () => {
  expect(runSut()).toBe(3);
});
```

```ts
// the closing end of a suppression range is reported on its own
it("adds", () => {
  expect(runSut()).toBe(3);
});
/* oxlint-enable forbid-weak-matcher--use-exact-matcher */
```

Code this rule accepts.

```ts
// a line direction to the type checker is not a lint suppression
// @ts-ignore the parse rejects this shape
const row = readRow(1);
```

```ts
// prose naming a directive spelling past the opening token passes
// this spec used to carry an oxlint-disable comment
it("adds", () => {
  expect(runSut()).toBe(3);
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Naming no rule, or writing grounds after `--`. Neither is a condition of detection
- Removing only the opening of a range. The closing comment is reported on its own
- Moving the suppression into a per-file exclusion in the configuration. `require-spec-lint-coverage--lint-every-spec-file` fails it where it lands

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `namedSuppression` | A \`{{spelling}}\` comment must not stay in this file. It takes away what {{silenced}} reports. Delete the comment, then rewrite the code that report stands on, or narrow what that rule detects. Nothing else settles a report. |
| `blanketSuppression` | A \`{{spelling}}\` comment naming no rule must not stay in this file. It takes away what {{silenced}} reports. Delete the comment, then rewrite the code those reports stand on, or narrow what those rules detect. Nothing else settles a report. |
| `suppressionRangeEnd` | A \`{{spelling}}\` comment must not stay in this file. It closes the range a suppression comment opens. Delete both ends of that range, then rewrite the code the reopened reports stand on, or narrow what those rules detect. Nothing else settles a report. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
