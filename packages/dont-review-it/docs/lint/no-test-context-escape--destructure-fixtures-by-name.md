---
description: "Disallow a test callback or a fixture factory holding the test context as anything but a pattern of statically readable fixture names, so the fixtures a test depends on stay listed in its parameter and the rules that read those names keep deciding"
---

# no-test-context-escape--destructure-fixtures-by-name

<!-- BEGIN GENERATED rule-header -->

Disallow a test callback or a fixture factory holding the test context as anything but a pattern of statically readable fixture names, so the fixtures a test depends on stay listed in its parameter and the rules that read those names keep deciding

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-test-context-escape--destructure-fixtures-by-name.ts`](../../src/lint/oxlint/rules/no-test-context-escape--destructure-fixtures-by-name.ts)

<!-- END GENERATED rule-header -->

## Violation

There are two positions receiving the test context: the first parameter of the callback handed to a test block declaration, and the first parameter of a fixture factory. For both, these ways of receiving are read.

- A destructuring carrying a rest element (`({ subject, ...rest })`)
- A binding that is not a destructuring: receiving as an identifier (`(ctx) => ...`), an array pattern (`([subject]) => ...`), a form giving only a default to the whole parameter (`(ctx = {}) => ...`), a rest parameter (`(...handed) => ...`)
- A computed key inside a destructuring pattern (`({ [chosen]: bound })` / `({ ["expect"]: assert })`). Keys in nested stages are read the same way
- Extraction from a context received as an identifier, by a name settled at run time: subscript access, enumeration with `for...in`, spreading into an object literal, and handing it to a call or a `new` (`inspect(ctx)` / `inspect(...ctx)` / `Object.keys(ctx)` / `use(ctx)`)

For a form received as an identifier, both the way of receiving and each place extracting from that identifier at run time are reported. The former says "line them up by name"; the latter points at what has to be written out when they are lined up.

Whether something is a "test block declaration" is settled in one place (`src/lint/oxlint/lib/spec-syntax/test-block-declarations.ts`). A call rooted at any of these counts as a declaration.

- A globally injected test block spelling (`it` / `test`)
- A binding importing a test block spelling, renamed imports included
- A local binding initialized with any of the above, or with the result of `test.extend(...)`. Binding-to-binding rebindings are followed through any number of steps

The root is followed across modifier members (`skip`, `each` and the like), table-driven calls and tagged templates. Fixture factories are taken from the declaration reading of `extend` calls (`src/lint/oxlint/lib/spec-syntax/fixture-declarations.ts`), covering both the object form and the builder form pairing a name with a factory.

Where a wrapper call is handed to a test block or to `extend` in place of a function, the function handed to that call is peeled before the judgment. Peeling follows any number of steps.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| `({ options: { ...spread } })` | The rest covers a fixture's value; what was taken out of the context is still readable as `options` |
| `({ subject: bound })` / `({ "subject": bound })` | The extracted name is statically readable. An alias does not change the name taken out |
| `options[chosen]` / `{ ...options }` | What is done with a value that is not the context is out of this rule's remit |
| `subject.field` | A non-computed member access has the name written |
| A callback or factory declaring no parameter | It receives no context |
| `expect.extend({ ... })` | Not a fixture declaration |
| A grouping block's callback | Not a test block declaration |
| Spreading into an array literal (`[...ctx]`) | The context is not iterable, so this shape fails at run time |
| A namespace route such as `runner.it(...)` | The shared definition cannot resolve the root to an identifier |

There is no narrowing by file kind. Which files this rule holds for is settled by the shared lint configuration's glob.

### The invariant

The test context is received by destructuring, by name, one fixture at a time.

The first layer is that the other rules of this bundle stop holding. [no-vitest-context-expect--import-expect-from-vitest](./no-vitest-context-expect--import-expect-from-vitest.md) reads "no `expect` was taken out of the context", and [no-fixture-forward-subject--yield-sut-output](./no-fixture-forward-subject--yield-sut-output.md) reads "which fixture dependency is being returned". Both presume the extracted names are readable, and inserting a rest-gathered alias or a run-time walk leaves the name unsayable. A rule that cannot say the name does not go quiet; it answers "not a violation". Reports not coming out and violations not existing become indistinguishable, and green loses its meaning.

The second layer is that there is no route by which the lapsed judgment is noticed. The rule that fell through stays silent, so the escaping test is counted among "tests that keep that rule". What broke is the detection rather than the run's result, so no red appears. The shape itself is dropped so that, having given up on chasing names, no shape that cannot be chased gets in.

A reader gets the same benefit: reading the callback's parameter enumerates which fixtures that test depends on.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

Make an exception expressible in configuration and that setting is itself a hole meaning "in this file the names need not be statically readable". The hole's location is written only in the configuration, so the rules reading names keep answering "not a violation" without knowing it exists.

Where an inner function rebinds the same name as the identifier that received the context, the inner uses are read as reaching the context too. The judgment runs on range containment rather than binding resolution, and this shape appears only inside a position already reported as an identifier binding.

## Fix

Rewrite it as a destructuring listing only the names of the fixtures actually used. The rule tests in this repository already take the fixed shape.

```ts
it("names a behaviour", ({ subject, options }) => {});
```

What was received by a rest is expanded into an enumeration of the names being used. Where something was being walked, write out the names you wanted to take.

There is no automatic fix. Expanding a rest or a walk into an enumeration of names requires settling "what is actually being used", and that decision belongs to the writer's intent.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// binding the context as one name is reported
it("names a behaviour", (ctx) => {});
```

```ts
// gathering the rest of the context is reported
it("names a behaviour", ({ subject, ...rest }) => {});
```

Code this rule accepts.

```ts
// taking fixtures apart by name passes
it("names a behaviour", ({ subject, options }) => {});
```

```ts
// a rest over a fixture value is not a rest over the context
it("names a behaviour", ({ options: { ...spread } }) => {});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Interposing one function that receives the context and receiving it whole inside. Peeling runs as a pre-step, so the interposed function's parameter meets the same judgment
- Receiving the context into another binding and walking that (`const inner = ctx;`). The identifier binding before the rebinding is itself reported, so the report does not clear
- Declaring the callback elsewhere and handing only an identifier to the test block (`it("names a behaviour", handler)`). Peeling follows only function literals and their calls, so this shape's parameter is invisible to this rule. Write a test's callback as the test block's argument
- Using a function expression declaring no parameter and reading the context out of `arguments`. With no parameter there is nothing to report as a way of receiving. Where a test is written as a function expression, receive the context in a parameter
- Silencing it with a suppression directive. How the context is received is a discipline over the whole suite and does not come off for one file's convenience

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `restContext` | A test context must not be gathered into a rest binding. List the fixtures this test uses as separate names in the pattern. |
| `wholeContext` | A test context must not be bound as a whole. List the fixtures this test uses in an object pattern, and take each one out by name. |
| `computedContextKey` | A key of a test context pattern must not be written as a subscript. Name the fixture this key stands for as a static key. |
| `traversedContext` | A test context must not be spread, enumerated, subscripted, or handed to another function. List the fixtures \`{{held}}\` stands for in an object pattern, and take each one out by name. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
