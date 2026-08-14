---
description: "Disallow calling an array method that changes the receiver in place, so a changed array always appears as a newly derived binding"
---

# no-array-mutation--derive-new-array

<!-- BEGIN GENERATED rule-header -->

Disallow calling an array method that changes the receiver in place, so a changed array always appears as a newly derived binding

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-array-mutation--derive-new-array.ts`](../../src/lint/oxlint/rules/no-array-mutation--derive-new-array.ts)

<!-- END GENERATED rule-header -->

## Violation

A method call that meets two conditions at once. The report points at the method name, not at the whole call expression.

**The method called is one of the nine that change the receiver in place.**

| Method       | What it does               |
| ------------ | -------------------------- |
| `push`       | append to the end          |
| `pop`        | take from the end          |
| `shift`      | take from the front        |
| `unshift`    | prepend to the front       |
| `splice`     | replace a range            |
| `sort`       | reorder                    |
| `reverse`    | reverse                    |
| `fill`       | assign across a range      |
| `copyWithin` | copy inside the same array |

The ES2023 copy-by-change methods (`toSorted`, `toReversed`, `toSpliced`, `with`) are not reported. They return a new array without touching the receiver, which is the derivation this rule asks for.

Three spellings of a method name are read as the same one: dot notation (`items.sort()`), a subscript written as a string literal (`items["sort"]()`), and a subscript written as a template literal with no substitution (``items[`sort`]()``). The last two are read so they cannot serve as a way around the first.

**The receiver is settled as an array from the syntax alone.** The type checker is not consulted. These are the shapes that settle it:

- An array literal (`[...items].sort()`)
- `new Array(...)`, `Array.from(...)`, `Array.of(...)`
- A method returning a new array, called on a receiver that resolves to one of the above (`items.slice().sort()`, `items.filter(f).reverse()`). The chain is followed to any depth
- An identifier declared in the same file whose declaration carries an array type annotation: `T[]`, a tuple (`[A, B]`), a `readonly` form, `Array<T>` / `ReadonlyArray<T>`, and unions and intersections containing them. A union counts when even one member is array-like, which errs toward reporting
- An identifier declared in the same file whose initialiser is one of the above (`const items = [3, 1, 2]; items.sort();`)
- A type parameter constrained to an array type (`<Entries extends readonly string[]>(items: Entries)`). The constraint is followed
- Any of the above wrapped in a type assertion, a `satisfies`, a non-null assertion or an optional chain. The wrapper is peeled and the contents decide. An assertion to an array type (`(input as string[]).push(x)`) counts as well

Where the array came from grants no exemption. A destructive call on an array copied one line earlier is reported: `[...items].sort()` and `items.slice().sort()` are both violations. "It was just built, so it is safe" only holds once a reader has followed where that array goes next, and that is the reading cost this rule exists to remove.

An optional chain (`items?.sort()`) has the same shape and is reported the same way. It follows from how unions like `string[] | undefined` are handled and is not a case of its own.

When one expression carries several qualifying calls (`items.sort().reverse()`), each is reported on its own. Collapsing them into one report would hide what is left after the first fix.

### Why the type checker is not used

The invariant is stated over the static type of the receiver. The oxlint JS plugin in this repository has no type information, so the judgment is implemented **narrowed to what the syntax settles**, and the shapes listed above are that range.

The gap shows up in coverage, not in precision. A shape on the list reaches the same conclusion a type checker would; a shape off the list is not reported at all. Reporting on the name alone was not implemented: `push`, `sort` and `with` are widely used names on APIs that are not arrays, and matching the name alone would produce false reports at a rate no one would run with.

### The invariant

An array value is not changed after it is built. A reader who meets an array may assume it still holds what its declaration site produced.

Two layers hold that up. The first is that the change never shows in the shape of the call line. A destructive array method changes the receiver rather than the return value, so a line calling `sort()` and discarding the result still leaves the array reordered once control passes it. A reader cannot tell from the call expression whether anything changed here, and ends up classifying method names as destructive or not while reading.

The second is that the effect leaves the call site. Arrays are shared by reference. An argument handed elsewhere, a variable a closure captured, a reference held as state — all change in a way that cannot be traced without reading the code that did the writing. Anything detecting change by reference identity (memoisation, re-render decisions, diffing) misses it outright, since the contents move while the reference does not. The bug then surfaces on the sharing side rather than where the write happened.

Deriving instead removes both layers at once. A change always appears as a new value, so the call line says whether anything changed, and whoever holds the old reference is guaranteed to keep seeing the old value.

The copy-by-change methods stay off the target list because forbidding them would leave no way to reorder with the standard library alone. Writing a non-destructive helper of one's own is already closed off under this rule: the `[...values].sort()` inside such a helper is reported like any other, since provenance grants no exemption. A setup that forbids both groups and supplies a helper therefore does not stand.

This rule shares one invariant with [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md), which forbids reassignment. Enabling one without the other leaves one of the two routes open.

An option to narrow any of this is not offered. There is no way to add or remove target methods, to restrict the files read, or to condition on something like "only arrays that live a long time". Expressing exceptions as configuration brings back the per-violation judgment of whether this one qualifies, which is the cost fixing the shape was meant to remove. An argument that an exception is needed is an argument about whether to enable the rule at all, not about a setting.

### What is deliberately not a violation

- A call to a same-named method on a receiver that is not an array: `push` on a navigation client, `push` on a version-control client, a hand-written stack class, `push` on a stream. A matching name with no settled array is not reported
- Non-destructive array methods in general: `map`, `filter`, `slice`, `concat`, `flatMap`, `reduce`, `find`, `at`, `join`, `includes`, and the copy-by-change group as well. They leave the receiver alone and are the derivations this rule accepts
- Index assignment (`items[0] = x`) and assignment to `length`. Neither takes the form of a method call, so neither enters this rule. Mutation in assignment form belongs to [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md), which reads no types. That division is settled and carries no room for judgment
- Destructive methods on `Map` and `Set`. Neither rule's syntactic detection reaches them. They are violations under the guidelines and are rejected in review
- Whether the receiver is local, escapes its scope, or lives long or briefly. These are not distinguished, all are violations, and none is an exemption

### What is not detected and still not allowed

Nothing below is permitted. Each is a shape this rule does not report, which is not the same as a shape that may be written. All of them are violations under the guidelines and are rejected in review. Because no type information is used, this range is wider than the statement of the invariant would suggest.

- **A receiver reached through a property** (`this.items.push(x)`, `state.items.push(x)`). The most common shape in real code, and the property's type lives at its declaration, out of the call expression's reach
- **An imported binding** (`import { names } from "./names.ts"; names.push(x)`). The declaration is in another file
- **A binding taken out by a destructuring pattern** (`const [first] = pairs; first.push(x)`). The element's type comes from the array's element type and is not settled by the pattern
- **A function's return value used directly as the receiver** (`loadNames().sort()`). The call expression carries no annotation
- **An annotation reached through a type alias or a type from outside the workspace** (`names: Names` where `type Names = string[]`). Following an alias needs type resolution
- **Unannotated parameters and bindings**, and receivers typed `any` or `unknown`
- **A call through a key only known at runtime** (`items[key](...)`). The method name is not settled statically
- **A call through `call`, `apply` or `bind`**, and a method handed around as a binding or a callback before being called. The array is no longer in the receiver position
- **Every shape that depends on a declaration outside the file**

Hiding the receiver behind a cast to a non-array type does not belong on that list. Wrappers are peeled, so a locally declared array is still reported through one; it is a forbidden bypass, listed below.

### Left open for now

- TypedArrays (`Uint8Array` and the rest). They carry destructive sorting and range assignment, and the current judgment does not accept them as arrays. Whether to widen the accepted types to include them is undecided and is settled at deployment
- Named types and classes that extend an array. The syntactic judgment does not follow type references, so `x: Named` against `class Named extends Array {}` is not detected. That is the current implementation's answer, not a decision about whether it belongs in scope, and it is settled by watching the behaviour at deployment

## Fix

Leave the original array alone and bind a new one in the shape you need.

- Adding elements: build a new array with spread
- Narrowing or transforming: use `filter`, `map` or `reduce`. Do not start from an empty array and accumulate into it
- Reordering, reversing, replacing a range, replacing one element: use `toSorted`, `toReversed`, `toSpliced` or `with`. Each returns a new array and leaves the receiver untouched
- Reading the last element: use an accessor that reads the end directly, rather than reversing to take the first or building a copy for that alone

No automatic fix is offered. Rewriting into a derivation carries a choice of where to bind the result, which does not settle mechanically. As a consequence, the report message is the only route by which a writer learns the fix, which is why it names the derivations outright: spread, `filter` / `map` / `reduce`, and `toSorted` / `toReversed` / `toSpliced` / `with`. All are built into the language and do not depend on what a deployment picked for dependencies.

**Enabling the rule carries one precondition.** Because the fixes lean on the copy-by-change group, the runtimes a deployment ships to have to carry those four. Shipping to one that does not means supplying a non-destructive helper as an external dependency and holding the inside of that helper out of this rule's reach through configuration.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// pushing onto an annotated array is an in-place change
const items: string[] = [];
items.push('a');
```

