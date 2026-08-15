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
- Bundle: `core`
- Source: [`no-explanatory-comment--delete-or-move-to-commit-message.ts`](../../src/lint/oxlint/rules/core/no-explanatory-comment--delete-or-move-to-commit-message.ts)

<!-- END GENERATED rule-header -->

## Violation

Anything written in comment syntax that is not a declaration a machine reads. Four kinds pass: a lint directive of the `eslint-` or `oxlint-` families, a compiler directive opening with `@ts-`, the `mock-factory-exemption` registration one rule reads, and a JSDoc block. A shebang is not read.

Whether a JSDoc block carries description prose belongs to [no-detached-rationale--comment-at-explained-line](./no-detached-rationale--comment-at-explained-line.md), so the two never report the same comment.

## Fix

Delete the comment and write what it was going to say in the body of the commit that makes the change.

Where the comment stood in for a name, change the name. Where it explained a block of work, lift that block into a named function.

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

- Prefixing prose with the spelling of a directive. The first token is read, and a spelling that stands as no directive only disguises the comment
- Moving the prose into a JSDoc block. `no-detached-rationale--comment-at-explained-line` reports it there
- Writing the explanation as a string literal nothing reads

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
