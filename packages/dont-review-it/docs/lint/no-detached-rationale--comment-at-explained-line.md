---
description: "Require a JSDoc block to carry tag content only, so an explanation never drifts above a signature instead of sitting on the code it explains"
---

# no-detached-rationale--comment-at-explained-line

<!-- BEGIN GENERATED rule-header -->

Require a JSDoc block to carry tag content only, so an explanation never drifts above a signature instead of sitting on the code it explains

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `core`
- Source: [`no-detached-rationale--comment-at-explained-line.ts`](../../src/lint/oxlint/rules/core/no-detached-rationale--comment-at-explained-line.ts)

<!-- END GENERATED rule-header -->

## Violation

A JSDoc block carrying a non-empty line before its first `@tag`. Each line is read with its leading `*` and whitespace dropped; whatever stands before the first tag is description prose, and one line of it is enough. A block with no tag at all is prose from end to end.

A wrapped continuation line under a tag opens with no `@` and is not reported: everything after the first tag belongs to that tag. Comments that are not JSDoc belong to [no-explanatory-comment--delete-or-move-to-commit-message](./no-explanatory-comment--delete-or-move-to-commit-message.md).

## Fix

Move prose that explains a published contract under the tag that owns it — `@param`, `@returns`, `@throws`, `@example`, `@see`, `@remarks` — so the syntax fixes what it is about.

Prose that explains a decision in the implementation goes in the commit message. Delete whatever is left.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// description prose above the first tag is reported
/**
 * Takes the rows the caller asked for.
 * @param count how many rows to take
 */
export const take = (count: number) => count;
```

```ts
// a single line JSDoc block carrying prose is reported
/** Takes the rows the caller asked for. */
export const take = 1;
```

Code this rule accepts.

```ts
// a JSDoc block that carries tag content only passes
/**
 * @param count how many rows to take
 * @returns the taken rows
 */
export const take = (count: number) => count;
```

```ts
// prose wrapped under a tag belongs to that tag
/**
 * @remarks
 *   the caller owns the cursor, so the rows are taken eagerly
 */
export const take = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Prefixing the prose with `@` to give it the shape of a tag. A spelling that means nothing as a tag fixes no subject
- Moving the prose out of the block into a line comment. `no-explanatory-comment--delete-or-move-to-commit-message` reports it there
- Moving the prose after the first tag into a position that belongs to no tag

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `jsdocDescriptionProse` | Free description prose must not sit above a signature. Move contract prose under the JSDoc tag that owns it (\`@param\`, \`@returns\`, \`@throws\`, \`@example\`, \`@see\`, \`@remarks\`), and delete the rest. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
