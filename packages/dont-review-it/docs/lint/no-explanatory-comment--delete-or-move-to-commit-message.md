---
description: "Disallow comments that explain the code, so reasoning lives in the commit message instead of drifting beside an implementation that moves on without it"
---

# no-explanatory-comment--delete-or-move-to-commit-message

<!-- BEGIN GENERATED rule-header -->

Disallow comments that explain the code, so reasoning lives in the commit message instead of drifting beside an implementation that moves on without it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-explanatory-comment--delete-or-move-to-commit-message.ts`](../../src/lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts)

<!-- END GENERATED rule-header -->

## Violation

Anything written in comment syntax that is not a declaration a machine reads. Line comments and block comments alike.

Four kinds pass as declarations a machine reads:

- A lint suppression directive (a leading token in the `eslint-disable` or `oxlint-disable` family)
- A compiler directive (a leading token starting with `@ts-`)
- A mock factory exemption (a leading token of `mock-factory-exemption`, which [no-vi-mock-factory-behavior--use-spy-true-and-fixture](./no-vi-mock-factory-behavior--use-spy-true-and-fixture.md) reads)
- A JSDoc block (a block opening with `/**`)

A shebang is not written to explain code and is out of reach.

Whether the contents of a JSDoc block are description prose is not judged here. [no-detached-rationale--comment-at-explained-line](./no-detached-rationale--comment-at-explained-line.md) carries that, so the two do not report the same thing twice.

### The invariant

A comment that explains code turns into a lie the moment the code changes, and nothing detects that it has. The tests still pass, the type checker still passes, and a review sees no more than that a comment is there. The reader is left deciding, every time, whether to believe the comment or the code.

The place an explanation belongs is the body of the commit message. Written there, it is pinned in the history as the intent held at the moment the change was made, and it stays readable after the code moves on. Written beside the code, it moves with the code.

No option is offered. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is.

## Fix

Delete the comment and write what it was going to say in the body of the commit message for that change.

If the comment is there because a name does not carry the intent, change the name. If it is there because a block of work needs explaining, lift that block into a named function. Both say more than a comment does, and both follow the code when the code changes.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a line comment explaining the next statement is reported
// add the two operands
const total = 1 + 2;
```

```ts
// a commented out statement is reported
// const previous = 1;
const total = 2;
```

Code this rule accepts.

```ts
// a lint suppression directive is a declaration a machine reads
// oxlint-disable-next-line no-console -- the CLI writes its result here
console.log(1);
```

```ts
// a JSDoc block is judged by no-detached-rationale instead
/**
 * @returns the total
 */
export const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Prefixing a comment with the spelling of a directive a machine reads to get it through. A spelling that does not stand as a directive only disguises the suppression channel, and the description prose is still there
- Moving the prose into a JSDoc block to leave this rule's reach. `no-detached-rationale--comment-at-explained-line` carries JSDoc, so it is reported where it lands
- Writing the explanation as a string literal or an expression nothing reaches. It has stopped being a comment and nothing else: it turns into a lie when the code changes exactly as before

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `explanatoryComment` | A comment that explains the code must not stay in the source. Delete it and put the reasoning in the body of the commit that makes the change. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
