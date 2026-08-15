---
description: "Require every mock function creation to carry a type parameter that pins the call signature of the dependency it stands in for, so a mock drifting from that dependency is caught by the type checker instead of passing every assertion in the suite"
---

# require-mock-type-parameter--annotate-vi-fn

<!-- BEGIN GENERATED rule-header -->

Require every mock function creation to carry a type parameter that pins the call signature of the dependency it stands in for, so a mock drifting from that dependency is caught by the type checker instead of passing every assertion in the suite

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`require-mock-type-parameter--annotate-vi-fn.ts`](../../src/lint/oxlint/rules/require-mock-type-parameter--annotate-vi-fn.ts)

<!-- END GENERATED rule-header -->

## Violation

A mock function creation without a type parameter naming the call signature it stands in for, or with one that leaves that signature open. Without it, a mock drifting from the dependency passes every assertion in the suite.

`mockNamespaceSpellings`, `mockFactoryMembers` and `unconstrainedTypeNames` settle the vocabulary.

## Fix

Write the call signature of the real dependency as the type parameter of the creation call, naming the type of every parameter and the type of the returned value.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a creation without a type parameter is reported
const send = vi.fn();
```

```ts
// a type parameter naming the catch all callable type pins nothing
const send = vi.fn<Function>();
```

Code this rule accepts.

```ts
// a creation carrying the call signature of the dependency is typed
const send = vi.fn<(recipient: string) => Promise<void>>();
```

```ts
// spying on an existing function derives the signature from the real member
const send = vi.spyOn(mailer, 'send');
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing an unconstrained type as the parameter. That is reported on its own
- Annotating the binding instead of the creation call. The creation is where the signature is pinned

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `untypedMockCreation` | A mock function must not be created without a type parameter naming the call signature it stands in for. Write the call signature of the real dependency as the type parameter of the creation call. |
| `unconstrainedMockTypeParameter` | The type parameter of a mock function creation must not leave the call signature open. Replace \`{{written}}\` with the call signature of the real dependency: name the type of every parameter and the type of the returned value. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
