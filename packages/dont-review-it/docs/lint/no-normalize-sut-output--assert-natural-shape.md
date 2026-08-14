---
description: "Disallow reshaping the value a fixture hands back, so an assertion is written against the shape the code under test produced rather than the shape the spec tidied it into"
---

# no-normalize-sut-output--assert-natural-shape

<!-- BEGIN GENERATED rule-header -->

Disallow reshaping the value a fixture hands back, so an assertion is written against the shape the code under test produced rather than the shape the spec tidied it into

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-normalize-sut-output--assert-natural-shape.ts`](../../src/lint/oxlint/rules/no-normalize-sut-output--assert-natural-shape.ts)

<!-- END GENERATED rule-header -->

## Violation

For a fixture declaration in a spec file, where the subject it hands back came from is read.

The files in scope are settled by the file name suffix. The default is `.test.ts` and `.test.tsx`, replaceable through `specFileSuffixes`.

Two positions are read: the expression tree reaching the `return` of the builder form `test.extend("name", factory)`, and the first argument reaching `use` in the object form `test.extend({ name: (context, use) => use(subject) })`. `expect.extend(...)` shares the spelling but declares no fixture and falls out structurally.

### Operations standing on the way out

The subject's whole expression tree is walked. Nothing has to be at the top level: a form buried under a later transform, and a form inside a nested call argument, are both picked up.

The vocabulary is held per category. Method names are held by this rule, and function names by `normalizingFunctions`.

| Category | Method names | Function names (default) |
| --- | --- | --- |
| Ordering | `sort` / `toSorted` | `sortBy` / `orderBy` |
| Reversing | `reverse` / `toReversed` | None |
| Dropping duplicates | None | `uniq` / `uniqBy` / `uniqWith` |
| Realigning key order | None | None |
| Unifying formatting | `normalize` / `trim` / `trimStart` / `trimEnd` / `toLowerCase` / `toUpperCase` / `toLocaleLowerCase` / `toLocaleUpperCase` / `replace` / `replaceAll` | None |
| Rebuilding by folding | `reduce` / `reduceRight` | `reduceAsync` |

They are split in two because what changes with dependencies and what does not are different. Method names are spellings the language settles, so they are the same whichever dependency is taken. Function names follow a utility library's naming and change when the dependency does. Adopt a policy of writing with standard means alone and the function-name vocabulary empties, leaving the method names.

Realigning key order has no dedicated name because no function in this dependency setup does it. That operation is written by ordering `Object.entries(...)` and rebuilding, so the ordering names catch it.

A call to `Object.assign` with the subject in the first argument is reported the same way where it stands on the way out, because what returns is the rewritten first argument itself.

Names are read alike in dot notation, bracket notation with a string-literal key, and a template-literal key with no interpolation. Whether the receiver is a method or a namespace is not distinguished.

The walk covers the whole expression tree, so it follows not only where the subject came from but also the origin of names standing in the argument positions handed to the code. Normalizing an input in a form written in the spec before handing it over enters this reading too.

### Operations behind bindings and declarations

Even where the subject sits in a name, its origin is followed. What is followed is `const` and `function` declarations in the fixture body, and `const` and `function` declarations directly under that file.

A name bound by a fixture's parameter ends the walk there. A dependency received from another fixture lands here: even where a binding of the same spelling exists directly under the file, the value received is not that binding. The same holds inside a followed declaration, where a name bound by that function's parameter ends the walk.

Where a callee's name resolves to **a declaration in this file**, the same judgment is applied recursively to that declaration's return path. The walk covers only what closes inside the spec file and **stops at a file boundary**.

The boundary is placed at the file because an ordering or a deduplication inside another file is that file's contract. A spec calling it means the spec demanded a shaped value, not that the spec shaped it. Cross the boundary and every test verifying a function that builds an order-independent canonical form, or one that folds duplicates into an index, gets reported as "the fixture reshaped the output". There is nothing the fixture side can fix, so the report does not hold as an instruction.

Only the spelling written in the spec is used for the judgment. `sut(...).toSorted()` and `sortBy(sut(...))` both stand in the spec and are reported. There is no need to read `sortBy`'s implementation: where the name is in this rule's vocabulary, it settles on the spot.

An operation found by following a declaration is reported at the position of the call or the name that started the walk. The report position always lands inside the file being checked.

### Destructive rewrites running before the handover

For the binding the subject resolves to, rewrites in the fixture body standing before the subject's expression are read. Inside a branch or a loop counts, as long as it stands before the subject's expression. Work running after the subject's expression does not reach the value the assertion reads and is out of scope.

Three shapes are read: calls to `add`, `clear`, `copyWithin`, `delete`, `fill`, `pop`, `push`, `reverse`, `set`, `shift`, `sort`, `splice` or `unshift` on the binding or on its elements and properties; assignment to and `delete` of a property; and `Object.assign` with the binding in the first argument.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| Normalization inside an `it` body or inside `expect(...)` | Outside the fixture. [require-it-only-expect--move-setup-into-fixture](./require-it-only-expect--move-setup-into-fixture.md) and [no-expect-call-expression--yield-from-fixture](./no-expect-call-expression--yield-from-fixture.md) take them, and once evicted the result enters this reading afresh |
| The body of a function literal written on the way out | That position holds comparators and callbacks handed to the code. Whether and how often it runs is settled by the callee, so it is not a position that shapes the subject |
| A callee name settled at run time | It cannot be read as a name. `no-computed-callee-name--write-name-literally` drops it separately |
| A collection newly assembled in the spec | The returned value's origin becomes construction. [no-fixture-construct-in-use--yield-sut-output](./no-fixture-construct-in-use--yield-sut-output.md) takes it |
| Handing a binding to another function and rewriting inside it | Whether the callee's parameter is the same value as that binding is not followed |
| A declaration inside a dependency package | Not read. The judgment runs on names alone |
| A dependency received through a nested destructuring | A name taken out as in `({ report: { rows } }) => ...` cannot be read as the dependency's name. Where a binding of the same spelling exists directly under the file, that one's origin gets followed instead |

The inside of a dependency package, and handing a binding to another function, are information this reading does not hold rather than conveniences of the implementation. Not reaching does not mean it is allowed, so they are named in the forbidden bypasses section.

The meaning question "is that procedure an ordering" is not answered either, because whether an arbitrary procedure is a permutation preserving an order relation is not settled until it runs. The detection holds without answering it: what is protected is "the shape a fixture returns is the shape the code produced", not "that procedure is an ordering". Normalization written as a procedure always takes one of three shapes, and all three are closed. Using a call in the vocabulary falls to this rule; assembling a new collection in the spec falls to the construction rule; and rewriting the subject under test's output itself falls to the destructive-rewrite condition above.

### The invariant

The subject a fixture hands back is the shape the code actually produced.

That something is ordered before being compared is itself evidence that the assertion's shape and the contract's shape have drifted. There are only two ways they drift.

Where order is part of the contract, the order the subject under test emits should be compared as it stands; ordering erases the exact shape the code has to satisfy. Where order is not the contract, comparing the whole collection for equality was wrong to begin with, and what should be read is a per-element fact, membership, or a specific projected property.

Either way, normalization inside a fixture hides the drift and stays green. What the test claims becomes "the shape after the normalization its author chose", and the real invariant is written nowhere.

There is one more layer. The moment normalization is inserted, that assertion moves toward never failing. A test that does not fail cannot be told apart from a passing test by any signal collected, because coverage sees only that execution reached it.

### Configuration

`specFileSuffixes` and `normalizingFunctions`.

`specFileSuffixes` defaults to `.test.ts` and `.test.tsx`, sharing one range with the other rules of this bundle.

`normalizingFunctions` defaults to `orderBy`, `reduceAsync`, `sortBy`, `uniq`, `uniqBy`, `uniqWith`, and naming it replaces the default. That list is in the configuration because the names depend on a utility library's naming. The method names are not exposed: spellings the language settles do not vary with the dependency setup, and making them removable would let a respelling get past this rule.

### Where the detection does not reach

**Normalization inside a function placed in another file.** Where a spec writes `tidy(sut(...))` and `tidy` orders in `./tidy.ts`, this rule does not report it. That is the price of placing the boundary at the file.

The price is paid because what is lost by crossing it is greater. Cross the boundary and every test verifying a function that builds an order-independent canonical form, one that folds duplicates into an index, or one that drops whitespace to read a value, gets reported. What those tests verify is precisely that ordering or that deduplication. There is nothing the reported side can fix, and the only way to comply is "do not call that function". A rule that does not hold as an instruction is worse than a rule with one way out left.

Whether that way out was actually used can be read from the spec. A fixture returning a value after passing it through a function other than the subject under test is visible to the eye and is something review picks up. That is not "sending to review what a mechanism could catch"; it names what lies outside the mechanism's boundary.

## Fix

Where order is the contract, have the fixture return the raw output and pin the expected order directly on the `it` side.

```ts
const test = baseTest.extend("suffixes", () =>
  specFileSuffixesFrom([{ specFileSuffixes: [".spec.ts", ".spec.tsx"] }]),
);

