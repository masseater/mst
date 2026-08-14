---
description: "Disallow assembling the subject of an assertion in the assertion itself or in a binding the spec filled with a value it wrote, so a comparison pins the shape the code under test produced rather than the bag the spec packed for it"
---

# no-expect-synthetic-subject--yield-from-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow assembling the subject of an assertion in the assertion itself or in a binding the spec filled with a value it wrote, so a comparison pins the shape the code under test produced rather than the bag the spec packed for it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-expect-synthetic-subject--yield-from-fixture.ts`](../../src/lint/oxlint/rules/no-expect-synthetic-subject--yield-from-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

For an `expect(...)` in a spec file, the subject placed in the first argument is read. `expect.soft(...)` and `expect.poll(...)` are treated as the same way in. A namespace utility call such as `expect.assertions(2)` does not have a call to `expect` at its root and falls out structurally.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

The first argument is read with type assertions, `satisfies`, non-null assertions, parentheses, optional chains and `await` peeled off. The report stands where what is left is one of these.

| What is left | Example |
| --- | --- |
| An object literal | `expect({ status, body })` |
| An array literal | `expect([first, second])` |
| A literal | `expect("a")` / `expect(null)` |
| A template carrying no substitution | ``expect(`a`)`` |
| `undefined` and a `void` expression | `expect(undefined)` / `expect(void 0)` |
| A literal carrying a minus sign | `expect(-1)` |
| A `new` expression | `expect(new Report(input))` |

A shorthand property (`expect({ value })`) is read as an object literal. It is still a way of packing a value into a bag.

One more shape is reported: a subject that is a binding whose initializer is any of the above. The search for a binding follows scope, so it reads the same inside an `it`, in an enclosing `describe`, and at the head of the file. Where the initializer is another binding, it is followed from there, and the report stands the moment a written-out value is reached. An initializer returning to the same binding is cut off there as not reaching a value.

Reports divide into two: a value written straight into the assertion, and a value reaching the assertion through a binding. The opening of the fix differs between them.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A bare identifier whose initializer cannot be read | A subject destructured from the fixture lands here. This invariant already holds |
| A binding whose initializer is the result of a call | What it returns is not a value the spec wrote. A binding receiving the subject under test's output lands here |
| A call expression, a tagged template | [no-expect-call-expression--yield-from-fixture](./no-expect-call-expression--yield-from-fixture.md) takes them |
| A member expression | [no-expect-projected-subject--use-tostrictequal-on-subject](./no-expect-projected-subject--use-tostrictequal-on-subject.md) takes it |
| A literal placed in a matcher's argument | That is the expected side, not the subject. This rule reads only the first argument of `expect(...)` |
| A template carrying a substitution | Not a written-out value but one assembled from bindings |
| A binding initialized in another file | The initializer cannot be read by this runtime. What cannot be read is not treated as a violation |

The last one is a limit of static analysis in principle rather than a convenience of the implementation. Hide there and the detection does not reach, but not reaching does not mean it is allowed. It is named in the forbidden bypasses section.

### The invariant

The subject of an assertion is an existing binding received from the fixture.

Where `expect({ status, body })` can be written, the test's author gets to choose inside the assertion which parts of the subject under test's output go into the bag. The fields not chosen fall outside what the assertion covers, and it does not fail when they are added, removed or renamed. Even with a strict matcher applied, what is being compared is the bag the author packed, not the output of the subject under test. What the test claims is not "this subject has this shape" but "the bag I just made equals the expected value I wrote".

Putting the bag into a local binding first is the same. Only the assertion line comes to look like a bare identifier, while the spec is still what packed the bag. The other rules of this bundle judge against "the subject the fixture returned", so with the subject's origin inside the spec, the ground for those judgments collapses.

### Configuration

`specFileSuffixes` alone. The default is `.test.ts` and `.test.tsx`, shared as one range across the rules of this bundle.

There is no setting for excluding individual cases. Make one mouth for excluding and moving the bag there becomes a way past this rule.

## Fix

Return the value you were about to bag from the fixture, and compare that binding strictly.

```ts
const test = baseTest.extend("suffixes", () => DEFAULT_SPEC_FILE_SUFFIXES);

test("ships a suffix for each spec file extension", ({ suffixes }) => {
  expect(suffixes).toStrictEqual([".test.ts", ".test.tsx"]);
});
```

Where the subject under test does not actually return a value of that shape, rework the return value, or what the assertion is about, instead of making the assertion side add up.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an object literal in the subject position is a bag the spec packed
// in report.test.ts
test("carries the id", ({ status, body }) => {
  expect({ status, body }).toStrictEqual({ status: 200, body: "a" });
});
```

```ts
// a binding filled in the test block carries the bag to the assertion
// in report.test.ts
test("carries the id", ({ status, body }) => {
  const bag = { status, body };
  expect(bag).toStrictEqual({ status: 200, body: "a" });
});
```

Code this rule accepts.

```ts
// a binding the fixture handed over is the subject this rule asks for
// in report.test.ts
test("carries the id", ({ report }) => {
  expect(report).toStrictEqual({ id: "a" });
});
```

```ts
// a binding holding what a call returned is not a value the spec wrote
// in report.test.ts
const report = summarise(input);
test("carries the id", () => {
  expect(report).toStrictEqual({ id: "a" });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Putting the literal into a local variable in the spec first and handing that binding over. Initializers are followed, so it falls as the same violation
- Routing through several bindings to put distance between it and the initializer. Rebindings are followed to the end
- Wrapping in a type assertion, `satisfies`, a non-null assertion, parentheses or `await` to change the look. They are peeled
- Inserting `not`, `resolves` or `rejects`. The subject's position does not move
- Replacing the object literal with an array literal, a `new` expression or a template with no substitution. All of them are still values made in the subject position, and they fall in the same range
- Splitting the assertion per field and escaping into `expect(report.id)`. That lands on the projection rule
- Moving the bag-packing into another file and receiving its call result into a binding. The initializer becomes unreadable so the report clears, but the spec is still packing the subject
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `syntheticSubject` | The subject of an assertion must not be a value assembled inside \`expect\`. This one is {{shape}}. Move the value into a fixture, return it from there, and assert the binding the fixture hands over. Respelling the same value as an array literal, a template without substitutions or a \`new\` call is read the same way, and a type assertion, a non-null assertion or a chain modifier around it is stripped before this reading. |
| `boundSyntheticSubject` | The subject of an assertion must not be a binding the spec filled with a value it wrote itself. \`{{name}}\` holds {{shape}}. Return that value from a fixture and assert the binding the fixture hands over. Splitting the value across further bindings leaves the same written-out value at the end of the chain. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
