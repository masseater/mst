---
description: "Disallow a declaration statement that introduces more than one binding, so every binding has a statement of its own to be read, moved and deleted at"
---

# no-multi-binding-declaration--declare-one-binding-per-statement

<!-- BEGIN GENERATED rule-header -->

Disallow a declaration statement that introduces more than one binding, so every binding has a statement of its own to be read, moved and deleted at

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-multi-binding-declaration--declare-one-binding-per-statement.ts`](../../src/lint/oxlint/rules/no-multi-binding-declaration--declare-one-binding-per-statement.ts)

<!-- END GENERATED rule-header -->

## Violation

A declaration statement carrying two or more declarators. `const`, `let` and `var` are reported alike, and whether the declarators carry initialisers is not read.

One report is raised per declaration statement rather than per declarator, because the statement is the unit that gets fixed.

Two shapes are not detected:

- A statement carrying one declarator. However many bindings the name introduces through a destructuring pattern, there is one place where bindings come into being, so it is not a target
- A declaration in the header of a `for` statement. Two statements cannot stand in the position of `for (let index = 0, limit = 10; ...)`. Telling somebody to split them leaves no shape to comply with, so the mechanism excludes it. `for-of` and `for-in` headers take only one declarator to begin with, so the exclusion does not reach them

The body of a `for` statement is not part of that exclusion. The constraint on the header does not extend to the body.

### The invariant

One binding can be read, moved and deleted as one statement.

The first layer is that the unit of editing stops matching. Declarations joined by commas carry no boundary per binding. Moving one elsewhere means dragging the rest along or rebuilding the commas and the indentation by hand. Deleting one comes with repairing whatever comma or semicolon is left. Adding one is the same: it cannot be added without editing an existing line.

The second layer is that the mismatched unit of editing shows up in the history. A change touching one binding is left in the diff as a change touching the whole statement. Whoever reads the place next cannot settle from the diff which binding changed and has to read around it. Reverting has the same problem: it cannot be done per binding.

The cost, then, is not the characters saved when it was written; it recurs every time anybody touches that statement afterwards. Splitting statements is not about making things look uniform — it is what returns the unit of editing to the unit of binding.

### Configuration

None. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

No exception is expressible as a setting, because the value of this invariant lies in every declaration statement having the same shape. Loosening it in configuration would make a reader check the loosened places one at a time, which breaks the premise that the statement is the unit of editing.

## Fix

Repeat the declaration keyword and write one statement per binding.

```ts
const parsedCount = 1,
  renderedLabel = "a";
```

```ts
const parsedCount = 1;
const renderedLabel = "a";
```

Where the point was to express that things belong together, express that as one value rather than as declarations standing side by side.

```ts
const summary = { parsedCount: 1, renderedLabel: "a" };
```

No automatic fix is offered. What order the split statements go in can follow from dependencies between the initialisers, and that does not settle mechanically.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// two bindings in one const statement are reported
const parsedCount = 1, renderedLabel = 'a';
```

```ts
// a for statement body is not the header, so the exemption does not reach it
for (const entry of entries) {
  const parsedCount = 1, renderedLabel = 'a';
}
```

Code this rule accepts.

```ts
// one binding per statement is the shape the rule asks for
const parsedCount = 1;
const renderedLabel = 'a';
```

```ts
// a for statement header has nowhere to put a second statement
for (let index = 0, limit = 10; index < limit; index += 1) {
  report(index);
}
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Wrapping them in a destructuring pattern to look like one declarator. `const { a, b } = { a: 1, b: 2 };` has not reduced the number of bindings. A pattern stands only where the right-hand side is a value that already exists
- Moving unrelated bindings into a `for` header. The exclusion answers the constraint that no statement can stand in a header; it does not make the header a place to put things
- Disabling the lint at the site

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `multiBindingDeclaration` | A declaration statement must not introduce more than one binding, and this one introduces {{count}}. Give each binding its own statement, repeating the declaration keyword. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