test("keeps the configured suffixes in the order they were written", ({ suffixes }) => {
  expect(suffixes).toStrictEqual([".spec.ts", ".spec.tsx"]);
});
```

Where order is not the contract, express the order-independence on the assertion side: split into an `it` per element, read the membership of each expected value, or wrap both the measured and the expected value in a set and compare contents.

```ts
const test = baseTest.extend("names", () => normalizingFunctionsFrom([]));

test("carries every function name the vocabulary starts with", ({ names }) => {
  expect(names).toStrictEqual(
    new Set(["orderBy", "reduceAsync", "sortBy", "uniq", "uniqBy", "uniqWith"]),
  );
});
```

Where it was rewritten before being handed over, write the claim the rewrite was preparing on the assertion side. A rewrite usually looks necessary when one fixture has been given several faces, so splitting the fixture per face makes the rewrite disappear.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// ordering the produced collection reshapes it on the way out
// in report.test.ts
const test = baseTest.extend("rows", () => summarise(input).sort());
```

```ts
// ordering the binding in place rewrites the value before it is handed back
// in report.test.ts
const test = baseTest.extend("rows", () => {
  const produced = summarise(input);
  produced.sort();
  return produced;
});
```

Code this rule accepts.

```ts
// a fixture that hands back the call under test hands back what the code produced
// in report.test.ts
const test = baseTest.extend("rows", () => summarise(input));
```

