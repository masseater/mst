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
- Shipped in the preset: yes
- Source: [`no-reassign--use-spread-or-iife.ts`](../../src/lint/oxlint/rules/no-reassign--use-spread-or-iife.ts)

<!-- END GENERATED rule-header -->

## Violation

Every mutation shaped as an assignment. The judgment runs on syntactic shape alone: neither type information nor scope analysis is used.

| Shape | Message | Example |
| --- | --- | --- |
| A rebindable declaration | `reassignableDeclaration` | `let pending = 1;` / `var queued = 2;` |
| A write to an existing identifier binding | `identifierAssignment` | `pending = 2;` / `pending += 2;` / `pending ??= 2;` |
| Incrementing or decrementing an identifier binding | `identifierUpdate` | `pending++;` / `--pending;` |
| A write to a property of an existing object | `propertyAssignment` | `base.count = 1;` / `items[0] = 3;` / `items.length = 0;` |
| Incrementing or decrementing a property | `propertyUpdate` | `base.count++;` / `--items[0];` |
| A standard call hiding a property assignment | `mutatingCall` | `Object.assign(base, patch);` |
| Deleting a property | `propertyDeletion` | `delete base.count;` |
| A pattern assignment with no declaration | `patternAssignment` | `[first, second] = pair;` / `({ count } = holder);` |

A rebindable declaration is reported whether or not it is actually reassigned. The moment the intent "assign later" appears in the shape of the declaration, the declaration no longer shows the final value.

`mutatingCall` covers only five, and only as a direct call not going through a computed property: `Object.assign`, `Object.defineProperty`, `Object.defineProperties`, `Object.setPrototypeOf`, `Reflect.set`. The contents of the first argument are not inspected, so a non-destructive use handing over a freshly made object is reported too. Settling whether the first argument is an existing binding would need scope or type analysis, and that use can be written with a spread.

A loop head that is an existing write target rather than a declaration, as in `for (entry of entries)`, is reported under the same classification: `identifierAssignment` for an identifier head, `propertyAssignment` for a member expression, `patternAssignment` for a pattern.

Type assertions, `satisfies`, non-null assertions and optional chains are peeled transparently before the judgment. `(base.count as never) = 1`, `base!.count = 1` and `delete base?.count` are reported like their unwrapped forms. Without peeling, wrapping alone would take the detection off.

Report positions by shape: the write target itself for assignments and updates, the whole `delete` expression for deletions, the whole call expression for mutating calls, and the whole declaration statement for declarations.

### What is not detected

The exceptions are a closed enumeration. A shape absent from it is treated as a violation.

**A single binding at declaration.** `const` declarations generally (including one statement carrying several declarators), a new declaration using a pattern (an array pattern, an object pattern, one carrying a rest), `using` and `await using` declarations, and the loop variable of an iteration form that creates a fresh binding per round, as in `for (const entry of entries)` and `for (let key in holder)`.

`for (var entry of entries)` is not in the exceptions. `var` merely overwrites one function-scoped binding each round rather than producing a separate binding per iteration.

**A declaration with no run-time binding.** An ambient declaration such as `declare let pending: number;`, and declarations inside `declare module "m" { ... }`. Declaration files (`*.d.ts`, `*.d.mts`, `*.d.cts`) are out of scope as whole files. A namespace with no `declare`, as in `namespace Registry { let pending = 1; }`, creates run-time bindings and is in scope.

**A direct write to `this` or `super` for a class to initialize and maintain its own state.** The only syntactic exception, and narrow.

- Limited to a write whose root is **directly** `this` or `super`. A path one step deeper, as in `this.a.b = next`, is a violation
- The nearest non-arrow function scope owning that `this` must be a class member: a method including the constructor, an accessor, a field initializer, an `accessor` field, or a static initializer block
- Arrow functions carry no `this` of their own and are transparent to the judgment. An arrow written inside a class member is inside the exception
- An ordinary function carrying its own `this` is outside the exception even when written inside a class body
- `this` inside an object literal method, and a top-level `this` belonging to no function, are outside
- Assignments, compound assignments and updates are covered; a deletion (`delete this.x`) is not
- Writing `this.x` as an element inside a pattern assignment (`[this.count] = pair;`) is not covered either

