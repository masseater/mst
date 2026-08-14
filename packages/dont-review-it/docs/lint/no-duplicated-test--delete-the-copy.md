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
- Shipped in the preset: yes
- Source: [`no-duplicated-test--delete-the-copy.ts`](../../src/lint/oxlint/rules/no-duplicated-test--delete-the-copy.ts)

<!-- END GENERATED rule-header -->

## Violation

Within one file, a test whose title and body are both spelled the same as another test standing under the same chain of `describe` blocks. Every match is reported.

Only a title written out as a string is read. A body is compared as syntax, with position information dropped. A form reaching the runner through a member, such as `test.only` or `test.each`, counts as long as the name at the root is `test` or `it`. `test.extend("cleanRun", ...)` declares a fixture rather than a test and is left alone.

The titles of the enclosing `describe` blocks are part of the identity. What a test pins is not settled by its title and body alone: where a fixture runs the code under test and hands back its whole output, the input lives in the fixture belonging to each `describe`, and the body of the `it` does nothing but compare against an expected value. Two situations expecting the same value come out spelled identically even while pinning different inputs. Judging on title and body without the enclosing blocks would make specs written that way report each other's distinct claims as copies.

Only one file is read at a time. A test spelled the same way in another file is left alone, because what a test calls differs from file to file and the same spelling can pin a different subject.

### The invariant

Test setup is allowed to look alike. Not sharing it keeps tests from coupling, so rewriting one never stops another from running. That is why [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) and [no-twin-declaration--merge-into-one-owner](./no-twin-declaration--merge-into-one-owner.md) hold test sources out of their reach.

Two tests in one file sharing both title and body are a different matter. The same subject is claimed twice in the same words, so one of them gets fixed and the other stays behind stating something that is no longer true. Which one to read when the suite goes red is not settled either. The number of tests grows while the behaviour being pinned does not.

Only a match on both title and body counts, because a match on one alone has forms that stand. Two tests sharing a body confirm different claims through the same steps. Two tests sharing a title confirm different things in the same words.

No option is offered.

## Fix

Keep the first one and delete the copies that follow.

If they were meant to confirm different things, then either the title or the body is actually different. Write that difference into the body.

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

- Rewriting the title alone and keeping both. The same body still stands in two places, and one of them still gets fixed while the other does not
- Adding a meaningless line to the body to shift its structure
- Moving the copy into another file. The judgment closes over one file, but where the subject is the same, two identical claims still stand

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
