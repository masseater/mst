---
description: "Disallow a test block whose body carries no assertion, so a passing run only ever means the claims written in the blocks held"
---

# forbid-expectless-it--assert-or-delete-it

<!-- BEGIN GENERATED rule-header -->

Disallow a test block whose body carries no assertion, so a passing run only ever means the claims written in the blocks held

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-expectless-it--assert-or-delete-it.ts`](../../src/lint/oxlint/rules/forbid-expectless-it--assert-or-delete-it.ts)

<!-- END GENERATED rule-header -->

## Violation

A test block whose body carries zero assertions.

One assertion is one `expect` chain that reached a matcher call. The counting shares its judgment with the upper bound in `forbid-multi-expect-it--split-into-separate-it` (`lib/spec-syntax/assertion-entries.ts`): a chain is one whether or not `not`, `resolves` or `rejects` stands in it, and a chain opening with `expect.soft(...)` or `expect.poll(...)` is one as well. Utility calls in the `expect` namespace, such as `expect.assertions(...)` and `expect.hasAssertions()`, claim nothing and leave the count at zero.

What is counted is the **direct** count — what is written inside the block's callback body. The upper bound counts what a run reaches, adding in what callees and fixtures carry; the lower bound counts directly, because an `expect` parked in a helper or a fixture does not change the block itself claiming nothing. What is written inside an anonymous callback in the block's body, such as an iteration over an array, joins the direct count, because the innermost block is still the same block.

Whether something is a test block follows the shared entry judgment (`lib/spec-syntax/test-block-declarations.ts`): a call whose name is written as a string or a template, with a callback handed over last, whose call chain resolves at its root to a block spelling. Modified forms such as `it.skip`, `it.todo`, `it.fails` and `it.each(rows)(...)`, bindings imported under another name, and bindings derived from a fixture builder are all the same block. The list of modifiers is not this rule's to carry.

A modifier that suppresses the run does not excuse it. Suppression means "do not surface this claim for now", not "there need be no claim".

The report points at the block declaration itself. There is no line that fails, so the only thing to point at is the declaration announcing the name.

### What is deliberately left out of reach

| Shape | Why it is not a target |
| --- | --- |
| A block with a direct count of one or more | Only the lower bound is watched here. How many are allowed belongs to `forbid-multi-expect-it--split-into-separate-it` |
| A declaration handed no callback (`it("name")`, `it.todo("name")`) | Not a test block under the shared entry judgment. The runner reports these as todo, so they make nothing green |
| A declaration whose name is not written as a string (`it(() => {})`) | Not a test block under the shared entry judgment either |
| The body of a grouping block (`describe`) | Not a test block. A spec file carrying no test block at all is watched by another rule |
| The body of a fixture factory | Structurally out of reach: it is not a test block declaration |
| A matcher settled at run time (`expect(subject)[chosen](expected)`) | A matcher was reached, so it counts as one. That keeps the counting identical to the upper bound's; the shape itself is watched by `require-it-only-expect` |
| Anything but a spec file | Outside the extensions `specFileSuffixes` picks up, nothing is read |

### The invariant

Green means the claims that were written held.

The first layer is that such a block carries no condition under which it fails. A block with an empty body, a block holding only a comment, a block holding only a declaration of how many assertions there are — none of them has a place that can fail when run. However the implementation is broken, they stay green, so their power to detect a regression is zero.

The second layer is that the report tells a reader something the reality contradicts. The block's name appears in the report, so a reader takes the behaviour to be verified. The name alone claims a behaviour while the code claims nothing. A weak matcher at least verifies part of something; this shape verifies nothing, so it sits further from what green means.

The third layer is how the shape comes about: deleting an implementation and taking the assertions with it while leaving the block, or placing the name of a block being drafted and forgetting to fill it. Either is a few lines of diff, and a review sees no more than "a block was added" or "a block is still there". Human attention cannot be the premise, so a machine stops it.

The other two rules of this bundle pass over this shape. The upper bound watches only "too many", and the rule watching the body's shape watches only "there are statements other than expect". With an empty body, neither condition is met. The lower bound has to be carried by a rule of its own.

Run against the 175 spec files in this repository, this rule reported nothing. It is not a rule for making existing tests be fixed; it is a rule for stopping the empty blocks yet to arrive.

### Configuration

- `specFileSuffixes`: the extensions treated as spec files. The same value is used across the rules of this bundle

The lower bound is fixed at 1 and is not an option, and there is no upper bound here. The upper bound is carried by `forbid-multi-expect-it--split-into-separate-it` on the side counting what a run reaches, and the lower bound by this rule on the side counting directly. Housing two different countings in one rule would leave the lower and the upper bound disagreeing about the same block.

## Fix

There are two ways out.

Write the claim about the behaviour the block announces. The fixture hands back a subject, and one exact-match assertion pins it. Where what to claim does not settle there and then, delete the block. A block that is only a name makes a hole in the specification look verified, so its absence is the more accurate state. The deletion stays in the diff, so it can be reconsidered later.

"Write anything to make it pass" is not a fix. Filling it with a trivial assertion, such as comparing two literals, runs into `no-expect-projected-subject--use-tostrictequal-on-subject`. Not being able to think of what to fill it with is the state of not having settled what the block should announce.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// declaring how many assertions the block carries is no claim
// in report.test.ts
it("carries the id", () => {
  expect.assertions(1);
});
it("carries the total", () => {
  expect.hasAssertions();
});
```

```ts
// a claim parked in a helper leaves the block claiming nothing
// in report.test.ts
const expectShape = (subject) => {
  expect(subject.id).toBe("a");
};
it("carries the shape", ({ report }) => {
  expectShape(report);
});
```

Code this rule accepts.

```ts
// a block that pins its subject writes the claim its name promises
// in report.test.ts
it("carries what it summarised", ({ report }) => {
  expect(report).toStrictEqual({ id: "a", total: 2 });
});
```

```ts
// a claim written inside a callback of the block stands in the block
// in report.test.ts
it("carries every row", ({ rows }) => {
  rows.forEach((row) => {
    expect(row).toBe("a");
  });
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Placing a declaration of how many assertions there are (`expect.assertions(1)`, `expect.hasAssertions()`) to satisfy the count.** It claims nothing and is not counted
- **Filling it with a trivial assertion, such as comparing two literals.** The subject is not a bare binding, so `no-expect-projected-subject--use-tostrictequal-on-subject` fails it
- **Moving the verification into a helper or a fixture to empty the block.** The count is direct, so the lower bound is not met. On top of that, a helper call placed in the block's body runs into `require-it-only-expect--move-setup-into-fixture`
- **Keeping it with `it.skip`, `it.todo` or `it.fails` instead of deleting it.** Suppressed or not, it is a violation. Suppression does not take the name out of the report
- **Lowering the bound in configuration.** The bound is fixed at 1 and is not an option. Making 0 selectable would turn this rule off through a configuration change alone
- **A suppression directive**

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `expectlessIt` | A test block must not stand without an assertion written in its own body. This block claims nothing and passes on every run, while the report lists its name among the behaviours a suite checked. Write the claim the name promises about the subject the fixture hands over, or delete the block. A declaration of how many assertions the block carries claims nothing and does not count here, and neither does an assertion parked in a helper or a fixture this block reaches. Marking the block as skipped, as todo or as expected to fail does not settle the claim either. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
