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
- Bundle: `state`
- Source: [`no-array-mutation--derive-new-array.ts`](../../src/lint/oxlint/rules/state/no-array-mutation--derive-new-array.ts)

<!-- END GENERATED rule-header -->

## Violation

A call to one of the array methods that change the receiver in place, where the receiver reads as an array.

The receiver is settled without type information: an array literal, `new Array(...)`, `Array.from` and `Array.of`, an array method that returns an array called on such a receiver, and a binding whose annotation or initializer reaches any of those. An annotation naming `Array`, `ReadonlyArray`, a tuple, a `readonly` operator or a type parameter constrained to one of those counts too. The method name is read from dot notation, a string-literal subscript and a template literal with no substitution alike.

## Fix

Derive a new array and bind it: spread to add, `filter` / `map` / `reduce` to narrow or transform, and `toSorted` / `toReversed` / `toSpliced` / `with` to order, reverse, splice or replace.

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

- Reaching the method through a computed key settled at run time. The mutation is unchanged
- Widening the binding's declared type so it no longer reads as an array. The value is still an array at run time

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
