---
description: "Disallow producing the subject of an assertion inside `expect`, so an assertion states a property of a value the fixture handed over rather than the outcome of an expression the assertion itself runs"
---

# no-expect-call-expression--yield-from-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow producing the subject of an assertion inside `expect`, so an assertion states a property of a value the fixture handed over rather than the outcome of an expression the assertion itself runs

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `testing`
- Source: [`no-expect-call-expression--yield-from-fixture.ts`](../../src/lint/oxlint/rules/testing/no-expect-call-expression--yield-from-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

For an assertion chain that reached a matcher call in a spec file, the first argument handed to `expect(...)` is read with type assertions, `satisfies`, non-null assertions, parentheses, optional chains and `await` peeled off. The report stands where what is left is a call, a `new` expression or a tagged template: the subject was produced inside the assertion.

A bare identifier is reported too when its declaration in this file shows it takes arguments — read from a function-type annotation first, then from a function literal initializer. That reading is skipped for the `toHaveBeenCalled` family, which never calls its subject. `specFileSuffixes` settles which files are specs.

## Fix

Move the production into the fixture and assert the binding it hands back.

```ts
const test = baseTest.extend("stem", () => specStemOf("report.test.ts", SUFFIXES));

test("drops the suffix", ({ stem }) => {
  expect(stem).toBe("report");
});
```

To verify an exception, have the fixture return a thunk that takes no arguments and hand the matcher that binding.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a function called inside the assertion produces the subject there
// in report.test.ts
test("carries the id", ({ input }) => {
  expect(summarise(input)).toStrictEqual({ id: "a" });
});
```

```ts
// a callable declared with a parameter carries the call it is about to make
// in report.test.ts
const attempt = (name) => parse(name);
test("refuses an empty name", () => {
  expect(attempt).toThrowErrorMessage("name must not be empty");
});
```

Code this rule accepts.

```ts
// a bare identifier is a subject that was produced before the assertion
// in report.test.ts
test("carries the id", ({ report }) => {
  expect(report).toStrictEqual({ id: "a" });
});
```

```ts
// a thunk the fixture handed back takes no arguments and runs under the matcher
// in report.test.ts
test("refuses an empty name", ({ attempt }) => {
  expect(attempt).toThrowErrorMessage("name must not be empty");
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Respelling the call as `new` or as a tagged template. All three sit in the same range
- Handing over a callable that bundles its arguments. Within the range where the declaration is readable, it falls
- Moving the thunk's declaration to another file, or receiving it from a factory call. The parameters become unreadable while the execution inside the assertion is unchanged

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `producedSubject` | The value handed to \`expect\` must not be produced inside the assertion. This one is {{production}}. Move the production into the fixture, return the value from there, and write the assertion against that binding. Give a thrown-message assertion a thunk that takes no arguments, handed back by the same fixture. Lifting the production into a statement at the top of the \`it\` lands on \`require-it-only-expect--move-setup-into-fixture\`. Wrapping it in a type assertion, a non-null assertion, parentheses or \`await\` is stripped before this reading, and respelling it as \`new\` or as a tagged template is read the same way. |
| `argumentTakingSubject` | A callable handed to \`expect\` must not declare parameters. \`{{subject}}\` declares them, and the matcher calls it inside the assertion with whatever was bound into it. Move the values the call needs into the fixture, return a thunk that takes no arguments, and give that binding to the matcher. Binding the arguments into another callable first leaves the same call standing behind another spelled. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
