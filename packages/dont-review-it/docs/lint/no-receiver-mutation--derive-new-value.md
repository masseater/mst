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
- Shipped in the preset: yes
- Source: [`no-receiver-mutation--derive-new-value.ts`](../../src/lint/oxlint/rules/no-receiver-mutation--derive-new-value.ts)

<!-- END GENERATED rule-header -->

## Violation

A member expression where the pair of the receiver's type and the member name can be settled as "writing to the receiver itself". The report stands on the method name rather than on the whole expression.

Not limited to the call shape. Taking the method as a value (`const write = counts.set;`), and going through `call` / `apply` / `bind` (`counts.set.call(counts, 'a', 1)`), are the same member expression and are reported on the spot. Reporting at the moment it is taken out means the route of passing it on as a function value and calling it later cannot be built at all.

There are three judgment routes, and the message distinguishes which one hit.

**1. A fixed enumeration of built-in types and methods**

Held as pairs of a type name and a method name. A name match alone is not reported.

| Type | Writing methods |
| --- | --- |
| `Map` / `WeakMap` | `set` / `delete` / `clear` |
| `Set` / `WeakSet` | `add` / `delete` / `clear` |
| `Date` | `setTime` and the per-unit setters (from `setFullYear` through `setUTCSeconds`) |
| `URLSearchParams` | `append` / `set` / `delete` / `sort` |
| `FormData` / `Headers` | `append` / `set` / `delete` |
| `DataView` | The writing family from `setInt8` through `setBigUint64` |
| `WritableStreamDefaultWriter` | `write` / `close` / `abort` |
| `ReadableStreamDefaultController` / `ReadableByteStreamController` | `enqueue` / `close` / `error` |
| `TransformStreamDefaultController` | `enqueue` / `terminate` / `error` |

The last four are reported as sinks, with a different message. They cannot be rewritten as derivations, so the fix differs.

The enumeration is closed. Whether to add other mutable objects the runtime offers is settled at deployment. Where they go is this table, not an exemption list.

**2. Body analysis of a class whose body this repository can read**

Where the receiver's type is a class declared in this file, or one resolvable to a file inside this repository through a relative import, that method's body is read. Where the body writes to `this` (assignment, compound assignment, update, property deletion), the method counts as writing to the receiver.

**The judgment closes transitively.** Where that method calls another method of `this` and that one writes to `this`, the calling method counts as writing too. Stop at one step and pushing the write one method inward clears the report. The member set is finite, so it stops at a fixed point, and mutually calling methods are handled with a visited marker.

What a constructor, a field initializer or an accessor writes is not counted: they do not take the call shape, and they belong to the rule that reads assignments. A write inside an ordinary function carrying its own `this` is not counted either. An arrow function inherits the enclosing `this` and is counted.

**3. A receiver whose type has collapsed**

Where the receiver's annotation is `any` or `unknown`, the report stands on **a method name match alone** against the enumeration in 1. It cannot be judged as a pair, but being unsettleable is no grounds for permission, so it falls on the safe side. The message says "could not be settled as not writing" rather than "settled as writing".

**A key settled only at run time**

Where the judgments above settle the receiver's type and that type carries writing methods, a call through a key that does not settle statically (`counts[picked]('a', 1)`) is reported. Not, however, where the key is a numeric literal, a binding carrying a numeric annotation, or a binding initialized with a numeric literal. That shape is an element call on a collection holding functions rather than a method call.

**Names and wrappers**

Method names are read alike in the three spellings that settle statically: dot notation (`counts.set(...)`), a string-literal subscript (`counts["set"](...)`), and a template-literal subscript with no substitution (``counts[`set`](...)``).

Type assertions, `satisfies`, non-null assertions and optional chains are peeled before the judgment. Where the type is readable from the expression before the wrapper, that is used; where it is not, the type the assertion names is used. No state is left where wrapping alone takes the detection off.

There is no exemption by origin. A write to a value just made on the spot (`new Date().setHours(0)`) is reported.

### Not using type information

The statement of the invariant settles the judgment on "the receiver's static type". This repository's oxlint JS plugin has no type information, so that judgment is implemented **narrowed to what syntax can settle**. The range:

- The constructor name of a `new` expression (`const counts = new Map<string, number>();`)
- A binding's type annotation (`const publish = (counts: Map<string, number>) => ...`). A union or an intersection is in scope where any constituent hits
- A type parameter's constraint (`<Counts extends Map<string, number>>`), followed through the constraint
- A binding inside the same file, following the declaration's annotation and its initializer

Where a type name is bound to a declaration or an import in this file, the built-in enumeration is not consulted: the same name is a different thing. Only route 2 is read there, and where the class's body cannot be read, nothing is reported.

### The invariant

A bound value is not rewritten by a method call it receives. Seeing an object a name points at, one may assume its contents are as they were when it was made. The assumption holds whatever the type.

Two layers of reason. The first is that the fact of the change does not appear in the shape of the calling line. `counts.set('a', 1)` changes the receiver rather than the return value, so reading that line does not say what changed, and reading becomes a matter of classifying method names one by one as destructive or not. The second is that the effect leaves the call site: whoever shares the reference is changed in a way they cannot follow without reading the code that wrote.