```ts
// an operation another module writes inside its own body is that module's own shape
import { ordered } from "./shape.ts";
const test = baseTest.extend("rows", () => ordered(summarise(input)));
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Pushing the normalization into a differently named function inside the spec file. Declarations in the same file are followed, so it is still reported. That shape is separately reported by [no-spec-file-helper-function--inline-or-use-fixture](./no-spec-file-helper-function--inline-or-use-fixture.md) anyway
- Rewriting the subject under test's output destructively and returning it bare, so the return path's expression tree holds no normalization. Rewrites of the binding the return value resolves to are read too
- Rewriting the normalization as a procedure (a loop, a fold, a hand-written walk) to leave the vocabulary. Assembling a new collection falls as construction inside a fixture
- Ordering "because it is unordered" and then comparing the whole thing for equality. That is not an expression of an unordered contract
- Handing the binding to another function, rewriting inside it and returning. It disappears from this reading, and the assertion still receives the rewritten value
- Moving the normalization into a dependency package and publishing it under a name absent from the vocabulary. The inside of a dependency is not read so the report clears, and the subject is still processed
- Emptying the vocabulary by removing names from `normalizingFunctions`
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `normalizedSubject` | A fixture must not reshape the value the code under test produced before handing it back. \`{{operation}}\` reshapes it on the way out. Return the produced value untouched, and state the claim about order, duplication or formatting in the assertion itself: give each element its own \`it\`, assert that each expected element belongs to the collection, or wrap both sides in a set before comparing them. |
| `normalizedBehindName` | A fixture must not reshape the value the code under test produced before handing it back. \`{{name}}\` reaches \`{{operation}}\` on the way out. Return the produced value untouched, and state the claim about order, duplication or formatting in the assertion itself: give each element its own \`it\`, assert that each expected element belongs to the collection, or wrap both sides in a set before comparing them. |
| `mutatedSubject` | A fixture must not write over the value the code under test produced before handing it back. {{operation}} rewrites \`{{subject}}\` on the way out. Keep the produced value untouched, and state what this rewriting was preparing for in the assertion itself. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
