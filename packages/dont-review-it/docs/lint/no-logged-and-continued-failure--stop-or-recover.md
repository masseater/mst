---
description: "Disallow writing a caught failure to an output stream inside a catch clause that neither stops nor returns, so a failure that was caught either ends the work or produces a value the caller can use"
---

# no-logged-and-continued-failure--stop-or-recover

<!-- BEGIN GENERATED rule-header -->

Disallow writing a caught failure to an output stream inside a catch clause that neither stops nor returns, so a failure that was caught either ends the work or produces a value the caller can use

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-logged-and-continued-failure--stop-or-recover.ts`](../../src/lint/oxlint/rules/no-logged-and-continued-failure--stop-or-recover.ts)

<!-- END GENERATED rule-header -->

## Violation

A write to an output sink inside a `catch` clause that neither stops nor recovers. A sink is a member call on `console`, whatever the property, and `process.stdout.write(...)` or `process.stderr.write(...)`.

The clause counts as stopping when a `throw`, a `return` or a `process.exit(...)` statement stands directly in its body; order does not matter. A stop inside a condition is not one, because the other path carries on, and `break` and `continue` only move the loop along.

The walk runs outward from the write and stops at the first `catch` clause, or at a function, class or static block boundary. Writes in a `try` or a `finally` block are not reports of a caught failure. There is no exemption by file kind.

## Fix

Settle what the clause is for. Either stop — rethrow, or throw one naming this layer's part with the original as `cause` — or return the value the caller should use, shaped so the caller can tell the operation did not complete.

Where the write is the program's own output rather than a report of a failure, take it out of the clause.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a catch clause that writes the failure and carries on is reported
try {
  run();
} catch (failure) {
  console.error(failure);
}
```

```ts
// a stop that only happens inside a condition leaves the other paths carrying on
try {
  run();
} catch (failure) {
  console.error(failure);
  if (isFatal(failure)) {
    throw failure;
  }
}
```

Code this rule accepts.

```ts
// a catch clause that writes to a stream and then recovers is complete
const read = () => {
  try {
    return run();
  } catch (failure) {
    process.stderr.write(String(failure));
    return fallback();
  }
};
```

```ts
// writing in the finally block is not a report of a caught failure
try {
  run();
} catch (failure) {
  throw failure;
} finally {
  console.log('done');
}
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Putting the `throw` inside a condition, or replacing it with `break` or `continue`. The path that carries on is unchanged
- Moving the write into a function defined inside the clause. The walk stops at the boundary and where that function runs becomes unreadable too
- Taking the receiver into a variable, or spelling it as a subscript. The write living beside continuing is unchanged
- Adding `return undefined;` and calling it recovered

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `loggedAndContinuedFailure` | A catch clause must not write the failure to an output stream and then let the surrounding code carry on. Choose one of the two endings the caller can act on. Stop: rethrow the failure, or throw one that names this layer's part in it. Recover: return the value the caller should use in place of the missing one, at the same statement level as this write. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
