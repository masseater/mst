---
description: "Disallow calling a member named then, catch or finally, so the continuation and the failure handling of an asynchronous call stay on the enclosing function's own control flow"
---

# no-promise-chain--use-async-await

<!-- BEGIN GENERATED rule-header -->

Disallow calling a member named then, catch or finally, so the continuation and the failure handling of an asynchronous call stay on the enclosing function's own control flow

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `state`
- Source: [`no-promise-chain--use-async-await.ts`](../../src/lint/oxlint/rules/state/no-promise-chain--use-async-await.ts)

<!-- END GENERATED rule-header -->

## Violation

A call to a member named `then`, `catch` or `finally`. The name is read from dot notation, a string-literal subscript and a template with no substitution alike; what the receiver is is not read, because a chain shaped like this carries continuation and failure handling off the enclosing function's own control flow.

## Fix

`await` the asynchronous value and let the following statements use it. Put the failure handling in the `catch` clause and the cleanup in the `finally` clause of a `try` statement enclosing that `await`.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a then call is reported at the property name
promise.then(handle);
```

```ts
// each link of a chain is reported on its own
promise.then(handle).catch(recover).finally(close);
```

Code this rule accepts.

```ts
// awaiting the value and handling failure in an enclosing try statement is the shape this rule keeps
const load = async (fetchUser, release) => {
  try {
    const user = await fetchUser();
    return user;
  } catch (failure) {
    throw failure;
  } finally {
    release();
  }
};
```

```ts
// composing with a static Promise method is a member call whose name is none of the three
const both = async (first, second) => await Promise.all([first, second]);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Reaching the member through a subscript. A spelled-out subscript is read as the name
- Dropping the `.catch()` to leave a chain with no failure handling. `no-floating-promise--await-the-result` receives what is left

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `promiseChainCall` | Calling a member named \`{{method}}\` is forbidden. Await the asynchronous value and let the following statements use it, and move the failure handling into the \`catch\` clause and the cleanup into the \`finally\` clause of a \`try\` statement that encloses that \`await\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
