---
description: "Disallow a class whose only instance is built inside one function and never leaves it while its fields keep being written after construction, so a local mutable variable cannot be laundered into class syntax"
---

# no-class-as-mutable-cell--decide-in-an-iife

<!-- BEGIN GENERATED rule-header -->

Disallow a class whose only instance is built inside one function and never leaves it while its fields keep being written after construction, so a local mutable variable cannot be laundered into class syntax

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-class-as-mutable-cell--decide-in-an-iife.ts`](../../src/lint/oxlint/rules/no-class-as-mutable-cell--decide-in-an-iife.ts)

<!-- END GENERATED rule-header -->

## Violation

A class declaration meeting all three conditions, judged against an index built once over the whole repository.

1. At least one member writes instance state after construction. Writes rooted at `this` count, including private fields; a write in a constructor body or a field initializer does not, and neither does one inside a function carrying its own `this`, a `static` member or a static initialization block
2. Every construction of it sits inside one function scope
3. No instance leaves that scope. Returning, throwing, yielding, assigning, aliasing, passing as an argument, publishing, and being captured by a function that itself leaves all count as leaving

Three cut-offs run first and only ever reduce reports: a class on the module's published surface, a file where the name is read anywhere but at a construction, and a name constructed in a file that declares no class of that name. Verification files are outside the index.

## Fix

Go back to what the class was standing in for. Settle the value inside an immediately invoked function that returns from each branch, or fold the iteration into a `reduce`.

Where the state genuinely has to live across callbacks, keep the class and move it out of the scope as a reused part.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a class the index found standing in for a local variable is reported
class Tally {
  total = 0;
  add(row: number) {
    this.total += row;
  }
}

```

Code this rule accepts.

```ts
// a class expression carries no declared name to match
const Tally = class {
  total = 0;
};

```

```ts
// a class handed to the module surface with no name of its own carries nothing to match
export default class {
  total = 0;
}

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Publishing the class solely to clear the report. That is one of the cut-offs; the mutable state has not moved
- Rewrapping the same state in a single-element collection or a map. Other rules of this set report that
- Leaving the instance unused so nothing can leave the scope. Building a value nobody reads is its own problem

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `containedMutableCell` | A class must not stand in for a mutable local variable. \`{{className}}\` writes {{fields}} after construction, its only instance is built inside \`{{scope}}\`, and that instance never leaves that scope. Decide the value this class stands in for inside an immediately invoked function that returns from each branch, or fold the iteration into a \`reduce\`. Keep a mutable boundary as a reused part that leaves this scope and hands its users a read-only face. Take this report as an instruction to write the derivation, not as a verdict on the design. |
| `containedMutableCellInPlace` | A class must not stand in for a mutable local variable. \`{{className}}\` writes {{fields}} after construction, its only instance is built inside a single unnamed function, and that instance never leaves that scope. Decide the value this class stands in for inside an immediately invoked function that returns from each branch, or fold the iteration into a \`reduce\`. Keep a mutable boundary as a reused part that leaves this scope and hands its users a read-only face. Take this report as an instruction to write the derivation, not as a verdict on the design. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
