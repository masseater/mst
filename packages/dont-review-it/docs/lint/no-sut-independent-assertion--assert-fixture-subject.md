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
- Shipped in the preset: yes
- Source: [`no-sut-independent-assertion--assert-fixture-subject.ts`](../../src/lint/oxlint/rules/no-sut-independent-assertion--assert-fixture-subject.ts)

<!-- END GENERATED rule-header -->

## Violation

Assertions in a spec file that reached a matcher are the way in. `expect.soft(...)` and `expect.poll(...)` are read as the same entry as `expect(...)`, and a spelling with `not`, `resolves` or `rejects` in between reads as the same one. An `expect(...)` that never reached a matcher does not enter.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

Two positions are read: the first argument of `expect(...)` (the subject) and the arguments handed to the matcher (the expected values). Both are read with type assertions, `satisfies`, non-null assertions, parentheses, optional chains and `await` peeled off.

Two reports.

### 1. Every value being compared closes inside the spec

Reported where the subject and every expected value have only origins closing inside the spec. For a matcher taking no expected value, the subject alone is read.

A closed origin is one of these.

| Shape | Example |
| --- | --- |
| A written-out value | `"a"` / `true` / `-1` / `` `a` `` / `undefined` |
| An expression assembled only from written-out values | `1 + 1` / `["a", "b"]` / `{ id: "a" }` |
| An operation, conditional or concatenation joining closed values | `true ? "a" : "b"` / `` `id ${"a"}` `` |
| A member read from a value written out on the spot | `["a"][0]` / `({ id: "a" }).id` |
| A construction on a name from outside the spec whose arguments are closed too | `new Headers({ accept: "text/plain" })` |
| A binding filled with a value nothing can rewrite | the `id` of `const id = "a"` |

Bindings are followed to the end of the chain. A binding whose walk returns to itself is cut off there as not reaching a value.

**A value a binding holds is read as closed only where nothing can rewrite it.** A binding holding an array, an object or a constructed value is treated as not closed. Where `const written = new Set()` is handed to the subject under test and `written.size` is read after it comes back, the spec wrote the value but the subject under test settled what is read out of it. Anybody holding the reference can write into it, so the shape of the binding's initializer alone cannot say "it did not go through the subject under test". A value written out inside the assertion is read as closed, because nobody else can hold a reference to it.

### 2. The subject and the expected value reach the same value

Regardless of whether the origins are closed, the report stands where the subject and an expected value reach the same binding. It is reported with `not` in between too: `not` only turns it into an assertion that always fails, and the result is still unrelated to the subject under test.

Before comparing, **a spread-only copy** is peeled as well as the type-level wrappers. `{ ...report }` and `[...report]` reach `report`. A copy of a copy is peeled too. A binding copying the name (`const copied = report`) reaches the same place by following the binding.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| Only one side being closed | Writing the expected value out in the spec is the right shape. Where the subject comes from the subject under test, the comparison can fail |
| A literal subject with an expected value from the subject under test | The comparison itself can fail. The readability belongs to the rule that reads names |
| A subject deriving from a binding received from a fixture | A name received by destructuring is not a value the spec wrote. A mock carrying a call record is the same |
| A value brought in from outside the spec | An imported constant changes when the subject under test changes. Reconciling against a table of defaults the subject under test publishes lands here |
| The result of a call | What returns is not a value the spec wrote. The route through the subject under test lands here |
| A construction on a name the spec declared | The result changes when the declaration that name points at changes |
| An array, an object or a constructed value a binding holds | Whoever receives the reference may rewrite the contents. The value read out cannot be said to be the one the spec wrote |
| An `expect(...)` with no matcher | That it claims nothing is taken by `no-matcherless-expect--assert-with-matcher` |
| A weak matcher | What stays unverified is read by [forbid-weak-matcher--use-exact-matcher](./forbid-weak-matcher--use-exact-matcher.md) |
| Reconciling one member path against another | Two expressions writing the same path may reach different bindings. A member path on the subject side is read by another rule |

