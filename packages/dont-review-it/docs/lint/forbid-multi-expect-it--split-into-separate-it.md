---
description: "Disallow a test block reaching more assertions than the budget set for it, counting the ones its callees carry as well, so a failing block names one behaviour and one cause"
---

# forbid-multi-expect-it--split-into-separate-it

<!-- BEGIN GENERATED rule-header -->

Disallow a test block reaching more assertions than the budget set for it, counting the ones its callees carry as well, so a failing block names one behaviour and one cause

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-multi-expect-it--split-into-separate-it.ts`](../../src/lint/oxlint/rules/forbid-multi-expect-it--split-into-separate-it.ts)

<!-- END GENERATED rule-header -->

## Violation

A test block reaching more assertions than the budget set for it.

One assertion is one `expect` chain that reached a matcher call. A chain is one whether or not `not`, `resolves` or `rejects` stands in it, and a chain opening with `expect.soft(...)` or `expect.poll(...)` is one as well. Utility calls in the `expect` namespace, such as `expect.assertions(...)`, claim nothing and do not join the count.

Whether something is a test block follows the shared entry judgment (`lib/spec-syntax/test-block-declarations.ts`). Modified forms such as `it.skip` and `it.each(rows)(...)`, bindings imported under another name, and bindings derived from a fixture builder are all the same block. The list of modifiers is not this rule's to carry.

What is counted is what a run **reaches**: what is written directly in the block's body, plus what is written in whatever that block can statically be followed into.

- Assertions written in an anonymous callback inside the block's body, such as an iteration over an array. The nearest ancestor block is the same, so they join the direct count
- Assertions inside a function called by name from the block's body. Callees are found through scope resolution, and calls from function to function are followed
- Assertions in the body of a fixture the block consumes. Fixtures that fixture depends on, and functions that fixture calls, are followed too

The same callee is counted once and a cycle stops there. Where several blocks call one function, it is added to each of them, and no report is raised at the function.

Everything over the budget is reported one assertion at a time: a budget of 1 with 3 reached raises 2 reports. The reports stand inside the block — at its position for an assertion written directly, at the call in the block's body for one coming from a callee, and at the place the block's callback receives the fixture for one coming from a fixture. Nobody told "there are 3" should be left finding only 1 in the body.

The message carries how many were reached, how many of those are written in the body, and where the rest came from — which function, which fixture, and how many from each.

### What is deliberately left out of reach

| Shape | Why it is not a target |
| --- | --- |
| A block within the budget | Only the upper bound is watched here. The lower bound belongs to `forbid-expectless-it--assert-or-delete-it` |
| An `expect` in a function no block calls by name | Which block it belongs to cannot be settled. No report is raised at the function |
| Calling a function handed over as a value (`rows.forEach(check)`) | The callee is settled at run time. That is a limit of static analysis in principle, and not permission |
| A call through a binding swapped by a condition | As above |
| An `expect` in a function in another file | This runtime carries no cross-file resolution. It is named outright under the forbidden bypasses below |
| Several reports from one block | That is the result of reporting each assertion over the budget, not duplicated reporting |
| Anything but a spec file | Outside the extensions `specFileSuffixes` picks up, nothing is read |

### The invariant

When a block fails, the cause of the failure is settled uniquely.

The first layer is how much a failure report tells you. Gathering several independent facts under one name leaves the report saying only that the block of that name failed. There are as many possible causes as facts. The failing line is printed, and what that line was claiming is not in the block's name, so a reader reopens the code and reconstructs its relation to the remaining claims.

The second layer is the block name lying. The name announces one behaviour while other behaviours are verified inside. Verification that was never announced cannot be found from the name. When one of the behaviours is later removed, deleting only its assertion leaves the block standing, and the name keeps announcing the behaviour that remains. The drift is a small diff and invisible in review.

The third layer is the cost of isolating a regression. A block whose cause is not settled uniquely demands a bisection every time it fails. That work recurs with every regression; splitting the block costs once.

The budget is 1 because that lands in the same place the other rules of this bundle push toward. Demanding an exact match against the value itself, forbidding projections of the subject, and narrowing the body to expect statements leaves one shape in a block: pinning the value a fixture returned with one exact match. A budget of 1 names that shape rather than adding a separate discipline.

Measured over the 113 spec files in this repository, the reports per budget were 129 across 28 files at 1, 43 across 14 files at 2, 18 across 4 files at 3, and 12 across 3 files at 4. The higher the budget, the further this rule retreats into being a safety net.

### Configuration

- `maxAssertions`: how many assertions one block may reach. Defaults to 1. An integer of 1 or more
- `specFileSuffixes`: the extensions treated as spec files. The same value is used across the nine rules of this bundle

## Fix

Split into a block per behaviour and give each block a name that announces that behaviour.

In `packages/dont-review-it/src/lint/oxlint/lib/spec-syntax/test-block-modifiers.test.ts`, "a name the runner does not chain onto a block is not a modifier" claims separate facts about `extend`, `override` and `scoped` under one name. The three are independent, so they become three blocks.

Where trying to split reveals that the several claims are all about one return value, that is a signal to merge rather than split. In the same file, "every modifier the runner chains onto a block is named as a modifier" pins, with one `toStrictEqual`, the single return value that is the list read off one block with every modifier chained onto it — and that is the shape to land on. Let the fixture return that value and pin it with one exact match.

Where the count comes from a callee, the fix is the same. Assertions placed in a callee run when the block runs and fail under the block's name. Moving where they sit does not change one name carrying several facts.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// two claims written under one name
// in report.test.ts
it("carries both fields", ({ report }) => {
  expect(report.id).toBe("a");
  expect(report.total).toBe(2);
});
```

