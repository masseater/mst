---
description: "Disallow calling a method that writes to a receiver which is not an array - a collection, a moment, a query string, a form, a sink, or a class of one's own whose body writes to `this` - so a changed value always appears as a newly derived binding"
---

# no-receiver-mutation--derive-new-value

<!-- BEGIN GENERATED rule-header -->

Disallow calling a method that writes to a receiver which is not an array - a collection, a moment, a query string, a form, a sink, or a class of one's own whose body writes to `this` - so a changed value always appears as a newly derived binding

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `state`
- Source: [`no-receiver-mutation--derive-new-value.ts`](../../src/lint/oxlint/rules/state/no-receiver-mutation--derive-new-value.ts)

<!-- END GENERATED rule-header -->

## Violation

A call to a method that writes to a receiver which is not an array. Five reports.

- A built-in whose type and method name together name a writer. The pair settles it, so the method name alone never does
- A write to a sink, where what leaves the program has no new value to derive
- A method of a class this repository declares whose body writes to `this`. The judgment follows the body, wherever that class is declared
- A method name from the writing vocabulary called on a receiver typed `any` or `unknown`, where the receiver could not be settled
- A method of a writing type reached through a key that only settles while the program runs, where a numeric index is not one

Arrays and index writes belong to [no-array-mutation--derive-new-array](./no-array-mutation--derive-new-array.md) and [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md).

## Fix

Derive the value you need and bind it; the report names the derivation for a built-in. Have a class method of your own return a new instance and bind what it returns.

For a sink, build the whole payload and hand it to whoever owns the sink.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// setting an entry writes to the associative collection
const counts = new Map<string, number>();
counts.set('a', 1);
```

```ts
// a write pushed one method deeper is still a write to the instance
class Bag {
  held: string = '';
  add(entry: string) {
    this.keep(entry);
  }
  keep(entry: string) {
    this.held = entry;
  }
}
const bag = new Bag();
bag.add('a');
```

Code this rule accepts.

```ts
// reading an entry out of an associative collection leaves it as it was
const counts = new Map<string, number>();
counts.get('a');
```

```ts
// a writing method name on a type outside the enumeration is another operation
const store = new CookieStore();
store.set('a', 'b');
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the write into another method the first one calls. The judgment follows the body
- Widening the receiver's type to `any` or `unknown`. That shape is reported on its own
- Reaching the method through a key settled at run time. That shape is reported too

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `builtinReceiverMutation` | \`{{method}}\` must not be called on a \`{{type}}\`: it writes to the receiver in place of handing back a new value. Derive the value you need and bind it. {{derivation}} The pair of the type and the method name settles this report, not the name on its own. Carrying the same write over to an array or to an index write is reported by \`no-array-mutation--derive-new-array\` and \`no-reassign--use-spread-or-iife\`. |
| `sinkReceiverMutation` | \`{{method}}\` must not be called on a \`{{type}}\`: it writes to the receiver, and a write that leaves the program has no new value to derive. Build the whole payload and hand it to whoever owns the sink. |
| `declaredClassMutation` | \`{{method}}\` must not be called on a \`{{type}}\`: its body writes to \`this\`, and the call changes the receiver where it stands. Return a new \`{{type}}\` from that method and bind what it returns. The judgement follows the body, so moving the write into a method that one calls leaves this report standing, and holding the same state in a collection is reported too. |
| `collapsedReceiverMutation` | \`{{method}}\` names a method that writes to its receiver, and a receiver typed \`any\` or \`unknown\` must not carry a name from that list. Give the receiver a settled type, and derive a new value in place of writing to the one at hand. This report stands on a receiver that could not be settled, not on one settled as a writer. |
| `runtimeKeyReceiverMutation` | A method of a \`{{type}}\` must not be reached through a key that settles only while the program runs: the name being called cannot be read here, and the writing methods of \`{{type}}\` are reachable this way. Write the method name out, or derive a new value in place of writing to the one at hand. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
