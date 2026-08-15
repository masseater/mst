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
- Bundle: `mutation-and-failure`
- Source: [`no-discarded-failure--receive-and-surface-it.ts`](../../src/lint/oxlint/rules/mutation-and-failure/no-discarded-failure--receive-and-surface-it.ts)

<!-- END GENERATED rule-header -->

## Violation

Two shapes that throw away a value standing for a failure.

- Taking apart a call to `attempt` or `attemptAsync` without binding the failure half: a hole or an underscore-only name in the first element, an empty pattern, an object pattern spelling only index `1`, reading `[1]` off the call, and the call standing as a statement or behind `void`. `await`, parentheses, `as`, `satisfies`, non-null assertions and optional chains do not change where the pair lands
- A `catch` clause with no binding, or one bound to a name of underscores alone

Binding the pair itself, binding the failure alone, a rest element at the head, and handing the pair on to a call or a `return` are all receptions and are not reported.

## Fix

Bind the failure and decide at that call what it means.

Where the target being absent is normal input, keep only absence as a value and sort it by the failure's `code`; throw everything else with the original passed as `cause`. A `catch` clause names what it caught and then either stops or returns a value that shows the operation did not complete.

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

- Binding the pair first and reading `[1]` on the next line. The judgment runs where the pair is taken apart
- Writing your own wrapper around `attempt` and discarding the failure inside it. The callee's spelling is what is read
- Naming the binding with underscores alone. That declares the value will not be read
- Collapsing "it is not there" and "it cannot be read" into one `null`

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
