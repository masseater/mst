---
description: "Disallow a fixture taking apart a dependency whose value it never consumes, so the dependency graph a spec declares is the data flow it has rather than an order somebody wanted the fixtures to run in"
---

# no-fixture-ordering-alias--use-auto-action-fixture

<!-- BEGIN GENERATED rule-header -->

Disallow a fixture taking apart a dependency whose value it never consumes, so the dependency graph a spec declares is the data flow it has rather than an order somebody wanted the fixtures to run in

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-fixture-ordering-alias--use-auto-action-fixture.ts`](../../src/lint/oxlint/rules/no-fixture-ordering-alias--use-auto-action-fixture.ts)

<!-- END GENERATED rule-header -->

## Violation

A dependency a fixture factory declared by a fixture builder receives in the object pattern of its first parameter, inside a spec file. One report stands per property, naming both the dependency name and the binding name.

Two ways of writing a fixture are in scope.

- The named builder form: `extend`'s first argument is a string, the factory comes second, or third where options sit in between
- The older form lining a factory up per property: `extend`'s first argument is an object whose values are factories

Both are identified from the shape of the `extend` call. What the factory's second parameter is called is not read. A function that does not go through `extend` is not a fixture, so an ordinary callback destructuring with an underscore alias is not reported. `expect.extend` registers a custom matcher rather than declaring a fixture, so despite the shared method name it is out of scope.

The judgment runs on two independent conditions, and meeting only one of them is still reported.

### Condition 1: the naming signal

Where the key name and the binding name differ and the binding name starts with one of the prefixes listed in `orderingAliasPrefixes`, `orderingAlias` is reported. Whether the body reads the value is not read.

### Condition 2: the absence of consumption

Where the factory's body does not consume the binding's value, `unconsumedDependency` is reported, regardless of aliasing or prefixes. It counts as unconsumed where either of these holds.

- The body never reads the value
- Every reference reading the value is an expression statement standing as a lone identifier, the operand of `void`, or an assignment to another binding unconsumed by the same standard

Only references reading the value are counted; writes to the binding are not. `await` in between reads the same, so an expression statement discarding an awaited result on the spot is not consumption.

The judgment closes inside the same factory's body. Handing the value to another call as an argument, reading a property, including it in the return value, and reading it inside a teardown callback the factory registered all count as consumption. Chains of assignment are followed, so where the binding it was handed to is discarded by the same standard, the original dependency is unconsumed too. Where the walk reaches a name not declared in this file, it is treated as consumed there.

A property meeting both conditions gets one report, on the naming-signal side. Both fixes are the same, so two reports are not lined up on one property.

### Not in scope

- A key settled at run time, and a numeric literal key. The dependency name cannot be identified statically
- A destructuring to anything but an identifier. A nested pattern, and a reception carrying a default, do not settle on one binding name
- A rest element. Which dependency it names is not written
- A factory whose first parameter is not an object pattern, and a factory taking no parameter
- A fixture handed a value rather than a factory. There is no body to read

### The invariant

A dependency between fixtures arises only through actually consuming a value.

A fixture is evaluated when it is referenced. Because of that property, the demand "I want that work to run first" can be written by declaring a dependency nobody uses. From the writer's side, declaring the dependency is specifying an order, and the value was never wanted.

It breaks in two layers.

The first is that the dependency graph disagrees with the actual data flow. A reader reads "this fixture uses the upstream value as input" while it does not. What breaks when the upstream fixture is deleted, when the order is swapped, or when the shape of what upstream returns changes, can no longer be judged from what is written.

The second is that the real demand is written nowhere. What was wanted is "that work runs first", and what is written is "receive the upstream value". The demand has turned into a dependency, so the work whose order needs guaranteeing cannot be recovered from what is written. And that demand can be written correctly by making one action fixture always run. The intermediate fixture that existed to create an order becomes unnecessary there.

Condition 2 stands apart from condition 1 because a gate reading only the naming signal can be left by two routes: drop the prefix and change the alias, and the signal is gone; or never use the signal and declare an unused dependency under a plain name. Both break the invariant.

The two are not left to unused-variable detection. Unused detection normally carries a setting excluding names starting with an underscore, and the shape condition 1 reads falls exactly into that exclusion. The shape of receiving a value and discarding it (a lone expression statement, `void`, an assignment to a discarded binding) does not trip unused detection at all, because the binding is used. Condition 2 depends on neither shared setting.

### Configuration

- `orderingAliasPrefixes` — the prefixes read as a binding name declaring "this value will not be used". The default is one: `_`. Handing over an empty array removes condition 1 and leaves condition 2 alone
- `specFileSuffixes` — the suffixes taken as spec files. The default is `.test.ts` and `.test.tsx`

There is no option turning condition 2 off. What is protected is "a dependency arises only through consuming a value", and the naming signal is only its most legible breach. Allow it to be turned off and the same invariant can be broken without using the signal.

## Fix

Gather the work whose order needs guaranteeing into one action fixture and mark it as always running. The assertion fixture consumes that fixture's output, and the intermediate fixture that existed only to create an order is deleted.

```ts
const test = baseTest
  .extend("store", { auto: true }, () => openStore())
  .extend("report", ({ store }) => summarise(store.entries));
