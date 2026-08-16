---
description: "Disallow an equality assertion whose expected value and whose subject are the same written-out literal, so every assertion in the suite compares something the code under test produced"
---

# no-tautological-assertion--assert-on-a-computed-value

<!-- BEGIN GENERATED rule-header -->

Disallow an equality assertion whose expected value and whose subject are the same written-out literal, so every assertion in the suite compares something the code under test produced

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `testing`
- Source: [`no-tautological-assertion--assert-on-a-computed-value.ts`](../../src/lint/oxlint/rules/testing/no-tautological-assertion--assert-on-a-computed-value.ts)

<!-- END GENERATED rule-header -->

## Violation

An equality assertion whose subject and expected value are the same written-out literal. Nothing the code under test produced takes part, so the assertion holds whatever the code becomes.

## Fix

Put the subject the test is about on the left: call the function under test and assert on what it returned, read the state the operation left behind, or assert on the argument a collaborator was called with.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a number compared with the same number is reported
expect(1).toBe(1);
```

```ts
// the same value written two ways is still the same value
expect(1).toBe(1.0);
```

Code this rule accepts.

```ts
// asserting on what the function under test returned passes
expect(total(1, 2)).toBe(3);
```

```ts
// two different literals compare something even if the code never runs
expect(1).toBe(2);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Binding the literal to a name and comparing the name against the literal. Nothing produced by the code has entered the assertion

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `tautologicalAssertion` | An equality assertion must not compare a written-out literal against the same written-out literal. Put the subject the test is about on the left: call the function under test and assert on what it returned, read the state the operation left behind, or assert on the argument a collaborator was called with. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
