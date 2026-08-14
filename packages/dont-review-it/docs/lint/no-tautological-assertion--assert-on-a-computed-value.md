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
- Shipped in the preset: yes
- Source: [`no-tautological-assertion--assert-on-a-computed-value.ts`](../../src/lint/oxlint/rules/no-tautological-assertion--assert-on-a-computed-value.ts)

<!-- END GENERATED rule-header -->

## Violation

An equality assertion where the value handed to `expect` and the expected value handed to the matcher are both written-out literals and are the same value.

Three matchers are in scope: `toBe`, `toEqual`, `toStrictEqual`, each limited to a call taking one argument.

The receiver is limited to what resolves to a call to `expect(...)`. A `not`, `resolves` or `rejects` in between is followed. A call on the result of a function that is not `expect`, such as `assertion(1).toBe(1)`, is out of scope.

These count as a written-out literal.

- String, number, boolean, `null` and BigInt literals
- A template literal carrying no expression (``expect(`parsed`).toBe("parsed")`` is the same value)
- A unary minus on a number literal (`-1`)

Sameness is compared by value; the spelling is not read. `expect(1).toBe(1.0)` is the same value and is reported. Different types are different values: `expect("1").toBe(1)` is not reported.

A form with `not` in between (`expect(1).not.toBe(1)`) is reported too. That one falls on the always-failing side, but in either direction the result is settled without moving one line of the code under test.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A test holding no assertion at all | The already-enabled `vitest/expect-expect` reads that. The responsibility would duplicate |
| `expect({ total: 1 }).toEqual({ total: 1 })` | Object and array literals are not among the written-out literals. The judgment is narrowed to comparisons of identical literals |
| `expect(/a/).toEqual(/a/)` | Regular expression literals are compared by reference, so this comparison **always fails**. That is a different defect from "never fails", and running it shows it |
| `expect(1).toBe(2)` | The values differ. It fails when run, so it does not hide behind green |
| `expect(total(1, 2)).toBe(3)` | The left side is a call. The code under test runs |
| `expect(parsed).toBe(3)` | The left side is a binding. The value was settled somewhere else |

This rule does not take on meaningless tests as a whole. It takes the one point that can be settled deterministically: a comparison between identical literals.

There is no narrowing by file kind. The same shape written outside a `.test.ts` is reported. Outside a test, the assertion has been placed in the wrong location.

### The invariant

A test case observes the behaviour of the code under test.

`expect(1).toBe(1)` does not meet that. Both sides are settled inside this file and not one line of the code under test runs. That assertion returns the same result however the program is rewritten.

It breaks in two layers.

The first is that the test does not do its job. The case name says "computes the total", and the body compares 1 with 1. The check the name claims is not performed.

The second is that not performing it shows up as green. The test count grows and the coverage number moves (if the case passes through anywhere). What a person sees is "how many passed", not what each case observed. The case that should fail when something breaks does not. That is learnt when the tests are reread after production broke.

The shape arises less from a writer cutting corners than as a consequence of the order of writing. Place the test's vessel before settling what to check and the vessel gets filled with the same value on both sides just to make it pass. The vessel stays, and the contents it was meant to hold are forgotten.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

## Fix

Settle what that case was supposed to check, and put that subject on the left.

**To check a return value**, call the function under test and assert on its result.

```ts
expect(total([1, 2])).toBe(3);
```

**To check state**, run the operation and then read the state that remains.

```ts
addTo(basket, item);
expect(basket.items).toHaveLength(1);
```

**To check a call to a collaborator**, assert on the arguments it received.

Where none of them can be written, that case has no subject. There is no route in the program producing that value, so delete the case, or settle first what behaviour should be checked. Do not leave the vessel alone.

Extracting the expected side into a constant is not a fix. `expect(EXPECTED).toBe(EXPECTED)` merely changes the spelling; the code under test is still not running.

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

- Replacing one side with a constant or a variable (`const expected = 1; expect(expected).toBe(1);`). This rule reads written-out literals against written-out literals, so the report clears, and the code under test is still not running
- Assembling the value with an expression to shift the spelling (`expect(1).toBe(0 + 1)`). As above
- Wrapping one side in an object literal (`expect({ total: 1 }).toEqual({ total: 1 })`). It merely leaves the judgment's range; both sides are still settled in this file
- Passing through an identity function to make it a call (`expect(identity(1)).toBe(1)`). The left side becomes a call so the report clears. The function you passed through lands on [no-identity-wrapper--call-the-target-directly](./no-identity-wrapper--call-the-target-directly.md)
- Changing to a matcher out of scope (`toBeCloseTo` and the like). As long as what is compared is the same, the result stays fixed
- Making the case `it.skip`. Nothing is checked either way, and only the green is preserved
- A suppression directive

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
