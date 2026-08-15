---
description: "Disallow a module specifier that names a re-export module while the statement takes a value through it, so the module a binding is taken from is the module that declares it"
---

# no-barrel-import--import-from-the-owning-module

<!-- BEGIN GENERATED rule-header -->

Disallow a module specifier that names a re-export module while the statement takes a value through it, so the module a binding is taken from is the module that declares it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: no
- Source: [`no-barrel-import--import-from-the-owning-module.ts`](../../src/lint/oxlint/rules/no-barrel-import--import-from-the-owning-module.ts)

<!-- END GENERATED rule-header -->

## Violation

A statement that takes a value through a relative specifier naming a re-export module: one ending in a separator, one whose last segment is `.` or `..`, and one whose file stem is `index`. Static imports, dynamic imports and re-exports are all read, and a statement carrying types alone is left alone because nothing is taken at run time.

This rule is not in the shipped preset. A consumer names it in `rules` to turn it on.

## Fix

Name the module that declares the binding the statement takes.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// naming a re-export module by its file is reported
import { total } from './totals/index.ts';
```

```ts
// importing for the side effect alone still runs the whole re-export module
import './totals/index.ts';
```

Code this rule accepts.

```ts
// naming the module that declares the binding is the shape this rule asks for
import { total } from './total.ts';
```

```ts
// taking types alone leaves nothing behind once the build is done
import type { Total } from './totals/index.ts';
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the re-export module to something other than `index`. What is left is a module that still forwards another module's declarations
- Reaching the same binding through a package subpath that resolves to the re-export module

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `barrelImport` | A module specifier that names a re-export module is forbidden. Name the module that declares the binding this statement takes. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
