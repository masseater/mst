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
- Shipped in the preset: yes
- Source: [`no-detached-declaration--declare-it-next-to-its-use.ts`](../../src/lint/oxlint/rules/no-detached-declaration--declare-it-next-to-its-use.ts)

<!-- END GENERATED rule-header -->

## Violation

In production TypeScript sources, a state where a statement unrelated to that use stands between a declaration and the first statement using it.

What is read as a run of statements is the top level of a file and the body of a function or a block. A declaration moves only inside that run. Where every use is closed inside one function, moving the declaration into that function is not asked for.

Read as declarations: variables, functions, classes, enums, type aliases and interfaces, whether or not they are exported.

### What counts as unrelated

A statement T standing between a declaration D and the first statement S that uses D counts as unrelated when T does not connect to S. The connection counts indirectly too: where U uses what T declared and S uses what U declared, T connects to S.

Two declarations the same statement uses standing together passes. Both cannot be directly in front of S, so one is bound to sit outside the other.

Distance is not measured in lines or in number of statements. That is to avoid settling how many lines counts as near; what is read is only whether what stands between relates to S.

### A declaration standing after its use

A declaration standing after the statement that uses it is detected too, even where they are neighbours in the run.

Let that state pass and the shortest way to clear a report becomes "move the declaration after its use". A rule about position would be voided by changing position.

### Declarations naming each other

Declarations naming one another are not detected — two of them, or a ring of three or more. Whichever goes first ends up after the other, so no single place is settled.

The state machine in `packages/ai-native/src/spool/strip-escapes.ts` has that shape: `ground` names `escapeLead`, and following `escapeLead` comes back to `ground`.

### When something runs between here and there

Where one statement that runs something stands between the declaration and where it would move to, nothing is detected. A call, an `await`, an assignment and an increment all count.

Moving the position can change the value that declaration reads. Move `const woken = this.#waiters;` after `this.#waiters = [];` and what it reads is the emptied array. What rewrites the read target is sometimes a call, so calls are treated the same way as assignments.

Such a declaration is no longer "a name put on something"; it is one step of a procedure. The position of a step is settled by the order of execution rather than by readability.

Where the declaration itself runs something, it is not detected for the same reason. Move `const startedAt = performance.now();` directly in front of its use and the interval being measured changes.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| An import statement | Their order belongs to [no-unordered-import--group-by-origin-then-sort-by-specifier](./no-unordered-import--group-by-origin-then-sort-by-specifier.md) |
| A declaration never used inside that file | That it goes unused is watched by knip and by [no-single-use-local-type--inline-at-the-use-site](./no-single-use-local-type--inline-at-the-use-site.md) |
| A type that is not exported and carries fewer than two type references in the file | [no-single-use-local-type--inline-at-the-use-site](./no-single-use-local-type--inline-at-the-use-site.md) tells that declaration to go. Let both land on one declaration and "delete it" and "move it" come out together, handing the choice back to the reader |
| Declarations naming each other | As above, no place is settled |
| A declaration that runs something, and a move across a statement that runs something | As above, moving changes the value read and the order things run in |
| Moving a declaration inside a scope | Even where every use is closed inside one function, the declaration may stay outside it |

The last one is not a hole in the detection but the current reach. Put inside a function, a declaration such as `new Set(...)` is rebuilt on every call, and a regular expression carrying `g` changes even what `test` returns. What may move inward is settled separately.

### The invariant

Whoever reads a name travels to its declaration to learn what that name is, reads it there, and comes back. The more unrelated things stand between, the longer that round trip.

Put the declaration next to its use and the round trip disappears: the answer is one line above the line being read.

Gathering declarations at the top is easy for the writer. Nothing has to be decided about where things go, and the run never has to be rearranged while writing. The reader pays for that ease in round trips.

No threshold was given because there is no answer to how many lines counts as near. There are no grounds for a line where three is fine and four is not. Whether what stands between relates is settled by the presence of a reference, so that line can be drawn.

### Configuration

None. There is no per-rule exclusion, no per-file exclusion and no per-declaration exemption tag.

## Fix

Move the declaration directly in front of the first statement that uses it. The unrelated statements that stood between stay in front of that declaration.

A declaration standing after its use moves in front of that statement.

Where one statement uses several declarations, line them up together in front of it. The order among them does not matter.

There is an automatic fix, and what it moves is only a declaration standing before its use. A declaration standing after its use is not moved: taking it upward can put it in front of what it itself names. Only the report comes out, and a person moves it.

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

- Moving the declaration after its use to clear the report. That state is detected too
- Putting `export` on a type to take it out of range. An exported type is detected as well
- Adding a throwaway reference to an unrelated statement so it looks related. The references grow while the reader's round trip has not shortened
- Moving the declaration into another file and importing it. The round trip merely crosses a file boundary

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
