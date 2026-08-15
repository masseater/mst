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

A subject handed to `expect(...)` that the spec wrote out itself: an object literal, an array literal, a literal, a template with no substitution, `undefined` or a `void` expression, a literal behind a unary operator, and a `new` expression. Wrappers are peeled first.

A binding is reported too when its initializer reaches one of those. Initializers are followed through further bindings until a written-out value is reached, and a chain returning to the same binding stops there. A binding holding the result of a call is not a value the spec wrote and is left alone.

## Fix

Return the value from a fixture and assert the binding it hands over.

```ts
const test = baseTest.extend("suffixes", () => DEFAULT_SPEC_FILE_SUFFIXES);

test("ships a suffix per extension", ({ suffixes }) => {
  expect(suffixes).toStrictEqual([".test.ts", ".test.tsx"]);
});
```

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

- Putting the value in a local binding first, or routing it through several. Initializers are followed to the end
- Respelling the object as an array, a `new` call or a template with no substitution. All sit in the same range
- Moving the packing into another file and receiving its call result. The initializer becomes unreadable while the spec still packs the subject

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
