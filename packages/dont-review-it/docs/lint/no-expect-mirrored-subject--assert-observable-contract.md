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

An assertion in a spec file of the shape `expect(subject).matcher(expected)` where the expression the fixture that produced `subject` built it from, and `expected`, are the same expression.

The spec files in scope are, by default, those whose names end in `.test.ts` or `.test.tsx`. Replaceable through the options.

Only a bare identifier handed to `expect` is read as the subject. Modifiers (`not`, `resolves`, `rejects`) and derived receivers (`expect.soft`, `expect.poll`) are peeled before the root is confirmed. The matcher's name is not read: an exact match, a partial match and a matcher of your own are treated alike.

The fixture is looked up by the declaration the identifier resolves to rather than by its spelling. Take the test body's parameter under another name with `({ report: summary })` and the binding's declaration still leads to the `report` fixture. Where the same spelling names a different fixture in another test body, each resolves to its own binding, so they are not mixed up.

The route from the fixture to the subject follows these.

- Returning the expression as it stands
- Binding to a local `const` and returning that
- Throwing directly inside a `try` block and returning what the `catch` received
- Building it through a function run on the spot
- Going through a helper call resolvable inside this file
- Both notations: the named builder form, and the older object form where it is handed to an argument for passing along

The expected side follows bindings under the same conditions. What is followed is a name with exactly one declaration, where that declaration gives the identifier an expression, and which receives no assignment beyond its initialization. No cap is placed on the number of steps: one step or many, the report stands where the expression reached is the same. Binding resolution runs on scope, so the same spelling in another scope does not get mixed in.

Comparison runs on the shape of the syntax tree rather than on strings. These notational differences are absorbed.

- Whitespace, newlines and indentation
- Parentheses
- The kind of quote (including a template literal carrying no substitution)
- Number notation (`2`, `2.0`, `0x2`)
- The order an object's properties are written in
- A trailing comma
- Property shorthand
- Type assertions, `satisfies`, non-null assertions, optional chains and `await`

Identifiers, property names, callees and the order of array elements are not normalized. Align those and an expected value that wrote a different value would be reported as the same thing.

Where the expected value is an object spreading the subject, the report stands without waiting for the expressions to match. Every key except the overridden ones is compared against itself, so in effect only the overrides are pinned. That shape gets a message of its own.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `expect(report.id).toStrictEqual(...)` | The subject is not a bare identifier. [no-expect-projected-subject--use-tostrictequal-on-subject](./no-expect-projected-subject--use-tostrictequal-on-subject.md) stops it |
| A matcher taking no argument | There is nothing to compare against. A matcher's weakness belongs to [forbid-weak-matcher--use-exact-matcher](./forbid-weak-matcher--use-exact-matcher.md) |
| An exception thrown by an inner function inside the `try` | Only a `throw` directly under the `try` is picked up, so that a test verifying propagation itself is not swept in |
| An expected value of different syntax evaluating to the same value at run time | Whether values are equal is not settled without evaluating. Notational differences are absorbed by normalizing the syntax tree, so what is left here is where the construction steps really differ |
| A fixture declared in another file | It does not close inside one file's syntax, so this lint rule's check does not reach |
| A name assigned another expression after initialization | That name cannot be said to stand for one expression, so it is not followed |
| A name taken out by destructuring | It is not the extraction source's expression itself, so it is not followed |

### The invariant

The expected value is written independently of the expression the fixture built the subject from.

The first layer is what the assertion shows. Where the fixture returns some construction expression and the test writes the same construction expression as the expected value, passing shows only that "evaluating the same expression twice gives equal values". Computed fields, validation, derived properties and identity through a generator are none of them pinned.

The second layer is how it looks. The expected value has concrete values written in it, so it reads as a thorough test. It actually fails only where evaluating the expression is non-deterministic (a clock, a random number, shared state, a side effect) or where only one side threw. It does not fail on an error in the code. The test count moves and the coverage number moves, while the assertion that should fail when something breaks does not.

Tighten "how much of a match is demanded" in the other rules of this bundle and, as long as the same expression is written on both sides, the strength of the demand means nothing. Forcing an exact match becomes, in itself, a way to build an assertion that passes unconditionally.

### Configuration

`specFileSuffixes` alone. It replaces the file name suffixes this check applies to, from the default `.test.ts` and `.test.tsx`. Pass the same value as the other rules of the bundle. Split the range per rule and a user can no longer follow which check is running on which file.

## Fix

Settle what the test actually wants to claim, and write the expected value from outside the construction expression.

Where a stronger claim (verifying behaviour, verifying a generated value) already stands in the same `describe`, delete the test. "The argument handed in is in there as it was" follows from the language's semantics and often does not warrant a test of its own.

Where the claim is about a derived value (a flag, a computed field), have the fixture return that derived value itself and compare it with a literal. The fixture returns exactly what you want to observe, and the test body holds one assertion.

```ts
const test = baseTest.extend("entries", () => summarise(rows).entries);

test("counts what it was handed", ({ entries }) => {
  expect(entries).toBe(2);
});
```

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

- **Changing the expected value's indentation or line breaks.** The comparison runs on the shape of the syntax tree, so changing only the notation leaves the same expression
- **Binding the expected value to a variable first.** Bindings are followed without a cap on the number of steps
- **Taking the subject under another name by destructuring.** The fixture is looked up by the declaration the name resolves to, not by spelling
- **Rewriting as `expect(subject.field)`.** That lands on `no-expect-projected-subject--use-tostrictequal-on-subject`
- **Changing the matcher to a partial match or one of your own.** The kind of matcher is not read
- **Leaving the fixture constructing the subject inline and only shifting the expected value.** Construction on the fixture side is read by another rule. A fixture returns the value the subject under test produced; it is not a place to build the subject from a literal or a constructor call
- **Moving the fixture to another file.** This lint rule reads only one file's syntax so the report clears, but the expected value is still a copy of the construction expression. Cross-file reconciliation is the verification command's territory, and no check currently reads this shape
- **A suppression directive**

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
