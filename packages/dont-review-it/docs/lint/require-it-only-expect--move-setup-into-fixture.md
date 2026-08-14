---
description: "Disallow a statement other than an assertion in the body of a test block, so the subject every assertion reads is the one its fixture handed over"
---

# require-it-only-expect--move-setup-into-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow a statement other than an assertion in the body of a test block, so the subject every assertion reads is the one its fixture handed over

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`require-it-only-expect--move-setup-into-fixture.ts`](../../src/lint/oxlint/rules/require-it-only-expect--move-setup-into-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A statement other than an assertion appearing in the callback body of a test block — a call whose chain root resolves to `it`.

Only two things pass.

- An expression statement of an `expect` chain that reaches a matcher call. Written with `await`, with `not` / `resolves` / `rejects` in between, or entered through `expect.soft(...)` / `expect.poll(...)`, it is the same thing
- An expression statement calling one of the listed utilities of the `expect` namespace. By default two of them: `expect.assertions(...)` and `expect.hasAssertions()`

For a concise arrow body that is no block, that expression itself has to be one of the two. Handing it back with `return` passes too, as long as the expression returned is one of the two.

Whether something is a test block follows the shared root reading, and modified spellings are not enumerated. `it.skip`, `it.only` and `it.each(table)(...)` all have their bodies read the moment the root resolves to `it`. Enumerate them and the body check comes off by adding a modifier nobody enumerated.

The callback is taken as the last function value among the arguments standing after the name. `it(name, fn)`, `it(name, options, fn)` and `it(name, fn, timeout)` all arrive at the same callback.

Three shapes are reported.

| messageId | Where it reports | What is happening |
| --- | --- | --- |
| `setupStatement` | A statement inside a block body | A statement that is neither an assertion nor a utility stands in the body |
| `nonAssertionBody` | The expression of a concise arrow body | The body's expression is neither an assertion nor a utility |
| `utilityArgument` | The utility call | An argument of a passed utility holds a call, a `new` expression or an assignment |

Concretely, what falls: a variable declaration preparing something, a call that runs the code under test, a destructuring, a branch, a caught exception, a loop, logging, an expression statement that is only a value, an `expect` call that reaches no matcher, an expression taking a matcher out as a value, and a concise arrow returning an expression that is no assertion.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A test block with an empty body | The lower bound on the count belongs to [forbid-expectless-it--assert-or-delete-it](./forbid-expectless-it--assert-or-delete-it.md). This rule reads the shape of the body alone |
| A body carrying two or more assertions | The upper bound on the count belongs to [forbid-multi-expect-it--split-into-separate-it](./forbid-multi-expect-it--split-into-separate-it.md) |
| `expect(build()).toStrictEqual(...)` | Building the subject inside `expect` belongs to [no-expect-call-expression--yield-from-fixture](./no-expect-call-expression--yield-from-fixture.md) |
| A declaration standing outside the test block | What this rule reads is the callback body. Declarations at file level or directly inside a grouping block are left alone |
| The body of a fixture factory | The root does not resolve to `it`, so it is structurally out |
| The body of a setup or teardown hook | That belongs to [forbid-test-hook--move-setup-into-fixture](./forbid-test-hook--move-setup-into-fixture.md) |
| A call whose name is not written as a string | The test block reading requires a string first argument. What does not meet it is no test block |
| A file that is no spec | The range is settled by `specFileSuffixes` |

That no teardown statement stands there is not something this rule asks for. Teardown is a premise the shared runner configuration holds, and carrying this rule alone into an environment without that premise would leave the necessary teardown unwritable. The unit of adoption includes [forbid-test-hook--move-setup-into-fixture](./forbid-test-hook--move-setup-into-fixture.md) and a shared configuration with per-test clearing and restoring turned on.

### The invariant

What is held is that the body of an `it` is made of assertions alone, and that preparation and execution belong to the fixture.

This rule is the floor the bundle stands on. The other rules of the bundle — whether the expected value copies the subject's construction, whether the subject is a bare identifier, whether a mock's call record is being peeked at as a value — all judge starting from "the subject the fixture returned". Allow preparation in the body of an `it` and the subject becomes a variable inside the `it`, so that starting point disappears. With a loose floor, the detections standing on it cannot even be seen to be firing at nothing.

The reason a reader has is a different one: whether an `it` stays a declaration that "this subject carries this property". Mix preparation in and what is under test can no longer be settled without tracking state line by line, and the correspondence between what the test name claims and what the code confirms stops being readable.

Ownership of setup is another reason. A setup is owned by its spec file and is not pushed out into a shared harness. Setup duplicated between independent specs is accepted. A fixture is where "the setup a spec owns" lives, and by not scattering it into the `it`, into helpers in the file, or into shared modules, one spec stays readable in one file.

### Configuration

| Name | Default | What it settles |
| --- | --- | --- |
| `allowedExpectUtilities` | `["assertions", "hasAssertions"]` | The names of `expect` namespace utilities that may stand in a body |
| `specFileSuffixes` | `[".test.ts", ".test.tsx"]` | The file suffixes this rule applies to |

`allowedExpectUtilities` replaces rather than adds. What the default carries is the two that declare how many assertions the test block itself holds. The rest of the namespace — registering a custom matcher, adding an equality test, adding a serialiser, reading and writing runner state — is preparation itself once called inside a test block, so the default does not pass it. When the runner's API grows, this list is kept up with it.

Settling it as "pass anything whose chain root is `expect`" is not enough, because preparation can be pushed into the argument of any call on the namespace.

## Fix

Move the preparation, the intermediate bindings and the call that runs the code under test into a fixture, and return the subject. Leave in the `it` only the assertion about that subject.

The rule tests in this repository already take that division. One case handed to `testLintRule` — its code, file name, options and expected reports — sits in a declaration outside the test block, and what stays inside the test block is the reconciliation alone. Because the place for preparation is fixed at the caller's declaration, which case checks what is settled by reading the list.

To check an exception, the fixture returns a thunk taking no argument and the `it` hands that identifier over. What is handed over is an identifier rather than a call expression, so the body stays a single assertion statement.

To declare the number of assertions, `expect.assertions(...)` is available, but its argument is a written-out value. Put a call that computes the number in the argument and that becomes a hiding place for preparation.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a binding that prepares the subject is reported
// in order.test.ts
it('totals the lines', () => {
  const order = build();
  expect(order).toBe(3);
});
```

```ts
// the call under test written as a statement is reported
// in order.test.ts
it('totals the lines', () => {
  save(order);
  expect(order).toBe(3);
});
```

Code this rule accepts.

```ts
// a body holding one assertion against the subject is the shape this rule keeps
// in order.test.ts
it('totals the lines', () => {
  expect(total).toStrictEqual({ amount: 3 });
});
```

```ts
// preparation standing outside the test block is where this rule wants it
// in order.test.ts
const order = build();
describe('order', () => {
  const paid = pay(order);
  it('totals the lines', () => {
    expect(paid).toBe(3);
  });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Folding the preparation into one line and pushing it into `expect`'s argument. Running lands on [no-expect-call-expression--yield-from-fixture](./no-expect-call-expression--yield-from-fixture.md), assembling on the rule forbidding a synthetic subject, and bundling into an array on [no-expect-projected-subject--use-tostrictequal-on-subject](./no-expect-projected-subject--use-tostrictequal-on-subject.md)
- Pushing the preparation into a helper function in the spec file and calling it once from the `it`. A call is no assertion statement, so it falls here
- Pushing the preparation into the argument of an `expect` namespace utility call. The utilities that pass are enumerated by name, and the shape of the arguments is read too
- Pushing the preparation into a setup or teardown hook. [forbid-test-hook--move-setup-into-fixture](./forbid-test-hook--move-setup-into-fixture.md) drops that
- Adding teardown to a hook or to the `it`. The shared configuration already does it, and individual teardown calls are forbidden by another rule
- Adding a modifier to the test block to take the body out of the check. Modified spellings are not enumerated, so the body is read as long as the root resolves to `it`
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `setupStatement` | The body of \`it\` must not carry a statement other than an assertion. Move the preparation, the intermediate bindings and the call under test into the fixture, have the fixture hand back the subject, and leave the assertions against that subject standing here. Folding the same preparation into an argument of \`expect\`, into a helper declared in this spec file, or into a test hook keeps the same statement out of the fixture and is forbidden as well. Cleanup belongs to the shared runner configuration and must not be written back into \`it\`. |
| `nonAssertionBody` | The body of \`it\` must not be an expression other than an assertion. Move the work this expression performs into the fixture, and write an assertion against the subject the fixture hands back. |
| `utilityArgument` | An argument handed to an \`expect\` namespace utility must not carry a call, a construction or an assignment. Move that work into the fixture, and hand the utility a value spelled out here. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
