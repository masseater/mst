---
description: "Disallow every assignment-shaped mutation - a re-bindable declaration, a write to an existing binding or property, an index or length write, a property-writing standard call, a property deletion, a pattern assignment - so the value a name holds is fixed where the name is declared"
---

# no-reassign--use-spread-or-iife

<!-- BEGIN GENERATED rule-header -->

Disallow every assignment-shaped mutation - a re-bindable declaration, a write to an existing binding or property, an index or length write, a property-writing standard call, a property deletion, a pattern assignment - so the value a name holds is fixed where the name is declared

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `mutation-and-failure`
- Source: [`no-reassign--use-spread-or-iife.ts`](../../src/lint/oxlint/rules/mutation-and-failure/no-reassign--use-spread-or-iife.ts)

<!-- END GENERATED rule-header -->

## Violation

Every assignment-shaped mutation, reported by what it writes to: a `let` or `var` declaration, a write to an existing binding, a write to a property, an increment or decrement of either, a pattern assigned to without a declaration, a property deletion, and a call to one of the standard functions that write properties (`Object.assign`, `Object.defineProperty`, `Object.defineProperties`, `Object.setPrototypeOf`, `Reflect.set`).

Three things are left alone: a write directly to `this` or `super` inside a class member, which is how a class holds its own state; the head of a `for...in` or `for...of`, where the grammar allows nothing else; and an ambient declaration or a declaration file. `assignOnlyTargets` adds member paths, beyond the platform's own `process.exitCode`, that may only be written.

## Fix

Decide the value where the name is bound: a conditional expression for two branches, an immediately invoked function returning from each branch or from `try` / `catch` for more, `reduce` for an accumulation, `filter` or `map` for a collection.

Build a new object by spreading the original and overriding the keys, and drop a key with a rest element instead of deleting it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a re-bindable declaration is reported whether or not it is written to again
let pending = 1;
var queued = 2;
```

```ts
// a property-writing standard call is reported by its shape
Object.assign(base, patch);
Object.defineProperty(base, "count", spec);
Object.defineProperties(base, specs);
Object.setPrototypeOf(base, proto);
Reflect.set(base, "count", 1);
```

Code this rule accepts.

```ts
// a single binding declaration is the shape the rule asks for
const base = load();
const first = 1,
  second = 2;
```

```ts
// a class writes its own state through a direct this or super target
class Holder {
  count = 0;
  reset = () => {
    this.count = 0;
  };
  accessor clear = () => {
    this.count = 0;
  };
  static registry = 0;
  static {
    this.registry = 1;
  }
  constructor(count: number) {
    this.count = count;
  }
  bump() {
    this.count++;
    this['count'] += 1;
  }
  get current() {
    return this.count;
  }
  set current(next: number) {
    this.count = next;
  }
}
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Wrapping the same local state in a class and writing to `this`. `no-class-as-mutable-cell--decide-in-an-iife` reports that
- Swapping the write for `Object.assign` or `Reflect.set`. Both are read
- Holding the state in an array or another receiver instead. The other rules of this set report those

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `identifierAssignment` | An existing binding must not be written to. Decide the value where the name is bound: a conditional expression for two branches, an immediately invoked function that returns from each branch or from \`try\` / \`catch\` for more, \`reduce\` for an accumulation. Derive a new \`const\` from a parameter rather than overwriting it. |
| `identifierUpdate` | An existing binding must not be incremented or decremented. Replace the counting with a derivation: \`reduce\` for a running total, the length of a \`filter\` for a count of matches, an iteration method that receives the index instead of a hand-advanced cursor. |
| `mutatingCall` | \`{{callee}}\` must not be called. Build the value in one expression: spread the sources into a new object literal and write the fixed keys in that literal. |
| `patternAssignment` | An array or object pattern must not be assigned to without a declaration. Move the pattern to the binding site: \`const [first, second] = pair;\`. |
| `propertyAssignment` | A property of an existing object must not be written to. Build a new object: spread the original and override the keys, drop a key with a rest element, or \`map\` a collection into a new one. |
| `propertyUpdate` | A property of an existing object must not be incremented or decremented. Derive the next object from the current one with a spread that overrides the key, or compute the total with \`reduce\`. |
| `propertyDeletion` | A property must not be deleted from an existing object. Take the keys to keep: destructure with a rest element (\`const { dropped, ...kept } = source;\`) and use \`kept\`. |
| `reassignableDeclaration` | A \`{{kind}}\` declaration must not be used. Declare the name with \`const\` and produce the value in a single expression: a conditional expression for two branches, an immediately invoked function returning from each branch or from \`try\` / \`catch\` for more, \`reduce\` for an accumulation, \`filter\` / \`map\` for a collection, a return from inside a loop for a search. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
