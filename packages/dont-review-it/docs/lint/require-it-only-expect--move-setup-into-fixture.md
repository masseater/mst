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

A test block body carrying anything but assertions. Three reports: a statement other than an assertion, an expression body that is not an assertion, and an argument handed to an `expect` namespace utility that carries a call, a construction or an assignment.

`allowedExpectUtilities` names the utilities whose arguments are left alone, and `specFileSuffixes` settles which files are specs.

## Fix

Move the preparation, the intermediate bindings and the call under test into the fixture, have the fixture hand back the subject, and leave the assertions against that subject standing in the block.

Cleanup belongs to the shared runner configuration and is not written back into the block.

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

- Folding the preparation into an argument of `expect`, or into a helper declared in this spec file
- Moving it into a test hook. `forbid-test-hook--move-setup-into-fixture` reports that

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
