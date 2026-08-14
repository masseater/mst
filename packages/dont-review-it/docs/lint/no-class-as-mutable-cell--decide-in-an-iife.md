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

A class declaration meeting **all** of the following. The report points at the class name. The three being a conjunction is what keeps false reports out: drop any one and a reusable component can no longer be told from a local variable in disguise.

**1. It carries at least one member that writes instance state outside the constructor.**

Assignment, compound assignment, increment and decrement, and property deletion are not distinguished. Only writes rooted at `this` count, so both `this.total = x` and `this.seen.at = x` are targets, and the report carries the field name directly under the root (`seen` for the latter). A field unreachable from outside the class (`this.#count`) counts the same and is reported with its `#`. Three spellings of a key are treated as one: dot notation, a subscript written as a string literal, and a subscript written as a template literal carrying no substitution.

"Outside the constructor" is settled by when it runs.

- A write written directly in the body of a method, a getter or a setter is a target
- A write written directly in the constructor body or in a field initialiser is not. Once initialisation is done the state is settled, and it does not stand in for a local variable
- A write placed inside an arrow function is a target wherever it was written. A handler the constructor put on `this`, and a function held in a field, both actually run after initialisation
- The inside of a function carrying its own `this` (a function declaration or a function expression) is not a target. The `this` there is not the instance
- Members carrying `static`, and static initialisation blocks, are not targets. That is state the class itself holds, not the mutable state of one instance

**2. Instances are built inside exactly one function scope.**

Any number of times inside that one function is fine. These are all out of reach:

- A class never built at all
- A class built at a module's top level, in a field initialiser, or in a static initialisation block (none of which is a function scope)
- A class built from two or more function scopes

**3. The instances built never leave that scope.**

Every reference to the binding that received an instance is read one at a time to see whether it stands where the value travels outward. Any of these counts as having left, and takes the class out of reach:

- It is part of the value of a `return`, a `throw` or a `yield`
- It is the right-hand side of an assignment
- It is the initialiser of another binding (making an alias)
- It is part of an argument to a call, a `new`, or a tagged template
- It stands on the module's published surface
- It is captured by an inner function, **and that function itself leaves by any of the above**

Conditionals, logical operators, sequences, array literals, object literals, spreads and changes of type (assertions, `satisfies`, non-null assertions, optional chains, template literals) are taken as merely carrying the value: the wrapper is peeled and the position outside it is judged. Conversely, a reference that is only the target of a member access (`tally.add(row)`, `tally.total`) has not left. What travels there is the property's value, not the instance.

Only the inner-function case is two-staged: being captured is not leaving, and it leaves only once that function travels somewhere. That keeps one local helper from clearing the report — without it, writing `const bump = () => tally.add(1);` would be enough to escape.

### Three cut-offs standing in front of the three conditions

Conditions 1 to 3 describe "this class is a local variable in disguise" and do not guarantee that **only** this class is used that way. With no type information, identity can only be tracked by matching names, which leaves room to mistake another class's use for this one's. Three cut-offs run first and close that room. All three only ever reduce reports.

- **A class on the module's published surface.** It can be built from outside, so what this walk counted cannot be claimed to be all of it
- **A file where that name is read anywhere but at a construction.** Using it as a base class, handing it to a function as a value, binding it to another name, listing it on a published surface — each is a route to being built out of sight. A name written in type position (an annotation, a type argument, an implements list) does not count here, because the walk does not follow the branches carrying types, so `const tally: Tally = new Tally();` is not cut off
- **That name being constructed in a file that does not itself declare a class of that name.** That file's `new` might point at another class, or at this one. Neither can be settled, so nothing is reported. Where each file declares its own class of the same name, no mix-up is possible and both proceed to the judgment

### Why the type checker is not used

The invariant is stated by tracing an instance's escape through the types it was handed to. The oxlint JS plugin in this repository has no type information, so that judgment is replaced by **the positions of references to the binding**, and the positions listed under 3 are that range.

The difference shows in the direction of reports. Every shape whose escape cannot be settled from the position of a reference (being passed as an argument, an inner function travelling outward) is pushed to the "has left" side, so the replacement adds no new false reports. What it loses is reports: shapes that are in fact closed but read as having left — such as handing it to an iteration method that takes a callback and calls it immediately — fall out of reach.

A walk of the whole repository is used. It is needed to count constructions outside the file being checked, and to judge the third cut-off. The walk's entry points exclude verification files, so a class built only inside tests is counted as never built and is not reported.

### The invariant

A class exists to build an abstraction that holds state. A reader meeting a class declaration may assume it is a reusable component.

The first layer is that [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md) carries exactly one syntactic exception: direct writes to `this` by which a class initialises and maintains its own state are out of that rule's reach. That exception is needed to let writing stateful classes pass mechanically, and it is simultaneously a certain way out — a forbidden reassignment stops being reported by being wrapped, on the spot, into a class and made a field on `this`.

