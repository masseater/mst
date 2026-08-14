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
- Shipped in the preset: yes
- Source: [`no-floating-promise--await-the-result.ts`](../../src/lint/oxlint/rules/no-floating-promise--await-the-result.ts)

<!-- END GENERATED rule-header -->

## Violation

An expression producing a promise whose value is connected to nothing. Connection means one of four things.

- It is `await`ed
- It is `return`ed (leaving the connection to the caller)
- It is assigned to a binding, and that binding later reaches one of the above
- It is handed to a composition such as `Promise.all`, and that composition's result reaches one of the above

Four shapes are reported, with four report messages, because the place to rewrite differs by shape.

| Shape | messageId | What is happening |
| --- | --- | --- |
| `fetchUser();` (a call standing alone as a statement) | `floatingPromiseStatement` | An asynchronous call stands where a value is discarded |
| `runEach(async (name) => { ... })` (a callback position declaring a synchronous return) | `floatingPromiseCallback` | The receiver does not wait, so the failure always drops |
| `void fetchUser();` | `voidedPromise` | A statement of intent not to wait, which is not a connection |
| `widened();` (a declared type of `any` / `unknown` over an asynchronous body) | `widenedAsyncCall` | The type was widened; the declaration reached is still asynchronous |

### Settling what produces a promise

The type checker is not used. oxlint's JavaScript plugin receives no type information, so the judgment runs by **reading declarations**. The callee is followed as a single-assignment binding, and it counts as producing a promise where any of these holds.

- The function declaration reached is `async`
- The return type annotation of the declaration reached names `Promise`, `PromiseLike` or `Thenable`. A union or an intersection hits where any constituent names one
- The binding's type annotation is a function type whose return type names one of the above
- `new Promise(...)`
- A call to `Promise.all`, `Promise.allSettled`, `Promise.any`, `Promise.race`, `Promise.resolve`, `Promise.reject` or `Promise.try`

Parentheses, optional chains, non-null assertions and instantiation expressions do not change where the value arrives, so they are followed and the inside is judged. A type assertion whose target is `any` or `unknown` keeps **the fact that the type was widened** and keeps following inward (the fourth shape); any other target type uses the inner declaration as it stands.

Only the `void`-wrapped shape (the third) also covers expressions that are not calls. `void` always discards the value, so there is no need to consider a binding being awaited later. Both a binding whose type annotation names a promise and a binding whose initializer is a promise-producing call are reported.

Single assignment is guaranteed by [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md). So following declarations settles a binding's final value, and this judgment needs no reachability analysis.

### Not reported

- A promise holding any of the four connections above
- A call to a synchronous function. A type producing no promise is out of scope
- Operations following an `await`ed result. Already connected
- The definition of an asynchronous function itself. Only call positions and hand-over positions are read
- A callback position where the receiving parameter declares a function type returning a promise. The receiver has declared that it waits
- A callback position where the parameter carries no type annotation, is not a function type, or returns `any` / `unknown`. It cannot be settled that a synchronous return was declared
- A rest parameter position, and arguments handed over by a spread. Which declared position they land in is not settled

A means of marking a call as deliberately unawaited has not been settled. Until it is, no shape falls under that exception and the implementation accepts none.

### The invariant

An asynchronous call has its result connected to the caller's control flow. Seeing an asynchronous call, where its failure is caught is settled by walking the syntax tree outward from the call. The demand "I do not need the result" does not leave this invariant either: write plainly that it is not needed, and settle where the failure goes.

Two layers of reason.

The first is a direct consequence of [no-promise-chain--use-async-await](./no-promise-chain--use-async-await.md). Forbid the chain form and the cheapest way to remove a chain is to remove the `.catch()` with it. What is left is **a call with no failure handling that is not awaited**, and that shape is not a chain, so it does not meet that rule's detection condition. With nobody responsible, forbidding chains only pushes the writer toward deleting failure handling entirely. That is a prohibition creating another hole, which is worse than the original state.

