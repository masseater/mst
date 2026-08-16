---
description: "Disallow a catch clause whose body never carries the failure it bound out of the clause, so a failure that was caught reaches something able to act on it instead of ending where it was caught"
---

# no-silent-catch--rethrow-or-handle

<!-- BEGIN GENERATED rule-header -->

Disallow a catch clause whose body never carries the failure it bound out of the clause, so a failure that was caught reaches something able to act on it instead of ending where it was caught

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `mutation-and-failure`
- Source: [`no-silent-catch--rethrow-or-handle.ts`](../../src/lint/oxlint/rules/mutation-and-failure/no-silent-catch--rethrow-or-handle.ts)

<!-- END GENERATED rule-header -->

## Violation

A `catch` clause that binds a failure, does work in its body, and never carries that failure out of the clause. Every read of the bound name is walked outward: a read that reaches the clause boundary carries the failure, while one standing in the condition of an `if`, a loop, a conditional expression or a `switch` only steers control and does not.

A clause whose body carries no work at all belongs to [no-empty-catch--throw-or-handle](./no-empty-catch--throw-or-handle.md), so the two never report the same clause.

## Fix

Choose an ending that takes the failure with it: rethrow it, throw one that names this layer's part with the original as `cause`, hand it to the call that acts on it, or return a value that holds it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a catch clause that never names the failure again is reported
try {
  run();
} catch (failure) {
  retry();
}
```

```ts
// a failure read only in the condition of an if is not carried anywhere
try {
  run();
} catch (failure) {
  if (isTransient(failure)) {
    retry();
  }
}
```

Code this rule accepts.

```ts
// a catch clause that rethrows hands the failure to the caller
try {
  run();
} catch (failure) {
  release();
  throw failure;
}
```

```ts
// a failure read in a condition and rethrown afterwards is still carried
try {
  run();
} catch (failure) {
  if (isTransient(failure)) {
    retry();
  }
  throw failure;
}
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Reading the failure only to branch on it. A condition steers control and carries nothing out
- Writing the failure to an output and carrying on. `no-logged-and-continued-failure--stop-or-recover` reports that

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `silentCatch` | A catch clause must not end without carrying the failure it bound out of the clause. Choose an ending that takes the failure with it: rethrow it, throw a failure that names this layer's part in it with the original passed as \`cause\`, hand it to the call that acts on it, or return a value that holds it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