```ts
// assertions pushed into a helper are still reached by the block
// in report.test.ts
const expectShape = (subject) => {
  expect(subject.id).toBe("a");
  expect(subject.total).toBe(2);
};
it("carries the shape", ({ report }) => {
  expectShape(report);
});
```

Code this rule accepts.

```ts
// one exact comparison pins the one behaviour the block names
// in report.test.ts
const test = baseTest.extend("report", () => summarise());
it("carries what it summarised", ({ report }) => {
  expect(report).toStrictEqual({ id: "a", counted: 2 });
});
```

```ts
// each behaviour in a block of its own keeps every block inside the budget
// in report.test.ts
it("carries the id", ({ report }) => {
  expect(report.id).toBe("a");
});
it("carries the total", ({ report }) => {
  expect(report.total).toBe(2);
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Pushing several expects into a "shape verification helper" and calling it once from the block.** The callee is followed and attributed, so the count does not fall. On top of that, a helper call placed in the block's body runs into `require-it-only-expect--move-setup-into-fixture`
- **Moving the expects into a fixture's body.** They are added to the blocks that consume it, so the count does not fall
- **Moving the helper into another file.** This runtime carries no cross-file resolution, so this shape currently goes unreported. Not being reported is not permission. Assertions belong inside the block
- **Handing the helper over as a value and calling it.** The callee is settled at run time, so it goes unreported. As above
- **Collapsing several expects into one loose matcher to lower the count.** That runs into `forbid-weak-matcher--use-exact-matcher`
- **Raising the budget to clear the report.** The budget is settled once at adoption; it is not something the side receiving a report moves
- **Keeping it with a modifier that suppresses the run.** Suppressed or not, the reached count is unchanged and the report stands
- **A suppression directive**

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `multiExpectIt` | A test block must not reach more than {{limit}} assertion. This block reaches {{attributed}}. Split it into one block per behaviour and name each block after the behaviour it pins. Merge the claims that all speak about a single returned value: have the fixture hand that value back and pin it whole with one exact comparison. |
| `multiExpectItThroughCallees` | A test block must not reach more than {{limit}} assertion, counting the assertions carried by every helper and fixture it reaches. This block reaches {{attributed}}: {{direct}} written in its body and {{elsewhere}}. Split it into one block per behaviour and name each block after the behaviour it pins. Keep every assertion in the block that claims it; assertions parked in a helper or a fixture still run under this block's name. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
