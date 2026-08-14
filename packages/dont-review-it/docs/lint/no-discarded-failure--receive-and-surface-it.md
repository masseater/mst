---
description: "Disallow taking the result of a call that returns a failure and a value as a pair without binding the failure, and disallow a catch clause that names nothing, so a failure reaches a place that can act on it instead of turning into the value that stands for its own absence"
---

# no-discarded-failure--receive-and-surface-it

<!-- BEGIN GENERATED rule-header -->

Disallow taking the result of a call that returns a failure and a value as a pair without binding the failure, and disallow a catch clause that names nothing, so a failure reaches a place that can act on it instead of turning into the value that stands for its own absence

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-discarded-failure--receive-and-surface-it.ts`](../../src/lint/oxlint/rules/no-discarded-failure--receive-and-surface-it.ts)

<!-- END GENERATED rule-header -->

## Violation

Syntax that throws away a value standing for a failure without receiving it. Two families.

**1. Taking apart a call that returns a failure and a result as a pair, without binding the failure side.** In this repository the only calls returning such a pair are es-toolkit's `attempt` and `attemptAsync`. The judgment is made on the spelling of the callee, and where that name came from is not resolved.

| Shape | What is happening |
| --- | --- |
| `const [, parsed] = attempt(...)` | The failure's position is a hole |
| `const [_, parsed] = attempt(...)` | It is bound to a name declared as one that will not be read |
| `const [] = attempt(...)` | Neither half is bound |
| `const { 1: parsed } = attempt(...)` | Only the result's index is spelled |
| `attempt(...)[1]` | Only the result element is read |
| `attempt(...);` standing as a statement | The whole pair is discarded |
| `void attempt(...)` | As above |
| `const [, parsed] = await attemptAsync(...)` | An `await` in between changes nothing |

Parentheses, `as` assertions, non-null assertions and optional chains do not change where the pair lands, so they are followed and the position outside them is judged.

These are not reported: the pair was received, or a route to the failure remains.

- Binding both (`const [failure, parsed] = attempt(...)`)
- Binding the failure alone (`const [failure] = attempt(...)`, `attempt(...)[0]`)
- Binding the pair itself (`const parsed = attempt(...)`)
- A rest element at the head (`const [...both] = attempt(...)`)
- An object pattern spelling the failure's index (`const { 0: failure, 1: parsed } = attempt(...)`)
- Handing the pair to another call, returning it, or making it the value of a function's body

**2. A `catch` clause carrying no binding.** `catch { ... }` and a binding spelled with underscores alone (`catch (_)`) are reported. Both declare that what was caught will not be read.

### Where it overlaps the off-the-shelf rules

Swallowing a failure is divided across four rules.

| Shape | What watches it |
| --- | --- |
| `catch { }` with an empty body | `no-empty` and this rule both report it |
| `catch (e) { throw e; }` alone | `no-useless-catch` |
| Writing the failure to an output and carrying on | `no-logged-and-continued-failure--stop-or-recover` |
| Discarding a failure without receiving it | This rule |

A `catch` with an empty body and no binding is reported twice: `no-empty` reads the body and this rule reads the binding, so fixing one leaves the other.

No file kind is exempt. Test code is read the same way.

### The invariant

The set of things that were checked equals the set of things reported as checked.

Discard a failure and it turns into a value standing for its own absence. A file that could not be read becomes `null`, a directory that could not be listed becomes an empty array, a scan that never ran becomes an empty index.

That breaks in two layers. The first is that the caller cannot tell them apart. "There is nothing" and "there is something and it cannot be read" become the same value, so the caller takes the first reading. An empty directory drops out of the walk; a `null` manifest is treated as "no declaration". The shape of the value cannot recover which it was.

The second is that being unable to tell does not show up in a check. The set being scanned shrinks quietly, everything passes in the shrunken state, and the exit status is zero. This is where a green lint over an unchecked repository comes from. A route treating an unreadable directory as an empty one did exist in this repository, and everything under it had vanished from what was checked. Nothing anywhere said so.

Reading `try` / `catch` as syntax does not catch this shape: taking apart a pair-returning call is not even a `catch` clause. So this rule judges on whether the value standing for a failure was received, not on syntax.

### Configuration

None. Whether the rule is on or off is settled by the configuration, and nothing else about the judgment is. The list of pair-returning callees lives in the rule. Introducing another library that returns such a pair pairs with adding its spelling here.

## Fix

Settle what a failure means for that call. There are three answers.

**Where the target being absent is normal input, it may be expressed as a value.** Only absence becomes a value, and the failure's `code` sorts it.

```ts
export const readUnlessMissing = <Read>(read: () => Read): Read | null => {
  const [unreadablePath, found] = attempt(read);
  if (unreadablePath === null) return found;

  const code = failureCodeOf(unreadablePath);
  if (code === MISSING_PATH_CODE || code === MISSING_PARENT_CODE) return null;
  throw unreadablePath;
};
```

`ENOENT` and `ENOTDIR` mean "it is not there" and are normal input. `EACCES` means "it is there and cannot be read" and is not. Do not collapse them into one `null`.

**Every other failure is surfaced.** Throw a failure named after what could not be read, handing the original over as `cause`.

```ts
const [unparsableText, parsed] = attempt(() => parseJson(text));
if (unparsableText === null) return parsed;
throw new Error(`${path} exists but does not parse as JSON`, { cause: unparsableText });
```

**Only a failure that changes nothing about the walk may be swallowed.** The judgment runs in two steps.

1. Does that failure change the set of things checked or the set of places reported? If it does, it may not be swallowed
2. If it does not, separate a failure the environment refused from a declaration of ours that is broken. A failure the environment refused carries a `code` from the runtime. One without a `code` is a defect on our side and is surfaced even where nothing changes

Only two places in this repository pass both steps.

- Reading and writing the derived cache (`catalog-cache.ts`). The cache is derived from the walk's results, so failing to read it means rebuilding it and failing to write it means building it again next time. Not one thing checked changes. The writing side swallows only failures carrying a `code`, and throws defects such as a value that cannot be serialised
- Harvesting the vocabulary of dependency packages (`library-vocabulary/harvester.ts`). As [EDR 0008](../../../../docs/engineering-decision-logs/0008-read-library-types-for-messages-only.md) settled, this type information is used only for what a report says and changes no set of reported places. That the lint does not fail in an environment where the type checker cannot start is a contract that EDR stated outright. Here too, only failures carrying a `code` are swallowed

**A `catch` clause names what it caught.** Having named it, choose between stopping and returning. Which one belongs to [no-logged-and-continued-failure--stop-or-recover](./no-logged-and-continued-failure--stop-or-recover.md).

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// eliding the failure element is reported
const [, parsed] = attempt(() => parse(text));
```