This exception exists to let a way of giving a class state through mechanically, not as grounds that the assignment is warranted.

**A reference that is not a write.** Reading a property, comparing, using it in a condition.

**A call of the same name on a different target.** `helpers.assign(base, patch)`, `globalThis.Object.assign(base, patch)`, `Object["assign"](base, patch)` and `Object.keys(base)` are all outside `mutatingCall`. Only a direct, non-computed reference from the enumerated global names is read.

**A deletion that is not a property deletion.** A `delete` expression whose target is not a member expression, such as `delete parse(text)`.

**A shape that never comes up for evaluation.** A write target that is neither an identifier, a member expression nor a pattern. That is syntax which does not hold at run time and is not this invariant's concern.

### The invariant

Every binding is single-assignment, and its final value is settled at the declaration. Knowing what a name points at never requires reading past the declaration line.

**The reading cost closes at the declaration.** With reassignment possible, settling a name's value means following the whole scope. Enforce single assignment and the value is settled the moment the declaration line is read. The effect grows with the length of the scope.

**Uninitialized intermediate states disappear syntactically.** Declaring first and assigning in each branch necessarily creates a "no value yet" state and admits the failure shape of a branch that forgot to assign. Move the branching inside an immediately invoked function and return from each path, and what is visible from outside is a settled value alone — that failure shape is gone.

**A shared reference stops acting at a distance.** Rewrite an object's contents after handing it elsewhere and the receiver's behaviour depends on call order. Fix the shape to making a new value and handing that over, and the value at the moment of handing over does not change afterwards.

**A partial prohibition always leaves a way out.** That is why eight shapes are bound into one rule. Forbid rebindable declarations alone and the same thing is done by rewriting a property of an object bound with `const`. Forbid property assignment alone and the same change passes by being restated as the function call `Object.assign`. Forbid assignment to identifiers alone and the same rebinding is done through pattern assignment syntax. All break the same invariant; only the way of breaking it differs.

### Suppression

This rule accepts no suppression. Where a violation is structurally unavoidable, that alone is not grounds for writing one — being unavoidable and being suppressible are different things. Leave it as a violation and bring it to review.

The one exception is an external API operable only by assignment, handled through `assignOnlyTargets` rather than a suppression: rather than a writer silencing one site, one list naming write targets holds across every file. A write target not named there is reported even where it is unavoidable.

### The division with no-array-mutation--derive-new-array

Mutation shaped as an assignment — index assignment (`items[0] = next`) and assignment to `length` included — is this rule's, without reading types.

A method call rewriting the receiver itself is not detected here. That is a line of division rather than a miss: without the receiver's static type it cannot be told from a different API of the same name, and that does not sit on this rule's premise of judging on syntactic shape alone. An array's destructive methods are [no-array-mutation--derive-new-array](./no-array-mutation--derive-new-array.md)'s, as far as the receiver's static type can be settled as array-like.

Shapes riding on neither syntactic detection remain: a receiver typed `any` or `unknown` or carrying no annotation, a call through a key settled at run time, `call` / `apply` / `bind` or passing the function as a value and calling it, hiding by casting to a non-array type, and the destructive methods of maps and sets. Those are "not detected, not permitted", treated as violations by the norms and refused in review.

### Configuration

`assignOnlyTargets` (a list of strings, default empty). A deployment names the write targets of external APIs that can only be settled by assignment.

```jsonc
["error", { "assignOnlyTargets": ["RuleTester.describe", "RuleTester.it"] }]
```

The rule itself holds exactly one, `process.exitCode`, and that one **always** passes. What the option names is added to it, not a replacement. There is no need to list `process.exitCode` to keep it, and listing it cannot remove it.

