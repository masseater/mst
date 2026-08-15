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

A dependency a fixture factory takes apart in the object pattern of its first parameter, on either of two independent conditions. One report per property.

- The binding name differs from the key and starts with one of `orderingAliasPrefixes`, which defaults to `_`. Whether the body reads the value is not part of this
- The factory's body never consumes the value. A reference is not consumption when it stands alone as an expression statement, sits behind `void`, or is assigned to a binding that is itself dropped the same way; `await` in between changes nothing, and a name declared outside this file counts as consumed

A property meeting both gets one report, on the naming side. A computed key, a nested pattern, a reception carrying a default and a rest element cannot be identified statically and are not read.

## Fix

Gather the work whose order needs guaranteeing into one action fixture marked `{ auto: true }`, and let the assertion fixture consume that fixture's output.

Where the value was received meaning to use it, either read it or delete the dependency.

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

- Dropping the prefix and leaving the dependency unread. The second condition reports it
- Referencing the value meaninglessly to look like it is used. A lone statement, a `void` operand and an assignment to a dropped binding are none of them consumption
- Writing the order-only dependency with a computed key, a nested pattern or a rest element to leave the reading

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