The second layer is that prose cannot close that route. "A class introduced solely to stop a report is not accepted" describes an intent, and intent is not something static analysis reads. Closing it takes a condition that reads a shape rather than an intent. Rewrapping a local variable has a shape: the instance is built only inside one function scope and never leaves it. A genuine mutable boundary is built to hold state across callbacks or calls under a framework's control, so it always travels out of the scope or is used from several places. That difference can be settled statically.

A shape meeting all three conditions is, by definition, mutable state that lives and dies inside that function. That is the same thing as a local variable, and the class syntax has added nothing about the value's lifetime.

### What is deliberately not a violation

- A class instantiated from two or more places, or from several function scopes. That is a reusable component and what tidying mutable boundaries is for
- A class whose instances leave the scope. Holding state across callbacks and handlers lives here
- A class whose state is settled by the constructor and field initialisers alone. It does not change after initialisation and does not stand in for a local variable
- A class holding no state, gathering methods alone. Nothing to do with mutability
- State the class itself holds (`static` members and static initialisation blocks). Not the mutable state of one instance
- A local suppression carrying its grounds. The conditions of acceptance are the same as for the other rules of this bundle and are checked by [no-blanket-suppression--name-and-record](./no-blanket-suppression--name-and-record.md). Until the directive notation is settled no suppression is accepted at all, so this implementation reads none

### What is not detected and still not allowed

Nothing below is permitted. Each is a shape this rule does not report, and each is a violation under the guidelines, rejected in review.

- **A class on the module's published surface**, and **a class in a file where the name is read anywhere but at a construction**. These are the cut-offs above: putting something on a published surface does not justify local mutable state
- **A class of the same name being constructed from another file.** Identity cannot be settled from the name alone, so nothing is said
- **Using an instance without binding it to a name**, built and dropped on the spot. Condition 1 may hold while the state is never read, which is a different problem — building a value nobody uses
- **Writing instance state through a key settled at run time** (`this[key] = 1`). The field name of condition 1 does not settle, so it is not counted as a write
- **Handing the instance to a local helper function as an argument.** Even where the callee is closed, it is pushed to the "has left" side and falls out of reach
- **A class expression** (`const Held = class { ... }`). Not a declaration, so it cannot be tied to the name at a construction
- **A class built only inside verification files.** The walk's entry points exclude them

### Left open for now

- **Settling identity by resolving relative specifiers.** The cut-offs currently match on names alone and do not follow `import` specifiers to settle which file's class it is. Adding resolution would move the first two of the undetected shapes onto the reporting side, and would require settling how far the workspace's resolution rules are reproduced

### Configuration

None; only on or off is offered. Making any of the three conditions switchable would, the moment one is switched off, make either a false report or a miss the normal state.

This rule is one of a bundle and is not something to enable on its own. Its severity and the timing of its enablement line up with [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md), and that they line up is checked by [no-partial-rule-set--enable-the-whole-set](./no-partial-rule-set--enable-the-whole-set.md) through its walk of the lint configuration.

The judgment presumes a walk of the whole repository, assembled once per repository and reused.

## Fix

Go back to what you were trying to do before wrapping it in a class, and take that fix instead. The fixes are the same ones [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md) offers for "the value is settled later".

- Settled by a branch, a search, an aggregation or error handling: settle it inside an immediately invoked function and return from each path
- Accumulated by iteration: replace it with `reduce`
- Genuinely needing to hold state across callbacks: a class is right. Move it out of the scope as a reusable component. The moment it leaves, condition 3 breaks and the report clears. Where the consumer then writes to its state, [no-receiver-mutation--derive-new-value](./no-receiver-mutation--derive-new-value.md) reports that at the call site

No automatic fix is offered. Rewriting into an immediately invoked function carries a choice of which value to return and does not settle mechanically. As a consequence, the routes by which a writer learns the fix are the report message and this document.

The report message is written to read as "change how the value is settled" rather than "delete the class". Read as an accusation against the class itself, a writer moves the same mutable state into another container and runs into another rule of the bundle. What is to be avoided here is touring the bundle in search of a shape that clears the report.

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

```ts
// a class built inside a function with no name of its own is reported in place
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

- **Leaving only a form where the instance is used nowhere, to break condition 3.** Building a value nobody uses is a problem in itself and outside what this bundle is for
- **Rewrapping the same local state in a single-element mutable collection or a map instead of a class.** Swapping through a subscript is reported by [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md), and swapping through a method by [no-array-mutation--derive-new-array](./no-array-mutation--derive-new-array.md) and [no-receiver-mutation--derive-new-value](./no-receiver-mutation--derive-new-value.md)
- **Putting the class on a published surface solely to clear the report.** That is the first of the cut-offs. The machine goes quiet and the mutable state has not gone
- **Silencing it with a generic lint disable comment.** [no-blanket-suppression--name-and-record](./no-blanket-suppression--name-and-record.md) reports that

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
