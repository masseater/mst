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

For a fixture declaration in a spec file, what the fixture hands back as the subject is read. Where it hands back a function value, the report stands.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

Two shapes of fixture declaration are read.

| Shape | The name | Where the subject sits |
| --- | --- | --- |
| The builder form | The string literal argument | The factory's return value |
| The older object form | The property key | The value handed to `use(...)` |

A call sharing the member name `extend` but whose receiver is `expect` registers a custom matcher and is not a fixture declaration. That judgment lives in the shared code reading fixture declarations, so every fixture-side rule, this one included, carries the same exclusion.

The expression in the subject position is read with type assertions, `satisfies`, non-null assertions, parentheses, optional chains and `await` peeled off. Where what is left is an arrow function expression or a function expression, it counts as a function value. Where what is left is an identifier, the same-named `const` declaration in the fixture body is followed and its initializer read the same way. Where there is nothing to follow, or where it returns to the same name, the walk stops.

The gate is on the return side, not on names. Whether the name starts with `make` does not change the judgment.

Reports divide into two.

1. **A function value declaring parameters.** A defaulted parameter and a rest parameter both count as parameters. This shape is reported without exception
2. **A function value declaring no parameters** (a thunk). Reported only where the exclusion below does not hold

### The thunk exclusion

Returning "a function taking no arguments that fails when called" from a fixture, in order to verify an exception, is exactly the fix [no-expect-call-expression--yield-from-fixture](./no-expect-call-expression--yield-from-fixture.md) prescribes. So that this shape does not fall, a thunk is excluded only where **both** of these hold.

1. The function value it returns declares no parameters
2. That fixture name is read, inside the same spec, only as the subject of an assertion demanding a failure

The second is settled by walking the test block callbacks that destructure the fixture name. Each reference to the extracted binding is read, and any of these means the exclusion does not hold.

| How it is read | Why the exclusion does not hold |
| --- | --- |
| The subject of an assertion not demanding a failure | That test settles the subject's assembly for itself |
| Any position other than an assertion's subject | Calling it and asserting on the result, or combining it with other values, lands here |
| A write reference | The binding has been swapped for another value, and what was read is not settled |
| Another fixture destructuring it as a dependency | The assembly decision has been handed to another fixture. What is inside that one is not followed |
| A reception whose name cannot be read statically | A destructuring with a default, a nested one, a computed key. What it bound to is not settled |

An assertion demanding a failure is settled by two routes: the matcher name being one of `toThrow`, `toThrowError`, `toThrowErrorMatchingSnapshot`, `toThrowErrorMatchingInlineSnapshot`, or a `rejects` standing between `expect(...)` and the matcher. `not` does not change the name, so a negated form passes through the same route. `resolves` demands a value rather than a failure and does not pass. The set of matcher names is replaceable through `throwExpectingMatchers`.

A fixture no test block reads is placed on the excluded side. What this judgment reads is "is there even one way of reading it other than demanding a failure", and with no readings at all that condition is not met. It turns into a report the moment one reading is added.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A function defined inside the fixture body and never returned | Not the subject. Part of the setup |
| An identifier the fixture returns that comes from another file | The initializer cannot be read by this runtime. What cannot be read is not treated as a violation |
| A test block receiving the whole context | What it reads is not settled from a destructuring. That shape is dropped by another rule |
| A test block receiving the context as a rest | As above |

The last two are a division of responsibility rather than a limit of static analysis. How the context is received belongs to [no-test-context-escape--destructure-fixtures-by-name](./no-test-context-escape--destructure-fixtures-by-name.md), and until that one drops it, this rule's walk does not reach that fixture name. Not reaching does not mean it is allowed.

### The invariant

A fixture returns the concrete subject of that scenario.

Where a fixture returns "a function that makes the subject", the setup hides behind a reusable wrapper and each test block settles for itself how the subject is made. Subjects of different shapes come out of the same fixture per test. Reading the fixture does not say what that scenario's setup is, and the premise that a spec is a behavioural contract readable on its own collapses.

There is one more layer. The other rules of this bundle judge against "the subject the fixture returned". Where the subject is a function, what calling it yields is not settled statically, and every check reading construction, copying and projection loses its starting point. Loosen the shape of what a fixture returns in one place and the detection that quietly shrinks is not there but in another rule.

It is also a way of voiding, from inside the spec, the norm that a spec owns its setup. Stop helpers from sitting outside the file and, as long as a fixture may return a function, the same abstraction comes back inside the spec.

### Configuration

| Name | Default | What it changes |
| --- | --- | --- |
| `specFileSuffixes` | `.test.ts` / `.test.tsx` | Which files count as specs |
| `throwExpectingMatchers` | `toThrow` / `toThrowError` / `toThrowErrorMatchingSnapshot` / `toThrowErrorMatchingInlineSnapshot` | The matcher names the thunk exclusion accepts as demanding a failure |

Setting `throwExpectingMatchers` to an empty array leaves no thunk excluded except through a `rejects`. That is the only way in for removing the exclusion; disabling per file, or moving the rule to off, is dropped by [require-spec-lint-coverage--lint-every-spec-file](./require-spec-lint-coverage--lint-every-spec-file.md).

There is no option for replacing `rejects`. It is a chain modifier rather than a matcher name, and the vocabulary of modifiers is held in one place by the assertion-reading side.

## Fix

Expand the setup inline inside the fixture and return the concrete subject. Split the fixtures per scenario so each holds its own setup. Setup duplicated between scenarios is accepted.

```ts
const test = baseTest.extend("stem", () =>
  specStemOf("report.test.ts", DEFAULT_SPEC_FILE_SUFFIXES),
);

test("drops the suffix from the file name", ({ stem }) => {
  expect(stem).toBe("report");
});
```

Where a factory varied behaviour by its arguments, split the fixtures per argument value.

```ts
const test = baseTest
  .extend("stem", () => specStemOf("report.spec.ts", DEFAULT_SPEC_FILE_SUFFIXES))
  .extend("configuredStem", () => specStemOf("report.spec.ts", [".spec.ts"]));
```

Return a thunk taking no arguments only to verify an exception, and hand that thunk to nothing but an assertion demanding a failure.

There is no automatic fix. Deleting the function and expanding it inline means settling the argument values that scenario actually needs, and that decision belongs to the writer's intent.

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

- Renaming the fixture to avoid detection. The gate is on the return side, so a rename does not clear it
- Dropping the parameters to make a no-argument function and pose as a thunk. The exclusion reads how it is used, so using it anywhere but an assertion demanding a failure means it does not hold
- Wrapping the function value in a type assertion, or binding it to a `const` inside the fixture before returning. Both are peeled and followed
- Making the function-returning fixture a dependency of another fixture and using it through that. The exclusion stops holding the moment it is destructured as a dependency
- Lifting the factory into a module-scope function. That lands on [no-spec-file-helper-function--inline-or-use-fixture](./no-spec-file-helper-function--inline-or-use-fixture.md)
- Lifting the factory into another file. That lands on [no-dry-test-setup--inline-owned-setup](./no-dry-test-setup--inline-owned-setup.md)
- A suppression directive

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