The second is that the shape is invisible to a reader and to a machine alike. An unawaited call is indistinguishable from a synchronous statement, and its failure reaches no `catch` in the caller. Some runtimes do not even warn, and processing continues with the failure unobserved. If `no-promise-chain--use-async-await` exists to "gather failure routes into the one place a `catch` clause is, so another rule can check there", leaving a route that escapes the gathering breaks that design purpose itself.

This rule is not enabled on its own. It is one of a bundle sharing an invariant, and in a setup where the rule it delegates to is disabled, the delegating rule has merely declared that it does not detect that shape.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

Give it conditions such as "in this file you need not wait" or "this module is out of scope" and a configuration file settles where failures drop, leaving a reader unable to judge where a failure goes from the call site. The spellings `Promise` / `PromiseLike` / `Thenable` used in the judgment, and the list of promise-producing statics, are held by the rule. Introduce a thenable under another spelling and adding that spelling to this rule is the paired work.

## Fix

Four routes, by what you want done with the result.

**The result is needed.** `await` it and let the following statements use the value.

```ts
const load = async (repositoryRoot: string): Promise<BodyIndex> => {
  const index = await buildRepositoryBodyIndex({ repositoryRoot });
  return index;
};
```

**Leave it to the caller.** `return` it. The caller settles the connection.

```ts
const load = (repositoryRoot: string): Promise<BodyIndex> =>
  buildRepositoryBodyIndex({ repositoryRoot });
```

**Run several in parallel.** Hand them to a composition and `await` the composition. Each call is connected to the composition, and the composition to the `await`.

```ts
const loadBoth = async (roots: readonly string[]): Promise<readonly BodyIndex[]> =>
  await Promise.all(roots.map((repositoryRoot) => buildRepositoryBodyIndex({ repositoryRoot })));
```

**The result is genuinely not needed.** What is not needed is the **result**, not the **failure**. `await` it, receive it with `try` / `catch`, and settle where the failure goes on the spot. What to settle is handled by [no-discarded-failure--receive-and-surface-it](./no-discarded-failure--receive-and-surface-it.md) and [no-logged-and-continued-failure--stop-or-recover](./no-logged-and-continued-failure--stop-or-recover.md).

For a callback position (`floatingPromiseCallback`), repair the receiving side. Declare the parameter's type as a function type returning a promise and `await` on the receiving side. Where waiting is impossible there, return the callback to a synchronous one.

There is no automatic fix. Inserting `await` requires making the enclosing function `async`, and it changes the evaluation order.

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

Each of these fails the invariant while slipping past the detection. Not being detectable does not mean it may be written.

- Receiving it into a binding nothing uses (placing `const ignored = fetchUser();` and never awaiting that binding anywhere). The judgment runs on a call standing where a value is discarded, so the report clears, and the failure still has nowhere to go
- Placing the binding alone as a statement (`const pending = fetchUser();` followed by `pending;`). As above
- Wrapping in the `void` operator. The third shape reports it. Wrapping is not connecting
- Adding an empty handler in a chain to tidy the shape. `no-promise-chain--use-async-await` reports it
- Handing an asynchronous function to a synchronous callback position to remove the call statement. The second shape reports it
- Widening the return type to `any` / `unknown` to hide from the judgment. The fourth shape reports it
- Escaping into a callback position whose parameter carries no type annotation. The parameter's declaration cannot be read so the report clears; writing the type on the receiving side is the paired work
- Escaping into a built-in method of a dependency package (`items.forEach(async (item) => { ... })`). A built-in's declaration cannot be read from the source so the report clears. This is the position where unawaited calls arise most
- Moving the asynchronous function to another module and calling the imported name. The judgment follows declarations inside this file, so an imported name's body cannot be read
- A suppression directive. [no-silent-suppression--fix-or-justify-inline](./no-silent-suppression--fix-or-justify-inline.md) and [no-inline-suppression-of-protected-rule--register-the-exception-in-configuration](./no-inline-suppression-of-protected-rule--register-the-exception-in-configuration.md) hold the conditions for accepting one

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
