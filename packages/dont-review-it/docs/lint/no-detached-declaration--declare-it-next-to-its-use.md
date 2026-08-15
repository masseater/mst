---
description: "Disallow a declaration that stands apart from the statement that uses it, so a reader reaches the shape of a name without leaving the line that names it"
---

# no-detached-declaration--declare-it-next-to-its-use

<!-- BEGIN GENERATED rule-header -->

Disallow a declaration that stands apart from the statement that uses it, so a reader reaches the shape of a name without leaving the line that names it

- Tool: `oxlint`
- Fixable: yes
- Suggestions: no
- Options: no
- Bundle: `writing`
- Source: [`no-detached-declaration--declare-it-next-to-its-use.ts`](../../src/lint/oxlint/rules/writing/no-detached-declaration--declare-it-next-to-its-use.ts)

<!-- END GENERATED rule-header -->

## Violation

A declaration standing apart from the statement that first uses it, judged inside each statement list: the module body and every block body. Imports are not read, and a statement that carries an effect holds its position, so nothing is moved across it.

Value declarations are reportable when they name something and their initializer carries no startup work. Type declarations are reportable too, except at module level, where a type that is not exported and is referenced fewer than twice is left where it stands.

An automatic fix moves the declaration, together with the comments above it, directly in front of its first use, where that use stands later in the same list.

## Fix

Move the declaration directly in front of the statement that uses it. Where a value has several uses, put it in front of the first.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a value separated from its use by a declaration that use does not name is reported
const limit = 200;
export const read = () => 1;
export const truncate = (lines: readonly string[]) => lines.slice(0, limit);
```

```ts
// a declaration standing after the declaration that uses it is reported without a fix
export const walk = () => step();
export const read = () => 1;
const step = () => 2;
```

Code this rule accepts.

```ts
// a declaration standing right in front of the declaration that uses it passes
const limit = 200;
export const truncate = (lines: readonly string[]) => lines.slice(0, limit);
```

```ts
// a value read before a write that clears what it read keeps its position
export const wake = (queue: { waiters: readonly (() => void)[] }) => {
  const woken = queue.waiters;
  queue.waiters = [];
  return woken;
};
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Gathering constants at the top of a function because they read as configuration. The reader still leaves the line that names them
- Adding a second reference to a local type so it looks shared. The exemption is for types two places genuinely agree on

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `detachedDeclaration` | A declaration must not stand apart from the statement that uses it. Move \`{{name}}\` directly in front of the statement on line {{line}}. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
