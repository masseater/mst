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
- Shipped in the preset: yes
- Source: [`no-detached-rationale--comment-at-explained-line.ts`](../../src/lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts)

<!-- END GENERATED rule-header -->

## Violation

A JSDoc block (a block comment opening with `/**`) that carries a non-empty line before its first `@tag`.

The judgment runs line by line. The leading `*` and whitespace are dropped from each line, and the first line starting with `@` is found. Whatever non-empty lines remain before it are description prose, and one is enough to be reported. A JSDoc block with no `@tag` at all is description prose from end to end.

A wrapped continuation line under a tag does not start with `@` either, and is not reported: it stands after the first tag, and everything after the first tag is read as content that tag owns.

The report covers the range from the first line of description prose to the end of the block.

Comments that are not JSDoc are out of reach. [no-explanatory-comment--delete-or-move-to-commit-message](./no-explanatory-comment--delete-or-move-to-commit-message.md) carries those.

Description prose placed above a signature carries no statement of which line it explains. A function body may hold three separate decisions while a single paragraph stands in front of the whole block, and which decision it answers to is left for the reader to guess. The body changes and the prose does not move, so the correspondence decays on its own.

Tag content does not have that problem. `@param count` explains `count` because the syntax says so, and once `count` is gone the entry stands out as describing nothing. Having the subject fixed by the syntax is the whole difference between prose and a tag.

No option is offered. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

## Fix

If the prose explains a contract that is published, move it under the tag that owns it. An explanation of a contract that fits none of `@param`, `@returns`, `@throws`, `@example`, `@see` or `@remarks` is usually not an explanation of a contract at all.

If the prose explains a decision made in the implementation, do not keep it as a comment. Write it in the body of the commit message. Delete whatever is left.

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

- Prefixing the description prose with `@` to give it the shape of a tag. A spelling that means nothing as a tag still leaves the subject unfixed by the syntax
- Moving the prose out of the JSDoc block into a line comment. `no-explanatory-comment--delete-or-move-to-commit-message` carries that, so it is reported where it lands
- Moving the prose after the first tag, into a position that belongs to no tag. Detection falls away while the writing still names no subject

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