Leaving the result of a call out of the closed origins is not a convenience of the implementation. Almost every route by which a spec reaches the subject under test is a call, and reading "closed" on the grounds that the callee's name lies outside the spec would misread a globally injected subject under test as being inside the spec. Construction alone is opened for names outside the spec because that is the one route for assembling a value without calling the subject under test.

### The invariant

The result of an assertion changes when the subject under test changes.

Where neither the subject nor the expected value went through the subject under test, that assertion gives the same result whatever the code is changed to. It merely has the shape of something that could fail; the condition for failing is not on the subject under test's side.

The shape arises less from a writer's carelessness than from another rule's demand. A writer told "this `it` needs an assertion that can fail" responds most cheaply by adding one line of `expect(true).toBe(true)`. From the side counting reports it cannot be told from a proper assertion, so the demand counts as met and the `it` stays green while checking nothing. Comparing something against itself has the same property.

Two nearby owners exist, and neither reads here. [no-vacuous-host-object-equality--assert-parsed-value](./no-vacuous-host-object-equality--assert-parsed-value.md) reads the types of the values compared, so a comparison between scalars is out of scope. `forbid-weak-matcher--use-exact-matcher` reads the matcher's spelling, so this shape written with an exact matcher passes it. Leave number-padding to a prose prohibition and the rule in the bundle demanding the most reports builds its own way out.

### Configuration

`specFileSuffixes` alone. The default is `.test.ts` and `.test.tsx`, shared as one range across the rules of this bundle.

There is no setting for excluding individual cases. Make one mouth for excluding and moving a number-padding assertion there becomes a way past this rule.

### Its relationship with the other rules reading the same assertion

`no-vacuous-host-object-equality--assert-parsed-value` overlaps on the shape of comparing host objects the spec constructed. What needs fixing first is that the subject did not go through the subject under test, so while this rule's report stands, fixing that one does not resolve it. Where both fire, read this rule's report first.

[no-expect-synthetic-subject--yield-from-fixture](./no-expect-synthetic-subject--yield-from-fixture.md) reads, by position alone, that the subject is a value assembled in the spec. This rule reads the expected side too and reports only where both are closed. A literal subject with an expected value from the subject under test is reported by that one and not by this.

[no-expect-mirrored-subject--assert-observable-contract](./no-expect-mirrored-subject--assert-observable-contract.md) reads the shape of copying the expression a fixture built the subject from into the expected value. A subject and an expected value reaching the same binding hit both. The fix is the same — write the expected value from outside — so either report leads to the same place.

## Fix

Assert on the subject the fixture returns.

```ts
const test = baseTest.extend("stem", () =>
  specStemOf("report.test.ts", DEFAULT_SPEC_FILE_SUFFIXES),
);

test("drops the suffix from the file name", ({ stem }) => {
  expect(stem).toBe("report");
});
```

Where what to check has not been settled, delete the `it` rather than adding an assertion. An assertion added to fill a count does not restore the count's meaning.

For a comparison against itself, repair it into a shape where the expected value is written out in the spec.

```ts
const test = baseTest.extend("suffixes", () => specFileSuffixesFrom([]));

test("ships a suffix for each spec file extension", ({ suffixes }) => {
  expect(suffixes).toStrictEqual([".test.ts", ".test.tsx"]);
});
```

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

- Passing a literal through a fixture first to tidy the subject's origin alone. A fixture returning a literal without calling the subject under test falls to [no-fixture-construct-in-use--yield-sut-output](./no-fixture-construct-in-use--yield-sut-output.md)
- Making only the expected side come from the subject under test while the subject stays closed inside the spec. That is an assertion that can fail, so this rule does not report it — but the subject's name points at nothing, which brings it under [no-expect-forbidden-subject-name--rename-to-concrete-subject](./no-expect-forbidden-subject-name--rename-to-concrete-subject.md)
- Copying the subject into a local binding before comparing. Bindings are followed to the end of the chain
- Copying with a spread before comparing. `{ ...subject }` and `[...subject]` both reach the same value
- Wrapping in a type assertion, a non-null assertion or parentheses to change the look. They are peeled
- Inserting `not`. It only becomes an assertion that always fails, and it is still unrelated to the subject under test
- Switching to an exact matcher to tidy the shape. The matcher's spelling is not this rule's entry condition
- A suppression directive

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
