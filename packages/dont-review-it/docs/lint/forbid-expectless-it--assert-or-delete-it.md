---
description: "Disallow a test block whose body carries no assertion, so a passing run only ever means the claims written in the blocks held"
---

# forbid-expectless-it--assert-or-delete-it

<!-- BEGIN GENERATED rule-header -->

Disallow a test block whose body carries no assertion, so a passing run only ever means the claims written in the blocks held

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`forbid-expectless-it--assert-or-delete-it.ts`](../../src/lint/oxlint/rules/testing/forbid-expectless-it--assert-or-delete-it.ts)

<!-- END GENERATED rule-header -->

## Violation

A test block whose own body carries no assertion. Every assertion call in the file is attributed to the innermost test block that encloses it, so a block holding only calls into a helper, a fixture or another block claims nothing and is reported.

Test blocks are recognised through the names the runner hands over, including one derived through `test.extend(...)`. The files in scope are settled by `specFileSuffixes`, which defaults to `.test.ts` and `.test.tsx`.

## Fix

Write, in the block's own body, the claim its name promises about the subject the fixture hands over. Where there is no claim to write, delete the block.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// declaring how many assertions the block carries is no claim
// in report.test.ts
it("carries the id", () => {
  expect.assertions(1);
});
it("carries the total", () => {
  expect.hasAssertions();
});
```

```ts
// a claim parked in a helper leaves the block claiming nothing
// in report.test.ts
const expectShape = (subject) => {
  expect(subject.id).toBe("a");
};
it("carries the shape", ({ report }) => {
  expectShape(report);
});
```

Code this rule accepts.

```ts
// a block that pins its subject writes the claim its name promises
// in report.test.ts
it("carries what it summarised", ({ report }) => {
  expect(report).toStrictEqual({ id: "a", total: 2 });
});
```

```ts
// a claim written inside a callback of the block stands in the block
// in report.test.ts
it("carries every row", ({ rows }) => {
  rows.forEach((row) => {
    expect(row).toBe("a");
  });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Declaring how many assertions the block carries. A count claims nothing about the subject
- Moving the assertion into a helper or a fixture the block reaches. Attribution runs on the innermost enclosing block
- Marking the block as skipped, as todo, or as expected to fail. None of those settles the claim

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `expectlessIt` | A test block must not stand without an assertion written in its own body. This block claims nothing and passes on every run, while the report lists its name among the behaviours a suite checked. Write the claim the name promises about the subject the fixture hands over, or delete the block. A declaration of how many assertions the block carries claims nothing and does not count here, and neither does an assertion parked in a helper or a fixture this block reaches. Marking the block as skipped, as todo or as expected to fail does not settle the claim either. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
