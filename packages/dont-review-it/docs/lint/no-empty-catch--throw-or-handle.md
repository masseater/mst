---
description: "Disallow a catch clause whose body carries no statement, so catching a failure is a decision about what happens next instead of a place for the failure to stop being visible"
---

# no-empty-catch--throw-or-handle

<!-- BEGIN GENERATED rule-header -->

Disallow a catch clause whose body carries no statement, so catching a failure is a decision about what happens next instead of a place for the failure to stop being visible

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-empty-catch--throw-or-handle.ts`](../../src/lint/oxlint/rules/no-empty-catch--throw-or-handle.ts)

<!-- END GENERATED rule-header -->

## Violation

A `catch` clause whose body carries no statement, whether or not it binds the failure. An empty body, a body holding only empty statements, and a body holding only a block that meets the same condition all count; a comment is not a statement.

One statement that does work is enough, and what that statement does is not read here — whether it carries the failure anywhere belongs to [no-silent-catch--rethrow-or-handle](./no-silent-catch--rethrow-or-handle.md). The `try` and `finally` blocks are not read, and nested clauses are judged one at a time against their own statements.

## Fix

Write into the body what the caller receives when control enters the clause. Either stop — rethrow, or throw one naming this layer's part with the original as `cause` — or return a value that shows the operation did not complete.

Where nothing can be settled here, remove the `try` as well and let the failure reach a caller that can settle it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a catch clause with an empty body is reported
try {
  run();
} catch (failure) {
}
```

```ts
// a body holding only a comment carries no statement
try {
  run();
} catch (failure) {
  // the catalog is optional here
}
```

Code this rule accepts.

```ts
// a catch clause that rethrows carries a statement
try {
  run();
} catch (failure) {
  throw failure;
}
```

```ts
// a catch clause that returns a substitute carries a statement
const read = () => {
  try {
    return run();
  } catch (failure) {
    return null;
  }
};
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Filling the body with a comment, an empty statement or an empty block. None of them is a statement that does work
- Placing one statement that means nothing, such as `void failure;`. `no-silent-catch--rethrow-or-handle` receives it
- Writing a bare `return;`. The caller cannot tell that from a successful run

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `emptyCatch` | A catch clause must not stand with a body that carries no statement. Write the ending the caller can act on into this body: rethrow the failure, throw one that names this layer's part in it with the original passed as \`cause\`, or return the value the caller should use in place of the one that never arrived. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
