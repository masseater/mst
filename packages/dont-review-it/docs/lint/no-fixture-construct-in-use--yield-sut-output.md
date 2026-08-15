---
description: "Disallow a fixture factory handing back a value the spec built instead of the value the code under test produced, so a green assertion says something about the production and not about the stand-in the spec packed for it"
---

# no-fixture-construct-in-use--yield-sut-output

<!-- BEGIN GENERATED rule-header -->

Disallow a fixture factory handing back a value the spec built instead of the value the code under test produced, so a green assertion says something about the production and not about the stand-in the spec packed for it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-fixture-construct-in-use--yield-sut-output.ts`](../../src/lint/oxlint/rules/no-fixture-construct-in-use--yield-sut-output.ts)

<!-- END GENERATED rule-header -->

## Violation

A fixture handing back a value the spec built rather than the value the code under test produced. Two shapes are read.

- A value written out or constructed here: an object literal, an array literal, a literal, a template with no substitution, `undefined`, a `new` expression, `Object.create` and `Reflect.construct`. An immediately invoked function, `Object.assign` and any number of intermediate `const` bindings are followed through to what stands at the end
- A part read off a binding the fixture already holds

A binding that starts as an empty container and is filled by a method call on it is left alone, because the value it ends with is not the one written here.

## Fix

Return the value the code under test produced, untouched. Where a part is what the assertion needs, return the whole value and read the part in the assertion.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an object literal handed back is a shape the spec assembled
// in report.test.ts
const test = baseTest.extend("report", () => ({ id: "a" }));
```

```ts
// a part read off a binding the factory holds narrows what the fixture hands back
// in report.test.ts
const test = baseTest.extend("output", () => {
  const caught = runSut();
  return caught.stdout;
});
```

Code this rule accepts.

```ts
// a factory that runs the code under test hands back what it produced
// in report.test.ts
const test = baseTest.extend("report", async () => await summarise(input));
```

```ts
// setup laid over the produced value keeps the production at its root
// in report.test.ts
const test = baseTest.extend("report", async () => {
  const report = await summarise(input);
  return Object.assign(report, { seen: true });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Spreading the building across further bindings, an immediately invoked function or `Object.assign`. The same built value stands at the end of the chain
- Moving the packing into the assertion instead. `no-expect-synthetic-subject--yield-from-fixture` takes it there

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `builtSubject` | A fixture must not hand back a value it built itself. This one is {{shape}}. Return the value the code under test produced, untouched. |
| `boundBuiltSubject` | A fixture must not hand back a value it built itself. \`{{name}}\` holds {{shape}}. Return the value the code under test produced, untouched. Spreading the building across further bindings, an immediately invoked function or \`Object.assign\` leaves the same built value at the end of the chain. |
| `readSubject` | A fixture must not hand back a part read off a binding it already holds. Return \`{{root}}\` whole and read the part in the assertion. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