```ts
// a copy made by spreading gets no exemption from where it came from
const items: string[] = [];
const ordered = [...items].sort();
```

Code this rule accepts.

```ts
// a non-destructive derivation on an array is the accepted form
const items: string[] = [];
const shouted = items.map((entry) => entry.toUpperCase());
```

```ts
// ordering through the copy-by-change method is an accepted derivation
const publish = (items: readonly string[]) => items.toSorted();
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- **Casting the receiver to a non-array type to hide it from the judgment.** It leaves the mutation and removes only the detection. A locally declared array is still reported through the wrapper; the shapes that get through (a property, an import) are sent back in review
- **`call`, `apply`, `bind`, or taking the method as a value before calling it.** Detection falls away while the breach of the invariant stays the same
- **Escaping into a key settled at runtime and calling through a subscript.** As above
- **Pushing the receiver past a property or a module boundary into what is not detected.** That range is the limit of detection, not a place left open to write in
- **A suppression directive.** It is not treated as something an individual writer decides. Whether suppression is allowed at all, and who records approval where, has to be settled by the deployment; until it is, leave the report standing and raise it

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `inPlaceArrayMutation` | \`{{method}}\` must not be called on an array. Derive a new array and bind it: spread the old one to add elements, \`filter\` or \`map\` or \`reduce\` to narrow or transform, and \`toSorted\` or \`toReversed\` or \`toSpliced\` or \`with\` to order, reverse, splice or replace. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
