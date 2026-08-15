---
description: "Disallow a fixture handing back a function that builds the subject, so the setup a scenario runs is spelled out in the fixture that owns it rather than chosen again by every test block"
---

# no-fixture-factory-function--inline-owned-setup

<!-- BEGIN GENERATED rule-header -->

Disallow a fixture handing back a function that builds the subject, so the setup a scenario runs is spelled out in the fixture that owns it rather than chosen again by every test block

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-fixture-factory-function--inline-owned-setup.ts`](../../src/lint/oxlint/rules/no-fixture-factory-function--inline-owned-setup.ts)

<!-- END GENERATED rule-header -->

## Violation

A fixture handing back a function value. The subject position is read with wrappers peeled, and an identifier is followed to the same-named `const` in the fixture body.

A function declaring parameters is reported without exception. A thunk taking none is reported unless every reading of that fixture, inside this spec, is the subject of an assertion demanding a failure — a matcher from `throwExpectingMatchers` or a `rejects` modifier. A write reference, a reading in any other position, and another fixture taking it as a dependency each break that exclusion; a fixture no test block reads keeps it.

## Fix

Expand the setup inside the fixture and return the concrete subject. Declare one fixture per scenario and repeat the setup they share.

Keep a thunk that takes no arguments only for assertions demanding a thrown value.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a factory taking the values its subject is built from hands the choice over
// in report.test.ts
const test = baseTest.extend("report", () => (port) => summarise(port));
```

```ts
// a thunk read once for something other than a failure is reported for that read
// in report.test.ts
const test = baseTest.extend("failing", () => () => summarise(-1));
test("refuses a negative port", ({ failing }) => {
  expect(failing).toThrow(new RangeError("port is negative"));
});
test("hands back a callable", ({ failing }) => {
  expect(failing).toBeTypeOf("function");
});
```

Code this rule accepts.

```ts
// a fixture handing back the value the scenario produced owns its setup
// in report.test.ts
const test = baseTest.extend("report", () => summarise(3000));
```

```ts
// a thunk every test block demands fail is the shape the thrown-value reading asks for
// in report.test.ts
const test = baseTest.extend("failing", () => () => summarise(-1));
test("refuses a negative port", ({ failing }) => {
  expect(failing).toThrow(new RangeError("port is negative"));
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Dropping the parameters to pose as a thunk. The exclusion reads how the fixture is used
- Binding the function to a `const` inside the fixture first, or wrapping it in a type assertion. Both are followed
- Taking the fixture as a dependency of another fixture and using it there

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `parameterisedFactory` | A fixture must not hand back a function that declares parameters. \`{{fixture}}\` hands one back, leaving every test block to pick the arguments its own subject is built from. Move the setup into this fixture, return the subject the scenario produces, and declare one fixture per scenario, repeating the setup the scenarios share. Renaming the fixture leaves the same function standing, and dropping the parameters to pass it off as a thunk leaves it reported. |
| `handedBackFunction` | A fixture must not hand back a function as its subject. \`{{fixture}}\` hands one back, and the test blocks reading it ask for something other than a thrown value. Move the setup into this fixture, return the subject the scenario produces, and declare one fixture per scenario, repeating the setup the scenarios share. Wrapping the function in a type assertion, binding it to a name inside the fixture first, and handing it to the older \`use\` callback are all read the same way. Keep a thunk that takes no parameters only for assertions demanding a thrown value. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
