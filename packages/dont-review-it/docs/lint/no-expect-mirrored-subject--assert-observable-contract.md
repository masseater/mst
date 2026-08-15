---
description: "Disallow writing the expression a fixture built the subject from as the expected value of an assertion, so a passing assertion states something about the code rather than that one expression evaluates to itself"
---

# no-expect-mirrored-subject--assert-observable-contract

<!-- BEGIN GENERATED rule-header -->

Disallow writing the expression a fixture built the subject from as the expected value of an assertion, so a passing assertion states something about the code rather than that one expression evaluates to itself

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-expect-mirrored-subject--assert-observable-contract.ts`](../../src/lint/oxlint/rules/no-expect-mirrored-subject--assert-observable-contract.ts)

<!-- END GENERATED rule-header -->

## Violation

An assertion whose expected value is the same expression the fixture built the subject from. Only a bare identifier handed to `expect(...)` is read as the subject, and the fixture is found through the declaration that identifier resolves to, so taking it under another name changes nothing. The matcher's name is not read.

The route from the fixture to the subject follows a returned expression, a local `const`, a value thrown directly inside a `try` and caught, and a call resolvable inside this file. The expected side follows bindings that hold one expression and receive no later assignment, without a cap on steps.

Comparison runs on the shape of the syntax tree, so formatting, parentheses, quote style, number notation, property order and shorthand fall away while identifiers, property names, callees and array order do not. An expected object that spreads the subject into itself is reported without waiting for the rest to match.

## Fix

Settle what the test claims and write the expected value from outside the construction expression: the concrete value the code has to produce, or a derived value the fixture hands back for comparison against a literal.

Where a stronger claim about the same subject already stands beside it, delete the assertion.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an object literal the fixture returns, written again as the expected value
// in report.test.ts
const test = baseTest.extend("report", () => ({ id: "a", total: 2 }));
test("carries both fields", ({ report }) => {
  expect(report).toStrictEqual({ id: "a", total: 2 });
});
```

```ts
// spreading the subject into the expected value pins only what is overridden
// in report.test.ts
const test = baseTest.extend("report", () => summarise());
test("marks itself settled", ({ report }) => {
  expect(report).toStrictEqual({ ...report, settled: true });
});
```

Code this rule accepts.

```ts
// an expected value the fixture never built stands on its own
// in report.test.ts
const test = baseTest.extend("report", () => summarise({ id: "a", total: 2 }));
test("counts what it was handed", ({ report }) => {
  expect(report).toStrictEqual({ id: "a", entries: 2 });
});
```

```ts
// an expected value built through another route is out of this reading
// in report.test.ts
const test = baseTest.extend("report", () => ({ id: "a" }));
test("carries the id", ({ report }) => {
  expect(report).toStrictEqual(storedReport());
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Changing indentation, quotes or property order. The comparison runs on the syntax tree
- Binding the expected value to a name first. Bindings are followed without a cap
- Switching to a partial matcher. The kind of matcher is not read

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `mirroredSubject` | An expected value must not repeat the expression the fixture \`{{subject}}\` built the subject from. Decide what this assertion claims about the code, then write the expected value from outside that expression: the concrete value the code has to produce, or a derived value the fixture hands back for comparison against a literal. Drop the assertion altogether where a stronger claim about the same subject already stands beside it. |
| `spreadSubject` | An expected value must not spread the subject into itself, leaving every key it does not override compared against itself. Write the whole expected value from outside the expression that built the fixture \`{{subject}}\`: the concrete value the code has to produce, or the overridden keys as derived values the fixture hands back for comparison against literals. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
