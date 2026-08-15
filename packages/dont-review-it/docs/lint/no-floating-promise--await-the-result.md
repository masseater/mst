---
description: "Disallow a promise-valued expression that reaches no await, no return, no binding that is later awaited and no composition, so the place a failed asynchronous call lands is fixed by the call site's own control flow"
---

# no-floating-promise--await-the-result

<!-- BEGIN GENERATED rule-header -->

Disallow a promise-valued expression that reaches no await, no return, no binding that is later awaited and no composition, so the place a failed asynchronous call lands is fixed by the call site's own control flow

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `state`
- Source: [`no-floating-promise--await-the-result.ts`](../../src/lint/oxlint/rules/state/no-floating-promise--await-the-result.ts)

<!-- END GENERATED rule-header -->

## Violation

A promise-valued expression whose value reaches nothing. Four shapes are reported: a promise-valued call standing alone as a statement, one handed to a parameter that declares a synchronous return, one behind `void`, and one whose declared type was widened to `any` or `unknown` over an asynchronous declaration.

Without type information, what produces a promise is settled by reading declarations: an `async` function, a return type or a function-type annotation naming `Promise`, `PromiseLike` or `Thenable`, `new Promise(...)`, and the promise-producing statics of `Promise`. Parentheses, optional chains, non-null assertions and instantiation expressions are followed through.

A callback position is only read when the receiving parameter's declaration says it returns synchronously; a parameter with no annotation, a rest parameter and a spread argument are all left alone.

## Fix

Connect the promise: `await` it, `return` it, bind it and `await` that binding, or hand it to a composition such as `Promise.all` and `await` the composition.

Where the result is genuinely not needed, the failure still is: `await` inside a `try` statement and settle in the `catch` clause where the failure goes.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a call to an async arrow standing alone as a statement is reported
const fetchUser = async () => 1;
fetchUser();
```

```ts
// voiding the call states an intent instead of connecting the promise
const fetchUser = async () => 1;
void fetchUser();
```

Code this rule accepts.

```ts
// awaiting the call connects it to the enclosing control flow
const fetchUser = async () => 1;
const load = async () => {
  await fetchUser();
};
```

```ts
// handing the calls to a composition and awaiting the composition connects them
const fetchUser = async () => 1;
const load = async () => {
  await Promise.all([fetchUser(), fetchUser()]);
};
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Wrapping the call in `void`, or receiving it into a binding nothing awaits. Neither connects the promise
- Widening the return type to `any` or `unknown`. That shape is reported on its own
- Handing it to a callback position with no type annotation, or to a dependency's built-in method. The declaration becomes unreadable while the failure still drops

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `floatingPromiseStatement` | A promise-valued expression must not stand alone as a statement. Nothing receives the promise and its failure reaches no \`catch\` clause. Use one of the four connections: \`await\` the call, \`return\` it to the caller, bind it and \`await\` that binding, or hand it to a composition such as \`Promise.all\` and \`await\` the composition. Not needing the result is not the same as not needing the failure. Decide where the failure goes: \`await\` the call inside a \`try\` statement and act on it in the \`catch\` clause. |
| `floatingPromiseCallback` | A promise-valued argument must not be handed to a parameter that declares a synchronous return. The receiver drops the promise and its failure reaches no \`catch\` clause. Declare the parameter as a function returning a promise and \`await\` what it hands back, or keep the callback synchronous. Use one of the four connections inside the receiver: \`await\` the call, \`return\` it to the caller, bind it and \`await\` that binding, or hand it to a composition such as \`Promise.all\` and \`await\` the composition. Not needing the result is not the same as not needing the failure. |
| `voidedPromise` | \`void\` in front of a promise-valued expression must not stand in for a connection. The promise still reaches nothing and its failure reaches no \`catch\` clause. Drop the \`void\` and use one of the four connections: \`await\` the expression, \`return\` it to the caller, bind it and \`await\` that binding, or hand it to a composition such as \`Promise.all\` and \`await\` the composition. Not needing the result is not the same as not needing the failure. |
| `widenedAsyncCall` | A call whose declared type is widened to \`any\` or \`unknown\` must not stand alone as a statement while the declaration it resolves to is asynchronous. Nothing receives the promise and its failure reaches no \`catch\` clause. Declare a type that names what the call yields, then use one of the four connections: \`await\` the call, \`return\` it to the caller, bind it and \`await\` that binding, or hand it to a composition such as \`Promise.all\` and \`await\` the composition. Not needing the result is not the same as not needing the failure. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
