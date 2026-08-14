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

A write to an output sink inside a `catch` clause where that `catch` clause neither stops nor recovers.

The judgment is two independent questions.

**1. Is that call a write to an output sink?** Two families count as sinks.

- A member call whose receiver is `console`. The property name makes no difference (`console.error`, `console.warn`, `console.log` — all the same)
- `process.stdout.write(...)` and `process.stderr.write(...)`

Those two are the whole of where a failure can be written in this repository. No logger library is in it. Once one is introduced, adding its receiver to this list is the paired work.

**2. Does that `catch` clause stop, or recover?** It counts as stopping where any of these stands as **a statement directly in the `catch` clause's body**.

- A `throw` statement
- A `return` statement
- An expression statement of `process.exit(...)`

Before the write or after it makes no difference. What is read is not the order but whether every path through that `catch` clause eventually stops.

A `throw` inside a condition does not count as stopping. `if (isFatal(failure)) { throw failure; }` lets the path where the condition is false through as it is, and that path is exactly what this rule is about, so a conditional stop is not counted as a stop.

`break` and `continue` do not count as stopping either. Both only advance to the loop's next iteration or to the statement after it, and whatever was waiting on the failed operation's result keeps running.

### The boundary of the walk

The walk runs outward from the write call, and the first `catch` clause found is the one that write belongs to. Entering a function, a class or a static block ends the walk and takes it out of scope: a callback merely defined inside a `catch` clause does not necessarily run while that clause runs.

With nested `try`s, the inner `catch` clause holds the inner write. Even where the outer one throws, the inner one is judged on its own statements alone.

Writes inside a `try` block and inside a `finally` block are out of scope. Neither is a report of a caught failure.

### The boundary with the existing official rules

Of the shapes that swallow a failure, two are already closed by oxlint's official rules.

| Shape | What closes it |
| --- | --- |
| `catch { }` (an empty body) | `no-empty` |
| `catch (e) { throw e; }` alone | `no-useless-catch` |

What was left is the shape "write, then carry on". This rule reads that alone.

Discarding a value standing for a failure without receiving it (not binding the failure side when taking an `attempt` apart, say) is not syntactically even a `catch` clause and is out of this rule's scope. [no-discarded-failure--receive-and-surface-it](./no-discarded-failure--receive-and-surface-it.md) handles that.

There is no exemption by file kind. Test code is treated the same.

### The invariant

Whatever runs after a failed operation knows about that failure.

Reaching a `catch` clause means the operation inside the `try` did not run to the end. The value it was to prepare is absent, or only partly there. Leaving the `catch` clause for the next statement means continuing on top of that incomplete state.

A write changes none of that. What changes is the contents of a stream some other process might read. Neither the rest of the same function nor whoever called it can observe whether the write happened. From the caller's side, a failed run and a successful run come back with the same return value and the same exit code.

It breaks in two layers.

The first is that the failure does not reach the caller. The caller uses the returned value as a success value. An empty array is treated as "there were none", and a `null` as "it was unset". The fact that it could not be read cannot be recovered from the shape of the value.

The second is that the not-reaching is not found by any check. The tests pass, the type check passes, and CI goes green. The state this repository dislikes most — the lint is green and nothing was checked — is born here. A directory that could not be read is treated as an empty directory, and everything under it disappears from what is checked. The only notice of the disappearance is one line in a stream nobody reads.

The write is not the problem in itself. It is the write **living beside continuing** that builds those two layers. Settle on stopping or recovering and any amount of writing is fine.

### Configuration

None. Only whether the rule is on or off is settled by the configuration. The list of output sinks is held by the rule. It is not something that varies per deployment target, and where it changes, the rule itself is repaired.

## Fix

Settle what that `catch` clause is for. There are only two answers.

**Stop.** Rethrow the failure as it is, or throw a failure named after this layer's involvement. The judgment passes to the caller.

```ts
try {
  return readCatalog(path);
} catch (failure) {
  throw new Error(`reading the catalog at ${path} failed`, { cause: failure });
}
```

Handing over `cause` keeps the original failure. Whatever the write was trying to preserve goes in here.

**Recover.** Return the value the caller should use on failure. Make the returned value one that shows a failure happened.

```ts
const readCatalog = (path: string): Catalog | UnreadableCatalog => {
  try {
    return parseCatalog(readFileSync(path, "utf8"));
  } catch (failure) {
    return { unreadable: path, cause: failure };
  }
};
```

Do not collapse "there is nothing" and "there is something and it cannot be read" into one value. Collapse them and the caller moves on unable to tell the two apart.

Where you do not want to change the return type, that is a situation calling for the stopping side.

**Where the write is the program's own output rather than a report of a failure, take it out of the `catch` clause.** A CLI's result line sitting inside a `catch` clause is a placement error.

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

- Putting the `throw` inside a condition and calling it stopped. The path where the condition is false carries on as before, and this rule does not count a conditional stop as a stop
- Replacing it with `break` or `continue`. Only the loop's control changes; nothing reaches whatever was waiting on the failed operation's result
- Moving the write into a function defined inside the `catch` clause. The walk stops at the function boundary so the report clears, and where that function runs becomes unreadable too — the situation is worse
- Taking the receiver into a variable and calling that (placing `const write = console.error;` outside the `catch`). The judgment reads the spelling of the member call, so the report clears. The write living beside continuing is unchanged
- Spelling the receiver in subscript notation (`console["error"](failure)`). As above
- Swapping the sink for a logger wrapper. All that changed is that this rule knows one fewer receiver; writing the failure and carrying on is unchanged. Where a logger is introduced, adding its receiver to this rule is the paired work
- Adding `return undefined;` to call it stopped while the caller never reads the return. It returns by grammar, but the caller receives no value it can tell a failure from. Choosing the recovering side means returning a value that shows a failure happened
- A suppression directive

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
