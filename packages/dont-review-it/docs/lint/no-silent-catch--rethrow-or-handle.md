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
- Shipped in the preset: yes
- Source: [`no-silent-catch--rethrow-or-handle.ts`](../../src/lint/oxlint/rules/no-silent-catch--rethrow-or-handle.ts)

<!-- END GENERATED rule-header -->

## Violation

A `catch` clause carrying a binding and a body that does work, where the caught failure never leaves the clause.

"Does work" is settled by the same predicate [no-empty-catch--throw-or-handle](./no-empty-catch--throw-or-handle.md) uses. The two share one predicate, so there is no drift where one treats a body as empty and the other reads it as carrying statements. A body of an empty statement alone (`catch (failure) { ; }`) and a body of nothing but an empty block (`catch (failure) { {} }`) carry statements in the syntax tree but do no work, so they never enter this rule's way in.

### What counts as "recorded"

Each read reference to the binding is taken, and the route walked outward from it to the `catch` clause is read. Where that route reaches the `catch` clause without passing through a condition position, that reference is carrying the failure somewhere. One carrying reference is enough for the clause to have recorded the failure.

Shapes counted as carrying — different spellings, all settled by the same one question:

- Rethrowing (`throw failure`)
- Throwing a failure named after this layer with the original inside (`throw new Error("reading the catalog failed", { cause: failure })`)
- Handing it to a call (`report(failure)`, `console.error(failure)`)
- Putting it in the returned value (`return { unreadable: path, cause: failure }`)
- Putting it in a declared value (`const unreadable = { at: "catalog", cause: failure };`)
- Handing it to a function made inside the clause (`register(() => report(failure))`)

Shapes not counted as carrying:

- A read in a condition position alone: the condition of an `if`, a `while`, a `do while` or a `for`, the condition of a ternary, and a `switch`'s subject. A condition looks at the failure to choose a route and leaves the failure inside the clause
- A write-only reference (`failure = null`). The failure the binding pointed at disappears there

Bindings are resolved by scope. Making another binding of the same spelling inside the clause does not count its references as references to the caught failure.

### The boundary of the walk

The route walked outward from a reference ends at the first `catch` clause found. A reference inside a function made in the clause is walked across the function boundary: when the failure runs is unknown, but at the moment it is handed over the failure has reached something outside the clause.

With nested `try`s, the inner `catch` clause holds the inner binding. Even where the outer one rethrows, the inner one is judged on its own references alone.

A rethrow placed inside a condition (`if (isFatal(failure)) throw failure;`) passes, because that `throw`'s reference is counted. That nothing is left on the path where the condition is false is not read by this rule.

### The boundary with the other rules

Shapes swallowing a failure divide across five, each reading something different.

| Shape | What reads it |
| --- | --- |
| `catch (failure) { }` (an empty body) | `no-empty-catch--throw-or-handle` and `no-empty` |
| `catch { ... }` (no binding) | [no-discarded-failure--receive-and-surface-it](./no-discarded-failure--receive-and-surface-it.md) |
| `catch (failure) { throw failure; }` alone | `no-useless-catch` |
| Writing the failure to an output sink and carrying on | [no-logged-and-continued-failure--stop-or-recover](./no-logged-and-continued-failure--stop-or-recover.md) |
| A binding and a body, with the failure never leaving the clause | This rule |

A `catch` whose body does no work is out of scope here. `no-empty-catch--throw-or-handle` reads that and holds the instruction for what to write. The boundary keeps two rules from asking for the same repair on one `catch`.

The boundary is cut by the one predicate the two share. Cut it by counting statements and a body that carries statements in the syntax tree but does no work, such as `catch (failure) { ; }`, enters both ways in, and two rules ask one clause for different repairs.

A `catch` with no binding is out of scope too. Where there is no name to carry, telling somebody to "carry it" does not settle on one fix. Telling them to add a binding is `no-discarded-failure--receive-and-surface-it`'s report, and where the failure does not leave after the binding is added, this rule reports it.

Two combinations produce two reports on one clause. Each reads something different, and fixing one leaves the other.

- A binding spelled with underscores alone (`catch (_) { retry(); }`). `no-discarded-failure--receive-and-surface-it` reads the binding's spelling and reports "no intent to read"; this rule reads where the failure goes
- Writing a string that does not carry the failure and carrying on (`catch (failure) { console.error("failed"); }`). `no-logged-and-continued-failure--stop-or-recover` reads writing living beside continuing and says "stop or recover"; this rule reads that the failure did not leave and says "carry it"

