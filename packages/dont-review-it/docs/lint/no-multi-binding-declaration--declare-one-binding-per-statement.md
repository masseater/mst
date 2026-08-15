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
- Bundle: `core`
- Source: [`no-multi-binding-declaration--declare-one-binding-per-statement.ts`](../../src/lint/oxlint/rules/core/no-multi-binding-declaration--declare-one-binding-per-statement.ts)

<!-- END GENERATED rule-header -->

## Violation

A declaration statement carrying two or more declarators. The initializer of a `for` statement is left alone, because the grammar gives it no other place to put them.

## Fix

Give each declarator its own statement, repeating the declaration keyword.

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

- Chaining the declarators onto one line with commas rather than splitting the statement

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