```

`store` carries `{ auto: true }`, so it runs every time whether or not `report` references it. `report` receives `store` and actually reads its value, so the declared dependency and the actual data flow line up.

Where a value was received intending to use it and then not read, either read it or delete the dependency declaration. Leaving an unread dependency is reported however it is named.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a name marked as unused confesses a dependency declared for order alone
// in report.test.ts
const test = baseTest.extend("report", ({ port: _port }) => summarise(_port));
```

```ts
// a dependency taken apart under its own name and never read declares an order
// in report.test.ts
const test = baseTest.extend("report", ({ port }) => summarise());
```

Code this rule accepts.

```ts
// a dependency taken apart under its own name and read in the body is the flow it declares
// in report.test.ts
const test = baseTest.extend("report", ({ port }) => summarise(port));
```

```ts
// a renamed dependency read in the body is a dependency the fixture uses
// in report.test.ts
const test = baseTest.extend("report", ({ port: chosen }) => summarise(chosen));
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Dropping the prefix, changing only the alias, and leaving the dependency unused. Condition 2 reports it
- Never using the naming signal and declaring an unused dependency under a plain name. Condition 2 reports it
- Referencing the received value meaninglessly to look like it is used. A lone identifier expression statement, the operand of `void`, an expression statement discarding an awaited result on the spot, and an assignment to a binding that is itself discarded are none of them consumption
- Writing an order-only dependency with a computed key, a nested pattern, a reception with a default, or a rest element. Those are not reported because the dependency name or the binding name cannot be identified statically, but the invariant breaks the same way. Do not choose this shape when you want an order
- Declaring no dependency and calling the upstream fixture's implementation directly from the factory body. The order demand merely leaves the dependency declaration; it is still written nowhere
- Turning this rule off with a suppression directive. That it was turned off is not itself reported by this rule

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `orderingAlias` | A fixture must not take a dependency apart into a name marked as unused. \`{{dependency}}\` is bound as \`{{bound}}\`. Delete the dependency, move the work it was ordering into one action fixture declared with \`{ auto: true }\`, and take apart only the values a fixture hands back for the assertions. Dropping the prefix and leaving the dependency unread, and spelling the same unread dependency without a prefix from the start, are reported all the same. |
| `unconsumedDependency` | A fixture must not declare a dependency whose value it never consumes. \`{{dependency}}\` is bound as \`{{bound}}\`, and every reference to it drops the value. Delete the dependency, move the work it was ordering into one action fixture declared with \`{ auto: true }\`, and take apart only the values a fixture hands back for the assertions. Naming the binding on a line of its own, handing it to \`void\`, and assigning it to another binding that is dropped the same way all leave it unconsumed. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