```ts
// a catch clause that binds nothing is reported
try {
  run();
} catch {
  recover();
}
```

Code this rule accepts.

```ts
// binding both halves of the pair receives the failure
const [failure, parsed] = attempt(() => parse(text));
```

```ts
// a catch clause that names the failure and rethrows it receives it
try {
  run();
} catch (failure) {
  throw failure;
}
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Receiving the pair into a variable first and reading only the result (`const pair = attempt(...);` then `pair[1]` on the next line). The judgment is made where it is taken apart, so the report clears while the failure still goes unread
- Taking the result out with `at` (`attempt(...).at(1)`). As above
- Putting the index in a variable first (`attempt(...)[RESULT]`). A non-literal index cannot be judged, and a reader cannot tell which element is being read either
- Writing your own wrapper around `attempt` and discarding the failure inside it. The judgment reads the spelling of the callee, so what is inside the wrapper is not reported. Wrapping it is itself the act of hiding the failure
- Renaming the import and calling that (`import { attempt as run }`). As above
- Binding the failure to a name and never reading it. It is grammatically received, so this rule passes it. What to do with a failure you received is settled there and then
- Adding an underscore to make it look like a binding name (`_failure`). A name of underscores alone is reported, and a word after the underscore passes — it passes because you declared an intent to read it under that name
- Rewriting `try` / `catch` into `attempt` to clear only the report about an unbound `catch`. Taking the pair apart meets the same judgment
- Collapsing "it is not there" and "it cannot be read" into one `null` and treating it as normal input. That is the route by which the walk quietly shrinks. Sort them by `code`
- A suppression directive

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `discardedFailurePair` | The failure half of this pair must not be dropped. Bind the failure and decide at this call what it means: keep a normal absence as a value selected by the failure's \`code\`, and throw for every other failure with the original passed as \`cause\`. |
| `unnamedCatchFailure` | A catch clause must not leave what it caught unbound. Bind the failure and pick an ending the caller can act on: rethrow it, throw one that names this layer's part in it with the original as \`cause\`, or return a value that shows the operation did not complete. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
