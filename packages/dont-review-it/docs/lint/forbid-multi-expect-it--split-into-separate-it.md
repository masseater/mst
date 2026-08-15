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
- Bundle: `testing`
- Source: [`forbid-multi-expect-it--split-into-separate-it.ts`](../../src/lint/oxlint/rules/testing/forbid-multi-expect-it--split-into-separate-it.ts)

<!-- END GENERATED rule-header -->

## Violation

A test block reaching more assertions than `maxAssertions`, which defaults to 1. Every assertion beyond the budget is reported, in source order.

What a block reaches is not only what its own body writes. A helper the block calls, and a fixture it destructures, are followed into their bodies and the assertions found there are counted against the block; each body is counted once, so a shared helper does not inflate the total twice. The report names how many came from where.

The files in scope are settled by `specFileSuffixes`, which defaults to `.test.ts` and `.test.tsx`.

## Fix

Split the block into one block per behaviour and name each after the behaviour it pins.

Where the claims all speak about one returned value, have the fixture hand that value back and pin it whole with one exact comparison.

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

- Parking the extra assertions in a helper or a fixture. Both are followed and counted against the block that reaches them
- Raising `maxAssertions` to fit the block. The budget says what a failing block is allowed to mean

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
