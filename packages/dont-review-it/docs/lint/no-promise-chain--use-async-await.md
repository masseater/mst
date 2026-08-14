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
- Shipped in the preset: yes
- Source: [`no-promise-chain--use-async-await.ts`](../../src/lint/oxlint/rules/no-promise-chain--use-async-await.ts)

<!-- END GENERATED rule-header -->

## Violation

A call expression whose callee is a member reference and whose property name resolves statically to `then`, `catch` or `finally`. Those two points settle the judgment. Whether the receiver is actually a promise is not read.

Static resolution of the property name treats these as the same.

- Identifier access in dot notation (`promise.then(handle)`)
- A string literal in subscript notation (`promise["then"](handle)`)
- A template literal carrying no expression, in subscript notation (``promise[`then`](handle)``)

A different call shape is reported alike as long as it stays a member call. An optional chain (`promise?.then(handle)`), an optional invocation (`promise.then?.(handle)`), a non-null assertion on the receiver (`promise!.then(handle)`) and a parenthesized callee (`(promise.then)(handle)`) are all in scope.

Where several such calls stand in one expression (a chain like `promise.then(a).catch(b).finally(c)`), each is reported as an independent violation. Collapse them into one and, after fixing one, the rest are invisible and whether it is fully fixed cannot be settled.

The report stands on the property name itself rather than on the whole call expression, so the position of the error matches the place to rewrite.

These are not detected.

| Shape | Why it is not detected |
| --- | --- |
| `Promise.all([...])` / `Promise.race` / `Promise.allSettled` | A member call, but the name is none of the three |
| `new Promise((resolve, reject) => ...)` | Not a member call |
| `queue.thenable(handle)` / `queue.catchAll(handle)` | Merely contains one of the three; no exact match |
| `queue[key](handle)` / `handlers[0](handle)` | The property name does not settle statically into a string |
| ``queue[`th${suffix}`](handle)`` | A template carrying an expression does not settle statically |
| `queue["done"](handle)` | Settles statically but is none of the three |
| `const continueWith = promise.then;` | A member reference with no call. The firing position is limited to calls |
| `const box = { then(handle) { return handle; } };` | The defining side is not read; only call positions are |
| `this.#then()` | The private identifier `#then` is a different name from `then` and cannot collide |
| `try { ... } catch (failure) { ... } finally { ... }` | Syntax rather than a member reference. `catch` is a reserved word |

Two kinds of grounds sit in that list. "A subscript that does not settle statically" is an exclusion resting on the fact that the property name is not settled; "a member reference with no call" is an exclusion resting on the design decision to limit the firing position to calls. Neither means it may be written. The latter is closed under forbidden bypasses.

A context where `await` cannot be written (inside a non-async function, say) is no exception either. This rule reads the shape of the call and not the context. Satisfying it means carving out an async function.

There is no narrowing by file kind either. Verification code and generated output are treated the same. Where to enable it and at what severity are decisions for the configuration side rather than this rule's specification.

### The invariant

The success path and the failure path of asynchronous work both stand visible, side by side, on the calling function's lexical control flow. Three shapes are the whole of it: an asynchronous value is taken out with `await` and the result is used by the following statements; failure handling goes in the `catch` clause enclosing that `await`; and teardown that runs either way goes in the `finally` clause enclosing it. Hold that, and what happens when an asynchronous call fails is settled by walking the syntax tree outward from the call. A reader and a static analyser reach the same answer by the same steps.

What the chain form breaks has two layers.

The first is that the appearance and the reality of failure handling drift apart. In a chain the failure handler goes inside a function passed as an argument. With one handler written, a reviewer reads "the failure is handled". The state where that handler merely discards the value it received is available in a very short spelling.

The second is that a machine can no longer go and read that reality. To check whether the failure handling is sound — is it swallowing, does it rethrow or record — the syntactic position under check has to be settled on one place. A rule auditing the contents of a `catch` clause stands only on that premise. Scatter the handlers into callback arguments and the auditing side has to solve "which function is the failure handler" first, and misses come out there.

So this rule's value looks like aligning a spelling on its own, while in substance it gathers failure handling into the one place a `catch` clause is and builds the state where another rule can check that one place.

Not reading types is intended over-detection. A fluent interface that is not a promise but happens to carry a method of the same name is a violation too. Allow it and a reader has to confirm the receiver's type at each call to settle "is this an asynchronous failure path", and the invariant loses the property of being readable. The fix for that case has not been settled: wrapping under another name has been proposed, but the wrapper's own implementation contains a member call of the same name, so the report merely moves from the call site into the wrapper. Until it is settled, do not hide it; report the situation itself as material for deciding whether an exception is needed.

### Configuration

None. Only whether the rule is on or off is settled by the configuration.

This invariant is valuable because the calling side takes only one shape. Leave room to loosen it in configuration and a reader has to check each loosened place individually, which collapses the premise itself. Whether to make it an option is decided once a case genuinely needing an exclusion list appears.

## Fix

Replace each element of the chain with the corresponding syntax.

| Chain element | Replacement |
| --- | --- |
| A continuation that only uses the result | Use the `await`ed return value in the following statements |
| Handling on failure | The `catch` clause of the `try` enclosing that `await` |
| Teardown that runs either way | The `finally` clause of the `try` enclosing that `await` |

```ts
const loadUser = async (userId: string): Promise<User> => {
  try {
    const fetched = await fetchUser(userId);
    return normalizeUser(fetched);
  } catch (failure) {
    return recoverUser(failure);
  } finally {
    releaseConnection();
  }
};
```

Where a call is made expecting a failure (in verification code, say), receive it with `try` / `catch` inside an immediately invoked function and `return` from each path whether a failure happened. Bind the return value to a single `const` before checking it.

```ts
const rejection = await (async () => {
  try {
    await loadUser("missing");
    return null;
  } catch (failure) {
    return failure;
  }
})();

expect(rejection).toBeInstanceOf(UserNotFoundError);
```

That shape avoids an empty `catch` clause and detects the case where the call did not fail, as `null`. Recording whether a failure happened into a variable in an enclosing scope and checking it later is not taken; the reason is in the next section.

There is no automatic fix. Rewriting requires making the enclosing function `async`, and introducing `await` changes the evaluation order, so it is not a mechanically safe transformation.

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

Each of these fails the invariant while slipping past the detection.

- Recording whether a failure happened into a variable in an enclosing scope and checking it later. Placing `let caught = false;` and rewriting it in the `catch` clause makes that declaration and that write a violation of [no-reassign--use-spread-or-iife](./no-reassign--use-spread-or-iife.md). Use the immediately invoked function from the previous section
- Escaping one of the three words into a variable or a dynamic key and calling through a subscript (`const key = "then"; promise[key](handle);`). The detection comes off, and the failure path is still inside a callback
- Taking the member reference as a value and calling it indirectly (`const continueWith = promise.then; continueWith.call(promise, handle);`). It merely leaves a detection that fires at call positions
- Wrapping the callee in a type assertion (`(promise.then as Continuation)(handle);`). This rule reads the callee only as a bare member reference, so the detection comes off. As a breach of the invariant it is the same
- Wrapping the whole expression in a `void` operator or an assignment to think the shape changed. Wrapping leaves the member call shape, and even if the detection came off the failure path is still inside a callback
- Carving the handlers into another helper and deleting only the chain from the call site. The position of the failure handling moves away from the call, so the original problem stays as it is

Where a situation makes you want to evade, do not hide it: report the situation itself and decide whether an exception is needed.

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