There is no exemption by file kind. Test code is treated the same.

### The invariant

A trace of a caught failure remains outside the `catch` clause that caught it.

A `catch` clause is where the failure's destination is settled, not where the failure is erased. There are only two destinations: return it to the caller, or hand it to something that acts on receiving it. A clause choosing neither ends holding the failure, and the failure disappears with the binding.

It breaks in two layers.

The first is that a failed run and a successful run look the same from outside. The operation inside the `try` did not run to the end, yet what follows the `catch` clause takes the same route as on success. The value the caller receives and the process's exit code are what they would have been without the failure. Not one piece of material for telling them apart reached the caller.

The second is that the absence of material does not appear in any check. The tests pass as written, the type check passes, and CI goes green. What this repository dislikes most — the lint is green and nothing was checked — arises here from a lack of material rather than a lack of values. A state where nobody holds what failed cannot be reconstructed later.

A non-empty body is what makes this state hard to see. An empty `catch` reads as suspicious; the moment one statement goes in, it reads as "something is being done". A clause holding only `retry();` states only that one retry was attempted, and nothing remains about what happened when that retry failed too. A clause branching on a condition is the same: `if (isTransient(failure))` does look at the failure, and the result of looking is used by that branch and disappears.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

The judgment this rule holds is only "did the failure leave the clause", and the answer follows from the position of the reference. It carries no threshold, no per-target vocabulary and no exception list. Opening a setting that counts a condition position as recording would mean a route for erasing failures could be built in the configuration, so it is not opened.

## Fix

Settle one destination for the failure caught in that clause. Only shapes where the failure leaves the clause count as "recorded".

**Return it to the caller.** Rethrow it as it stands, or throw a failure named after this layer's involvement with the original inside.

```ts
try {
  return await lstat(absolutePath);
} catch (failure) {
  throw new Error(`reading ${absolutePath} failed`, { cause: failure });
}
```

Put it in `cause` and the original failure is not lost. Hand over the failure itself rather than flattening it into a string.

**Hand it to something that acts on receiving it.** Limited to something that can make the next judgment holding the failure.

**Make only absence a value and return the rest.** Where you branch on a condition, settle a destination on each side of the branch.

```ts
export const directoryNamesIn = async (absolutePath: string): Promise<readonly string[]> => {
  try {
    const entries = await readdir(absolutePath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (failure) {
    if (isAbsent(failure)) return [];
    throw failure;
  }
};
```

`ENOENT` and `ENOTDIR` mean "it is not there" and are normal input, so they may become a value. Anything else means "it is there and cannot be read" and is not normal input, so it is rethrown. Writing a condition does not amount to handling the failure; each path after the condition needs a destination.

**Where "I do not want to change the return type" makes you want to flatten it into a value, that is a situation calling for the returning side.** Returning a value that cannot be told from a success is the same as erasing the failure.

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

- Placing a statement that merely writes the binding once (`failure;` / `void failure;`). The reference is counted and the report clears, and the failure has not left that statement
- Receiving the binding into a value nobody reads (`const noted = failure;` and nothing more). As above
- Handing it to a call that does nothing (`ignore(failure)`). As above
- Rethrowing only inside a condition and leaving nothing on the false path (`if (isFatal(failure)) throw failure;`). The judgment reads the reference's position so the report clears; the failure still disappears on the false path
- Taking the condition into a variable and branching on that (writing `const missing = codeOf(failure) === "ENOENT";` then `if (missing)`). A reference appearing at a declaration position counts as carrying, so the report clears; the failure still has not left the clause
- Deleting the binding to make it `catch { ... }`. This rule goes quiet and `no-discarded-failure--receive-and-surface-it` reports it
- Emptying the body to silence it. This rule goes quiet and `no-empty-catch--throw-or-handle` and `no-empty` report it
- Flattening the failure into a string before handing it over and discarding the original (`report(String(failure))`). The judgment reads whether the reference left, so it passes. Handing it over in `cause` does the same thing without flattening
- Widening the `try` / `catch` range to silence several failing operations in one clause. The number of clauses drops and which operation failed becomes unknowable
- A suppression directive

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
