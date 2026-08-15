---
description: "Disallow a module whose every statement is a re-export and which forwards at least one value, so the module a binding is taken from is the module that declares it"
---

# no-barrel-module--declare-in-the-owning-module

<!-- BEGIN GENERATED rule-header -->

Disallow a module whose every statement is a re-export and which forwards at least one value, so the module a binding is taken from is the module that declares it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: no
- Source: [`no-barrel-module--declare-in-the-owning-module.ts`](../../src/lint/oxlint/rules/no-barrel-module--declare-in-the-owning-module.ts)

<!-- END GENERATED rule-header -->

## Violation

A module whose every statement is a re-export and which forwards at least one value. A module forwarding types alone is left alone, and so is an empty file. `exclude` holds glob patterns for the paths a deployment keeps as an entry.

This rule is not in the shipped preset. A consumer names it in `rules` to turn it on.

## Fix

Delete the module and let every importer name the module that declares the binding it takes.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a file holding one named re-export and nothing else is reported
export { total } from './total.ts';
```

```ts
// one value among forwarded types is enough to carry values
export { total, type Total } from './total.ts';
```

Code this rule accepts.

```ts
// a re-export beside a declaration leaves the file with something of its own
export { sum } from './sum.ts';
export const total = 1;
```

```ts
// forwarding types alone leaves nothing behind once the build is done
export type { Total } from './total.ts';
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding one declaration to the file so it is no longer re-exports alone. The forwarding stays
- Adding the path to `exclude` to keep a module nothing requires as an entry

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `barrelModule` | A module that carries re-exports and nothing else is forbidden. Delete it and let every importer name the module that declares the binding it takes. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