This rule is one of three dividing the same invariant. [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md) takes the assignment shape without reading types, [no-array-mutation--derive-new-array](./no-array-mutation--derive-new-array.md) takes method calls on array receivers, and method calls on non-array receivers arrive here. Without one of them, the same operation leaves the discipline by moving to a map, a set or a class of your own. Enable the three together.

Not settling destructiveness by name alone is the same reason. `set`, `add`, `append` and `delete` are widely used by APIs that write nothing. Judging on the pair of type and method name is the premise this rule stands on.

### Configuration

None. Only the on / off switch is offered: no adding or excluding target types and methods, and no narrowing by file.

Make exceptions expressible as configuration and the room to judge "does this count as an exception" returns per violation, losing the very purpose of fixing the spelling to one. An argument that an exception is needed is treated as an argument about whether to enable this rule, not about a setting's value.

This rule is part of a set. Enable it at the same severity and at the same time as [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md) and [no-array-mutation--derive-new-array](./no-array-mutation--derive-new-array.md). Introduce only part and a period arises where only some shapes of one invariant are enforced.

### Not violations

Two groups, on different grounds.

**(a) Deliberately not violations**

- Method calls that do not write to the receiver: reading, searching, transforming, deriving a new value. `counts.get('a')` and `seen.has('a')` are out of scope
- Calling an enumerated name on a receiver whose type is not enumerated. The judgment is by pair, so a name match with a type mismatch is not reported
- Method calls on an array-like receiver. `no-array-mutation--derive-new-array` takes them; two rules do not report one call twice
- Mutation shaped as an assignment (`held.at = stamp` / `items[0] = x`). `no-reassign--use-spread-or-iife` takes it
- A write to `this` inside a method body for a class to initialize and maintain its own state. This rule reads call positions, not definition positions
- An element call through a key whose static type is assignable to a number (`handlers[0]()`). That is element access rather than a method call
- A type name bound to a declaration or an import in this file. The built-in enumeration is not consulted

**(b) Not detected, and not permitted**

Drop this label and both the implementer and the writer misread it as permission. The shapes here are ones this rule does not report; they may not be written. By the norms they are violations and are refused in review.

Because type information is not used, this range is wider than the statement of the invariant assumed.

- **A receiver reached through a property** (`this.counts.set(...)` / `state.counts.set(...)`). The property's type lives on the declaring side and cannot be read from the call expression
- **A function's return used directly as the receiver** (`loadCounts().set('a', 1)`). A call expression carries no type annotation
- **An annotation through a type alias** (`counts: Counts` against `type Counts = Map<string, number>`). Following an alias needs type resolution
- **An unannotated parameter or binding**, and a binding taken out by destructuring or by iteration
- **A class taken in from a package.** The inside of `node_modules` is not read, so body analysis does not apply. Crossing one or more re-exports is the same
- **An external type with a declaration and no body.** The statement of the invariant placed a safe-side route here for "a method returning `void` or the receiver's own type", but in an environment without type information the return shape cannot be read, so it is not implemented. Where such a shape needs catching, add it to the built-in enumeration
- **Binding a type carrying writing methods to another name outside this file and using that**

## Fix

Leave the original value alone and build a new value of the shape you need, then bind it.

| Receiver | The derivation |
| --- | --- |
| A map | Spread the original contents into a new `Map`. To drop an entry, build a narrowed sequence from the original and assemble from that |
| A set | Spread likewise into a new `Set` |
| A moment | Rather than advancing with setters, make a new `Date` holding the time you need |
| A query string, a form, headers | Build the assembled state in one go. Do not make an empty one and add to it |
| A view over bytes | Make a new buffer and read from a new view |
| A class of your own | Make the method return a new instance rather than rewrite state |

This package's own `lib/receiver-mutation/mutating-members.ts` takes the latter shape: assembling the enumeration builds `new Map(...)` in one go from an array of pairs rather than making an empty `Map` and lining `set` calls up. A reader settles its contents from the declaration line alone.

A write to a sink cannot be rewritten as a derivation: it is output to the outside world and means something different from rewriting a bound value. Where that shape appears, put it through the proper suppression procedure. A suppression is limited to a dedicated directive carrying a reason, and a general disabling comment is reported by [no-silent-suppression--fix-or-justify-inline](./no-silent-suppression--fix-or-justify-inline.md). Requiring a reason and a record of approval is the machine's condition for accepting it, not advice for whoever writes one.

There is no automatic fix. It involves choosing what shape of new value to build, which does not settle mechanically on one answer.

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

- **Taking the method as a value and calling it, applying it through `call` / `apply` / `bind`, or looking it up by a key settled at run time.** All are reported; both the extraction position and the key position are read
- **Wrapping the receiver in an assertion to hide it from the judgment.** Wrappers are peeled before the judgment
- **Moving the same operation onto an array or an index assignment.** The other two rules of the set report it
- **Pushing the write one method inward.** Body analysis closes transitively, so the report does not clear
- **Rewrapping into a class solely to stop a report.** The consumer calling that mutator is reported by this rule
- **Silencing it with a general lint-disabling comment.** [no-silent-suppression--fix-or-justify-inline](./no-silent-suppression--fix-or-justify-inline.md) reports it

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
