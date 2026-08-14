---
description: "Require every fixture to be declared as its own builder call whose type is inferred from what the factory returns, so the shape a test destructures is the shape the factory produces rather than a hand-written copy that drifts away from it"
---

# require-vitest-extend-builder--infer-fixture-type

<!-- BEGIN GENERATED rule-header -->

Require every fixture to be declared as its own builder call whose type is inferred from what the factory returns, so the shape a test destructures is the shape the factory produces rather than a hand-written copy that drifts away from it

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`require-vitest-extend-builder--infer-fixture-type.ts`](../../src/lint/oxlint/rules/require-vitest-extend-builder--infer-fixture-type.ts)

<!-- END GENERATED rule-header -->

## Violation

Member calls whose property name is `extend` and whose receiver is not `expect` — the fixture builder calls — are read. Two shapes are reported.

- **A call whose first argument is an object literal.** The older shape, writing the fixtures gathered into one object and handing values to a `use(...)` callback. The report stands on that object literal
- **A call carrying a type argument.** Even where the first argument is a fixture name string, writing a type argument means the type is no longer inferred from what the factory returns. Chained builder calls are one call per stage, so whichever stage carries it is reported at that stage. The report stands on the first type argument

A call falling into both (`test.extend<{ seed: number }>({ seed: 1 })`) is reported once, as the object shape, because the automatic fix rewrites that whole call and the type argument goes with it.

Property names are read as the same name across the three shapes where the spelling written in the code is itself the final property name: a non-computed member (`test.extend`), a string literal subscript (`test['extend']`), and a template literal subscript carrying no expression (``test[`extend`]``).

What stands before it is not read. `test`, `it`, or a value the suite built itself — the judgment runs on the shape of the arguments alone. Which spelling the fixture builder's base is fixed to belongs to [forbid-it-extend--use-test-extend](./forbid-it-extend--use-test-extend.md). This rule applies only to the files the shared lint configuration counts as specs, and inside those, `.extend({ ... })` is expected to be nothing but the test runner's builder.

### What is no violation

- Registering a custom matcher (`expect.extend({ toBeReport })`). A different API merely sharing the name `extend`, whose only shape takes one object of matchers. It is not reported even carrying a type argument
- A builder call naming a fixture beside its factory, carrying no type argument (`test.extend("report", () => summarise())`)
- A builder call carrying options (`test.extend("db", { scope: "file" }, () => openDb())`)
- The spelling of the builder's base. `it.extend("report", () => summarise())` is not reported here. Fixing the base at `test` belongs to [forbid-it-extend--use-test-extend](./forbid-it-extend--use-test-extend.md)
- An `extend` call handed no argument at all, and one handed only a spread, carrying no type argument. The fixtures declared cannot be read by this rule, so it is not judged as the object shape. Carrying a type argument, it is reported as the type argument shape
- A member other than `extend` (`test.each` and the like)

### The invariant

What is held is that a fixture's type is read off the implementation.

A type argument is a hand-made copy of the fixture's shape. Change what the factory returns and the type argument stays old unless it is rewritten. The breakage has two layers.

The first is that nothing happens when the copy drifts. The type argument and the factory's return are two separately written statements, and changing one changes nothing about the other. There is no place anywhere that errors the moment they drift.

The second is that the drifted side becomes the type check's standard. The type of the fixture an `it` receives comes from the type argument, so the test is checked against "the shape the author wrote" rather than "the shape the factory actually returns". What was meant to be the mechanism by which a test notices a change in the implementation turns green against a statement that is not looking at the implementation. Where the other rules of this bundle hold that the subject's **value** comes from the code under test, this one holds that the subject's **type** comes from the implementation.

As a side effect, the plumbing of the `use(...)` callback disappears. The shapes a fixture may be written in converge on one, so the other rules reading fixtures no longer have to keep checking two.

### Configuration

None.

This invariant admits no exception of "this one fixture may write its type by hand". Make an exception expressible in configuration and the fixture carrying it is the one whose type drifts, and the drift is not reported either. That is the same as not having this rule.