`process.exitCode` sits in the rule because it is a circumstance of the language runtime: assignment is the only way to return a process exit code from a module-scope entry, and `process.exit` does not wait for writes to complete. That constraint holds at every deployment. That oxlint's `RuleTester` takes `describe` and `it` only through static setters is a circumstance of the deployment writing lint rules alone, and that one is named through the option.

The condition for listing is "that API has no means of configuration other than assignment", not "it is a target somebody wants to rewrite".

Matching is exact against the shape `receiver.property`, not going through a computed property. `process['exitCode'] = 1` does not match and is reported. `process.env = {}` is a different property and is reported too.

**There is no option switching detection shapes.** The shapes are different expressions of one invariant, so a per-shape switch would let somebody build a configuration with a hole open from the start — "forbid property assignment but allow the same thing restated as a function call". What `assignOnlyTargets` narrows is not a shape but one named write target at a time.

The severity is settled on the configuration side, and it must be identical across every shape. Differing severities between shapes amount to having given the rule an option.

The rule itself does not narrow by file kind. Declaration files alone are out of scope, on the grounds that they hold no run-time binding. Whether to exclude test code or generated code is settled by `overrides` on the configuration side.

## Fix

The fixes reduce to two kinds. Choose by what was being attempted.

1. **You wanted to "edit" an existing object.** Make a new value without changing the existing one: assemble a new object with a spread, take the remainder with a rest destructuring to drop a key, or get a new collection with `map` / `filter` / `reduce`
2. **The value is settled later (a branch, a search, an aggregation, exception handling).** Settle it inside an immediately invoked function and return from each path. From outside it reads as a single-assignment declaration

The derived stock forms:

| Original shape | Replacement |
| --- | --- |
| A value settled two ways by a condition | A conditional expression |
| A value settled by many branches | Return from the branches inside an immediately invoked function |
| A value settled by exception handling | Return from try / catch inside an immediately invoked function |
| A sum or a fold | `reduce` |
| Collecting elements matching a condition | `filter` / `map` |
| A search that stops when found | Return from a loop inside an immediately invoked function |
| A loop advancing an index | An iteration form, or an iteration method receiving the index |
| Dropping one key | Take the remainder with a rest destructuring |

**Two special but frequent shapes.**

To add information to an error, a spread cannot reassemble an error-like object: the prototype is lost and the non-enumerable `message` drops. The mutating APIs cannot be used either. Define a subclass and take the addition as a read-only field from the constructor's arguments. Where it imitates an existing library's error type, using the real error type that library publishes beats a subclass of your own.

To replace a real object's method in a test, rewriting the object with a mutating API evades the type check as much as it evades immutability: the replacement is not reconciled against the original signature. Use the test framework's spy or mock API, which is type-checked against the real signature and can be restored.

**Escaping into a class is not a general fix.** Because of the syntactic exception, moving the assignment inside a class stops the report. The mutable state has not disappeared; only its location changed. A class introduced solely to stop a report is a bypass and is not accepted.

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

Each of these changes only the syntax and leaves the same mutability; the report clears and the invariant is unmet.

- Restating it as a mutating API. It replaces a property assignment with a function call and means the same thing
- Binding a mutating API to another name and calling that, or calling it through a computed property. Syntactic shape cannot detect it; by the norms it is a violation and is refused in review
- Using a mutable collection holding a single value as a cell and swapping it in place. Swapping by index (`cell[0] = next`) is detected as `propertyAssignment`; no exclusion may be added on the grounds that it is a one-element array. Swapping through a map's or a set's methods cannot be detected by syntactic shape and is refused in review as a violation of the norms
- Wrapping the write target in a type assertion or a non-null assertion. They are peeled before the judgment, so the report stands
- Hiding a rebindable declaration inside an immediately invoked function. A smaller scope does not make it non-rebindable. An immediately invoked function is a tool for removing that declaration, not a place to hide it
- Introducing a class solely to stop a report

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
