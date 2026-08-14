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

For a fixture declaration in a spec file, the value that fixture hands back is read.

Two families of fixture declaration are read. In the builder form it is the factory's `return` following a string-literal name; in the older object form it is the argument the factory written as a property's value passes to `use(...)`. Only declarations where a factory is written are in scope; a declaration handing over a value directly is not read. A direct value is a declared input rather than a produced result, and the automatic fix of [require-vitest-extend-builder--infer-fixture-type](./require-vitest-extend-builder--infer-fixture-type.md) leaves that shape as it stands.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

The value read is judged with type assertions, `satisfies`, non-null assertions, parentheses, optional chains and `await` peeled off. The report stands where what is left resolves to one of these.

| What it resolves to | Example |
| --- | --- |
| A value written on the spot | `() => null` / `() => "a"` / `` () => `a` `` / `() => undefined` / `() => void 0` / `() => -1` |
| An object literal or an array literal | `() => ({ id: "a" })` / `() => []` |
| A constructor call | `() => new Report(input)` |
| Creation through reflection | `() => Object.create(prototype)` / `() => Reflect.construct(Report, [input])` |
| A composition call whose first argument is any of the above | `() => Object.assign({ id: "a" }, extra)` |
| An immediately invoked function returning any of the above | `() => (() => ({ id: "a" }))()` |
| A name initialized with any of the above | `() => { const report = { id: "a" }; return report; }` |

Names are followed to their declaration. They are followed only where they resolve to a `const` or `let` declarator inside the same file, read the same inside the factory, inside a `describe` and at module scope. No cap is placed on the number of declarators in between, because adding steps leaves the same value at the end.

One more shape is reported: a factory reading a part off a name it holds and returning that (`() => { const caught = runSut(); return caught.stdout; }`). Putting the read into a name before returning is the same. This judgment holds only where the root resolves to a declarator in this file; a root resolving to the factory's parameter does not hold.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| The result of a call | The result of running the code under test. This is the shape being asked for |
| A method call on a name | A call produces a new value. Reading and calling are divided here |
| A name initialized with an empty literal that has a method call on it | An observation buffer whose contents accumulate through the run. Close this and a test collecting side effects to observe them cannot be written |
| A composition call whose first argument is a name from the code under test | What is handed back is the produced value itself, with setup layered on top. The judgment reads the first argument only |
| A read rooted at a fixture dependency, and handing a dependency back as it stands | [no-fixture-forward-subject--yield-sut-output](./no-fixture-forward-subject--yield-sut-output.md) takes it |
| Handing back a function value | [no-fixture-factory-function--inline-owned-setup](./no-fixture-factory-function--inline-owned-setup.md) takes it |
| A name declared in another file | The declaration cannot be read by this runtime. What cannot be read is not treated as a violation |

Assembling an object by copying same-named properties is reported by [no-fixture-copy-subject--yield-sut-output](./no-fixture-copy-subject--yield-sut-output.md) too. This reading treats an object literal as assembly regardless of its contents, so both report it. They are not collapsed into one: collapsing would need one to hold the other's judgment inside it, and a configuration disabling the other would then open a hole.

### The invariant

The value a fixture hands back as the subject is a value the code under test actually produced.

Where a fixture builds the subject with a literal or `new`, the `it` verifies a stand-in the test's author wrote. The test stays green even where the shape of the code under test's output is entirely different, and it does not fail when a field is added, renamed or removed. The norm "assert on observable behaviour" presumes the target of the assertion is an observation, and a value the fixture made is not one.

The reading side opens the same hole. Return only part of the output and the rest becomes invisible to every assertion in that spec. Forbid projection on the assertion side and the same narrowing comes in from the fixture side.

Where the subject cannot be produced, the right exit is not "hand back a substitute value" but "throw from the fixture". The test should fail, not go green on a stand-in.

### Configuration

`specFileSuffixes` alone. The default is `.test.ts` and `.test.tsx`, shared as one range across the rules of this bundle.

The names read as composition calls and as creation through reflection are not exposed in the configuration. Make them replaceable and handing over an empty list becomes a way past this rule.

## Fix

Run the code under test inside the fixture and hand back what came out, as it stands. Put the projection on the `it` side.

```ts
const test = baseTest.extend("marked", () =>
  isSpecFile("report.test.ts", DEFAULT_SPEC_FILE_SUFFIXES),
);

test("marks a file whose name ends in a spec suffix", ({ marked }) => {
  expect(marked).toBe(true);
});
```

An assertion failing means the produced value differs from the expectation; do not make it add up on the fixture side. Rewrite the expectation, or rework what the code under test returns.

There is no automatic fix, because the original output cannot be identified from an assembled subject. The right fix for `return { httpStatus: raw.status }` might be "return `raw`", "make the return value richer", or "delete that assertion", and a tool holding no intent for the test cannot choose.

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

- Putting the assembly into a name before returning it. Declarators are followed, so it falls
- Moving the assembly out to module scope or `describe` scope. The walk goes up through scopes, so it falls
- Wrapping the assembly in an immediately invoked function or `Object.assign`. Both are walked into
- Wrapping in a type assertion to change the look. It is peeled before the judgment
- Replacing the literal with an array literal or a `new` expression to change only the shape. It falls in the same range
- Dropping the factory and rewriting as a direct value. It disappears from this reading, but the value being asserted is still one the spec wrote
- Moving the assembly to a name in another file and importing it. The declaration becomes unreadable so the report clears, but the fixture is still not handing back a produced value
- Receiving the read by destructuring (`const { stdout } = runSut(); return stdout`). No root name is left so the report clears, but only part of the output is being handed back
- Taking the read straight off the call without a name (`() => runSut().stdout`). There is no root to follow so the report clears, but it is the same narrowing
- A suppression directive

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
