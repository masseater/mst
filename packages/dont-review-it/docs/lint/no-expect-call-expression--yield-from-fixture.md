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
- Shipped in the preset: yes
- Source: [`no-expect-call-expression--yield-from-fixture.ts`](../../src/lint/oxlint/rules/no-expect-call-expression--yield-from-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

For an expect chain in a spec file that reached a matcher call, the first argument handed to `expect(...)` is read.

The starting point is the matcher call. Only a receiver resolving to a call to `expect(...)` is read. Member references in between are followed whatever their names, because enumerating `not`, `resolves` and `rejects` and following only those would let one modifier outside the list take the detection off. `expect.soft(...)` and `expect.poll(...)` are followed as receivers too. A namespace utility call such as `expect.assertions(2)` falls out structurally, because its root is not a call to `expect`.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

The first argument is read with type assertions, `satisfies`, non-null assertions, parentheses, optional chains and `await` peeled off. The report stands where what is left is one of these.

| What is left | Example |
| --- | --- |
| A call expression | `expect(summarise(input))` |
| A `new` expression | `expect(new Report(input))` |
| A tagged template | ``expect(summarise`${input}`)`` |

The three sit in one range because, seen from the invariant, they are the same violation. Producing the subject inside `expect` is common to them, and dropping any one of them would take the detection off by rewrapping into that shape.

One more shape is reported: a bare identifier that is nonetheless declared as "a function taking arguments". A declaration is readable only where it resolves to a `const`, `let` or `function` declaration inside that file. Two things settle it, read in order.

1. Where the binding carries a type annotation that is a function type, the number of parameters of that type
2. Where there is no annotation, whether the initializer is a function literal, and then its number of parameters

A defaulted parameter and a rest parameter both count as parameters, because neither makes it "a thunk taking no arguments".

This judgment is not made where the matcher reads a call record (the `toHaveBeenCalled` family). Those matchers do not call the subject, so handing them a function taking arguments causes no execution. Receiving a test double from the fixture and reading how it was called is precisely the fix this bundle prescribes, and closing that would erase the fix.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A bare identifier | The subject was produced outside the assertion. This invariant already holds |
| A member expression, an array literal, a conditional expression | Shapes whose root is not an identifier are taken by [no-expect-projected-subject--use-tostrictequal-on-subject](./no-expect-projected-subject--use-tostrictequal-on-subject.md) |
| An object literal | A separate rule forbidding a synthesised subject takes it |
| An inline function literal | Not a call expression. Not a bare identifier either, so as above the projection rule catches it. Two rules do not fire on the same shape |
| An identifier arriving through an import | The declaration is in another file and this runtime cannot read its parameters. What cannot be read is not treated as a violation |
| An identifier bound as a parameter | As above. A subject destructured from the fixture lands here |
| A binding whose initializer is the result of a call | What it returns does not settle statically. A test double factory lands here |

The last three are a limit of static analysis in principle rather than a convenience of the implementation. Hide there and the detection does not reach, but not reaching does not mean it is allowed. They are named in the forbidden bypasses section.

### The invariant

The value an assertion receives is the subject the fixture already produced and handed over.

Call a function inside `expect` and the *when* of given / when / then sinks inside the *then*. The test goes back to describing a procedure — "running this expression gives this" — instead of "this subject has this property". The reader has to reconstruct what the subject is from inside the assertion.

There is one more layer. Every other rule in this bundle judges against "the subject the fixture returned": whether the expected value is a copy of the subject's construction expression, whether the subject is the root itself, whether a call record is being read as a value. Let the subject be born inside `expect` and all of those judgments lose their starting point. Break where the subject comes from in one place and the other checks quietly fire at nothing, and where they are firing at nothing does not show in any report.

So this rule builds the ground the other rules stand on. Loosen it and the detection that shrinks is not here but in another rule.

### Configuration

`specFileSuffixes` alone. The default is `.test.ts` and `.test.tsx`, shared as one range across the nine rules of this bundle.

There is no option listing callee names to exempt. List one name and wrapping into it becomes a way past this rule.

## Fix

Move the execution into the fixture and have the fixture return what came back. The `it` then only verifies that binding.

```ts
const test = baseTest.extend("stem", () =>
  specStemOf("report.test.ts", DEFAULT_SPEC_FILE_SUFFIXES),
);

test("drops the suffix from the file name", ({ stem }) => {
  expect(stem).toBe("report");
});
```

To verify an exception, have the fixture return a thunk taking no arguments and have the `it` hand over that thunk's identifier. What is handed over is an identifier rather than a call expression, so this reading does not catch it. Use a matcher that compares the exception message exactly; the `toThrow` family taking a string is what [forbid-weak-matcher--use-exact-matcher](./forbid-weak-matcher--use-exact-matcher.md) replaces.

Make the thunk take no arguments. Close the values needed to call it inside the fixture. Hand over a function taking arguments and the execution, arguments and all, is carried back into the assertion.

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

- Lifting the call into a statement at the top of the `it` and binding the result. It disappears from this reading but lands on [require-it-only-expect--move-setup-into-fixture](./require-it-only-expect--move-setup-into-fixture.md)
- Wrapping the call in a type assertion, `satisfies`, a non-null assertion, parentheses or `await`. They are peeled
- Respelling the call as a `new` expression or a tagged template. It falls in the same detection range
- Handing over a function that bundles the arguments to hide the execution. Within the range where the declaration is readable, it falls
- Moving the thunk's declaration to another file, or receiving it as the result of a factory call. The parameters become unreadable so the report clears, but execution inside the assertion is unchanged
- Moving the call into the fixture and then reshaping, projecting or wrapping the result on the fixture side. Construction, copying and projection on the fixture side are taken by other rules
- A suppression directive

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