## Fix

Write one builder call per fixture. Put the name in the first argument, have the factory receive its dependencies by destructuring, and return the subject as the return value. The type is inferred from the return.

There is an automatic fix. Run `vp lint --fix` over the target files and the shapes that can be rewritten deterministically become chained builder calls.

```ts
const it = test.extend({
  seed: { id: "a" },
  report: async ({ seed }, use) => {
    const built = summarise(seed);
    await use(built);
    await built.close();
  },
});
```

```ts
const it = test.extend("seed", { id: "a" }).extend("report", async ({ seed }, { onCleanup }) => {
  const built = summarise(seed);
  onCleanup(async () => {
    await built.close();
  });
  return built;
});
```

The rewrite does four things.

- A direct value is handed over as a value
- A factory moves the expression it handed to `use(...)` into the return, and drops `use` from the arguments
- Statements after `use(...)` move inside a cleanup registration. The factory receives `{ onCleanup }` as its second argument
- A fixture with options written as a tuple becomes a builder call lining up the name, the options and the fixture

Dependencies between fixtures are read too. Where one fixture receives another by destructuring, they are reordered so the depended-on side comes at an earlier stage before the chain is built.

The automatic fix only assembles the call's text; it does not tidy the indentation. One pass of `vp check --fix` leaves the rewritten places unindented, so run it again or run `vp fmt`.

The rewrite changes exactly one thing about how a fixture's value is settled. In the older shape the `x` handed to `use(x)` becomes the fixture's value as it is, while in the builder shape the runner awaits the value the factory returned. Where a Promise was handed to `use`, the fixture after the rewrite is the resolved value.

**Some shapes get no automatic fix.** Falling into any of these, only the report comes out. Rewrite them by hand.

- A spread property, a computed property key, a numeric key
- A property written as a method, a getter or a setter
- Two fixtures under the same name
- A cycle among fixture dependencies
- `use(...)` appearing twice or more, standing only inside a branch or a nested function, or not taking exactly one argument
- A factory that `return`s a value besides calling `use(...)`
- A statement after `use(...)` that is no expression statement
- A factory that is no arrow function, or whose parameters are not exactly the context and `use`
- A fixture value written as an identifier or a call expression, where whether it is a function cannot be settled statically. The older shape treats a function value as a factory, so handing it back as a value could change the meaning
- The builder's receiver wrapped in a type assertion, or the builder itself written as an optional call

Getting no automatic fix must not be read as "this case is out of range". As long as a report comes out, the invariant is broken.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an object of fixtures becomes one builder call carrying the factory
const test = baseTest.extend({ report: async ({}, use) => { await use(summarise()); } });
```

```ts
// a written out type argument beside a named fixture is reported on its own
baseTest.extend<{ report: Report }>("report", () => summarise());
```

Code this rule accepts.

```ts
// a fixture named beside its factory reads its type off what the factory returns
const test = baseTest.extend("report", () => summarise());
```

```ts
// a scoped fixture takes its options between the name and the factory
const test = baseTest.extend("db", { scope: "file" }, () => openDb());
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving to the builder in form while leaving the type argument. The presence of a type argument is itself a detection condition, so the report does not clear
- Moving the fixtures into another binding as an object and handing that to `extend`. The first argument stops being an object literal so this rule goes quiet, but the older shape stands as it was and the fixture's type is not inferred from the factory's return. Add a type argument and the report comes out on that side
- Silencing a case that gets no automatic fix with a lint suppression directive
- Taking the reported file out of the shared lint configuration's range

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `objectFixtureDeclaration` | A fixture must not be declared by handing an object of fixtures to the builder. Declare each fixture as its own builder call naming the fixture and then its factory, so the fixture type is read off what that factory returns. |
| `handWrittenFixtureType` | A fixture builder call must not carry a written out type argument. Delete \`{{written}}\` and let each fixture type be read off what its own factory returns. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
