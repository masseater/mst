---
description: "Disallow a test that another test in the same file spells with the same title and the same body, so one behaviour keeps one place that pins it"
---

# no-duplicated-test--delete-the-copy

<!-- BEGIN GENERATED rule-header -->

Disallow a test that another test in the same file spells with the same title and the same body, so one behaviour keeps one place that pins it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `testing`
- Source: [`no-duplicated-test--delete-the-copy.ts`](../../src/lint/oxlint/rules/testing/no-duplicated-test--delete-the-copy.ts)

<!-- END GENERATED rule-header -->

## Violation

Within one file, a test whose title and body are both spelled as another test's under the same chain of `describe` titles. Every test in the group is reported, not just the later one.

Only a title written out as a string is read, and the body is compared as syntax with positions dropped. A modifier form such as `test.only` or `test.each` counts as long as the root name is `test` or `it`; `test.extend(...)` declares a fixture and is left alone. Only one file is read at a time.

## Fix

Keep the first and delete the copies. Where they were meant to confirm different things, write that difference into the title or the body.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// two tests that share both title and body are both reported
// in /repository/packages/dont-review-it/src/subject.test.ts
test("counts one", () => {
  expect(total).toBe(1);
});
test("counts one", () => {
  expect(total).toBe(1);
});
```

```ts
// a runner reached through a modifier is compared with the plain one
// in /repository/packages/dont-review-it/src/subject.test.ts
test("counts one", () => {
  expect(total).toBe(1);
});
test.only("counts one", () => {
  expect(total).toBe(1);
});
```

Code this rule accepts.

```ts
// two tests that share only their body pass
// in /repository/packages/dont-review-it/src/subject.test.ts
test("counts one", () => {
  expect(total).toBe(1);
});
it("counts the same total", () => {
  expect(total).toBe(1);
});
```

```ts
// two tests that share only their title pass
// in /repository/packages/dont-review-it/src/subject.test.ts
test("counts one", () => {
  expect(total).toBe(1);
});
test("counts one", () => {
  expect(other).toBe(1);
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Rewriting the title alone and keeping both bodies. One of them still gets fixed while the other does not
- Adding a meaningless line to shift the body's structure
- Moving the copy into another file. Two identical claims about the same subject still stand

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `duplicatedTest` | A test must not carry both the title and the body of another test in this file. Delete the \`{{title}}\` that starts on line {{line}}. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
