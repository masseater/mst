---
description: "Disallow asserting the type of an expression that is already the result of a type assertion, so no value arrives at its declared type through a route the type checker was told to stop checking"
---

# no-double-type-assertion--declare-the-real-type

<!-- BEGIN GENERATED rule-header -->

Disallow asserting the type of an expression that is already the result of a type assertion, so no value arrives at its declared type through a route the type checker was told to stop checking

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `core`
- Source: [`no-double-type-assertion--declare-the-real-type.ts`](../../src/lint/oxlint/rules/core/no-double-type-assertion--declare-the-real-type.ts)

<!-- END GENERATED rule-header -->

## Violation

A type assertion whose own target is a type assertion. Both spellings count and mix freely, so `x as A as B`, `<B>(x as A)` and `(x as A) as B` are the same violation. What the intermediate type is is not read: a single assertion passes only where the two types overlap, while a second one on top passes whatever it claims.

At three steps or more, each step standing on an assertion is reported. A `satisfies` expression and a non-null assertion are not assertions, so `(x satisfies T) as U` and `x! as T` stay single. `[1, 2] as const as number[]` is reported, because the second step rides on the first.

## Fix

Declare the type the value really has: annotate where the value comes from, narrow it with a guard that inspects the value, or parse it and let the parse fail on input that does not match.

```ts
const parseUser = (input: unknown): User | null => (isUser(input) ? input : null);
```

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an assertion routed through unknown is reported
const total = input as unknown as number;
```

```ts
// three stacked assertions report each step that stands on an assertion
const total = input as Loose as Source as Target;
```

Code this rule accepts.

```ts
// a single assertion is still checked by the type checker
const total = input as number;
```

```ts
// an assertion applied to a satisfies expression keeps the checked step
const total = (input satisfies Source) as number;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Splitting the two steps across two statements. The route that erases the check is unchanged and harder to find
- Putting an identity function between the steps. The type route travelled is the same
- Making the intermediate type concrete so it does not look like `unknown`. The intermediate type is not read

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `stackedTypeAssertion` | A type assertion must not be applied to an expression that is already a type assertion. Declare the type the value really has: annotate the place the value comes from, narrow it with a guard that inspects the value, or parse it into the target type and let the parse fail on input that does not match. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
