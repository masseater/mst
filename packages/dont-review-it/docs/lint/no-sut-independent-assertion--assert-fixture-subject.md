---
description: "Disallow an assertion whose operands never went through the code under test, so a passing assertion states something the code has to keep true rather than something the spec compared with itself"
---

# no-sut-independent-assertion--assert-fixture-subject

<!-- BEGIN GENERATED rule-header -->

Disallow an assertion whose operands never went through the code under test, so a passing assertion states something the code has to keep true rather than something the spec compared with itself

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`no-sut-independent-assertion--assert-fixture-subject.ts`](../../src/lint/oxlint/rules/testing/no-sut-independent-assertion--assert-fixture-subject.ts)

<!-- END GENERATED rule-header -->

## Violation

An assertion whose operands never went through the code under test. Two reports: one where every value it reads is written in the spec itself, so the assertion lands the same way whatever the code becomes; and one where both sides reach the same subject, which passes for that reason alone and, behind `not`, fails for it.

`specFileSuffixes` settles which files are specs.

## Fix

Assert the subject a fixture hands back against the value the code has to produce.

Where the block has nothing to pin, delete it rather than giving it an assertion.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a written-out value compared against a written-out value asks nothing of the code
// in report.test.ts
test("holds", () => {
  expect(true).toBe(true);
});
```

```ts
// a subject compared against itself lands the same way whatever the code does
// in report.test.ts
test("carries the id", ({ report }) => {
  expect(report).toStrictEqual(report);
});
```

Code this rule accepts.

```ts
// a subject the fixture handed over is compared against a value written in the spec
// in report.test.ts
test("carries the id", ({ report }) => {
  expect(report).toStrictEqual({ id: "a" });
});
```

```ts
// a written-out subject compared against a value from the code still turns on the code
// in report.test.ts
test("carries the id", ({ report }) => {
  expect("a").toBe(report.id);
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Putting a `not` in front of a self-comparison. That only turns a report about always passing into one about always failing
- Binding the spec's own value to a name first and comparing the names

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `sutIndependentAssertion` | An assertion must not compare values that never reached the code under test. Every value this one reads is written in the spec itself, and it lands the same way whatever the code is changed to. Assert the subject a fixture hands back against the value the code has to produce. Delete the \`it\` that has nothing to pin instead of adding an assertion to it. |
| `selfComparedSubject` | An assertion must not compare a value against itself. Both sides of this one reach \`{{subject}}\`, and a \`not\` in front only turns it into an assertion that always fails. Write the expected value out in the spec beside the subject the fixture hands back. Delete the \`it\` that has nothing to pin. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
