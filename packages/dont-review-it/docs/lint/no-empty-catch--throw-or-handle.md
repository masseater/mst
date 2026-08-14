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

A `catch` clause whose body carries no statement. Whether the clause binds the failure makes no difference: `catch {}` and `catch (failure) {}` are the same shape to this rule.

"Carries no statement" is decided from the statements directly under the body. Three bodies count as carrying none.

- The body is empty (`catch (failure) {}`)
- The body holds nothing but empty statements (`catch (failure) { ; }`)
- The body holds nothing but a block whose contents meet the same condition (`catch (failure) { {} }`, `catch (failure) { { ; } }`)

A comment is not a statement. A body written with comments alone is reported.

One statement that does work is enough, and its contents are not read. `register(() => {});` does work as far as the clause is concerned, even though the function handed over is empty, and `void failure;` does work as well. Whether the statement standing there carries the failure anywhere is what [no-silent-catch--rethrow-or-handle](./no-silent-catch--rethrow-or-handle.md) reads. The two rules divide on "does the body do work" against "does what it does carry the failure".

Both rules decide that question through one shared predicate. Splitting on the number of statements would let a body like `catch (failure) { ; }` — one that holds a statement in the syntax tree while doing no work — enter both, and one clause would be asked for two different fixes at once.

The `try` block and the `finally` block are not read. Neither is reported when empty. An empty `try` has nothing to catch, and an empty `finally` has no cleanup, and neither answers the question of what happens to a failure that was caught.

Nested `try` statements are judged one clause at a time, each against its own body. An inner body that carries nothing is reported even when the outer one carries statements.

Functions defined inside a `catch` clause are not entered. The scan stops at the statements standing directly in the body.

The invariant behind the rule is that the place which catches a failure is the place that settles where the failure goes.

Control reaching a `catch` clause means the operations inside `try` did not run to the end. A body with no statement means nothing has been settled about that fact. Control moves to the statement after the `try`, and from there the run follows exactly the path a successful one would.

That breaks in two layers. The first is that the failure never reaches the caller. Whatever `try` was going to produce is absent or half-built, and every statement after the empty clause runs on that state. When the function returns a value, a failed run and a successful one return the same one, and the caller cannot tell them apart from the shape of what it received.

The second is that the failure not arriving never shows up in a check. The exception is gone, the exit status is zero, and the tests, the type checker and CI all pass. This is where a green lint over an unchecked repository comes from.

The shape survives because it costs the least to write. Settling where a failure goes means reading what the operation was going to produce and how the caller uses it. Leaving the body empty defers that reading while the syntax is already complete, and the deferral leaves no trace: an empty body reads equally as "nothing happens here, and that was decided" and as "this was never decided". A machine stops it because those two cannot be told apart.

An option to change any of this is not offered. What counts as a body carrying no statement is settled inside the rule, and there is no threshold, no vocabulary and no per-target exception for a configuration to pass in. Changing the judgment means changing the rule.

### Where it overlaps the off-the-shelf rules

`no-empty` reports an empty block statement anywhere, so `catch (failure) {}` is reported by both. The overlap is there because `no-empty` reads the syntax of an empty block while this rule reads the position of a `catch` clause. Fixing one clears both.

Three shapes pass `no-empty` and are reported here: a body holding only a comment, a body holding only `;`, and `catch (failure) { {} }`, where `no-empty` names the inner block instead of the clause.

The fix `no-empty` suggests is to remove the block or put a comment in it. With a single comment offered as a way to green, enabling `no-empty` alone leaves a clause that swallowed a failure passing. That difference is why the bundle carries this rule separately.

Swallowing a failure is divided across five rules. A body with no statement belongs here. A clause that records the failure nowhere belongs to `no-silent-catch--rethrow-or-handle`. Writing the failure to an output and carrying on belongs to `no-logged-and-continued-failure--stop-or-recover`. Discarding a failure without receiving it belongs to `no-discarded-failure--receive-and-surface-it`. A clause that only rethrows belongs to `no-useless-catch`.

A `catch {}` with an empty body and no binding is reported by this rule, by `no-empty` and by `no-discarded-failure--receive-and-surface-it`. The three read the body, the block syntax and the binding, so the reports pile up while what has to change stays one thing.

No file kind is exempt. Test code is read the same way.

## Fix

Settle what the caller receives when control enters the clause, and write that in the body. There are two answers and one of them always applies.

**Stop.** Rethrow the failure as it stands, or throw one named after this layer's part in it and hand the original over as `cause`. The decision moves to the caller.

**Return.** Return the value the caller should use when the operation fails. Shape that value so the caller can tell the operation did not complete.

In this repository, one clause in `packages/agentic-documents/src/scan/read-file.ts` does both:

```ts
export const statOrNull = async (absolutePath: string): Promise<Stats | null> => {
  try {
    return await lstat(absolutePath);
  } catch (failure) {
    if (isAbsent(failure)) return null;
    throw failure;
  }
};
```

Only an absence that arises from normal input belongs on the returning side, and the failure's `code` is what sorts it:

```ts
const ABSENT_CODES: ReadonlySet<string> = new Set([NOT_FOUND_CODE, NOT_A_DIRECTORY_CODE]);

const isAbsent = (failure: unknown): boolean =>
  failure instanceof Error &&
  "code" in failure &&
  typeof failure.code === "string" &&
  ABSENT_CODES.has(failure.code);
```

Do not collapse "it is not there" and "it is there and cannot be read" into one returned value. Collapsed, the caller carries on unable to tell them apart.

**When there is nothing to settle here, remove the `try` as well.** If the clause is empty because this place cannot handle the failure, then carrying it to a place that can is the right answer. Removing `try` and `catch` sends the failure to the caller, and the decision moves there with it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a catch clause with an empty body is reported
try {
  run();
} catch (failure) {}
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

- Filling the body with a comment. A comment is not a statement. This passes `no-empty` and does not pass here
- Placing an empty statement (`;`). It joins the list of statements while the body still holds nothing
- Placing an empty block (`{}`). Nesting is followed, so it meets the same judgment
- Placing one statement that means nothing (`void failure;`, `failure;`, a call handed an empty callback). The body now holds a statement and leaves this rule's reach, while the failure still arrives nowhere. [no-silent-catch--rethrow-or-handle](./no-silent-catch--rethrow-or-handle.md) receives it
- Placing a bare `return;` and calling it returning. It returns as far as the grammar goes, while the caller cannot tell the result from a successful one. Returning means returning a value that shows the operation did not complete
- Moving the clause under a configuration layer that does not name this rule. A layer carrying part of the bundle is reported by [no-partial-rule-set--enable-the-whole-set](./no-partial-rule-set--enable-the-whole-set.md)
- Rewriting `try` / `catch` into `promise.catch(() => {})`. It is no longer a `catch` clause and leaves this rule's reach. [no-promise-chain--use-async-await](./no-promise-chain--use-async-await.md) receives it
- A suppression directive

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
