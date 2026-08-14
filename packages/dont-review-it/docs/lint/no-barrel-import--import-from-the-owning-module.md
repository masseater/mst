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

A specifier naming a re-export-only module, in a statement that takes values from it. The report points at the specifier.

Four statements are read:

- `import ... from "..."`
- `export ... from "..."` and `export * from "..."`
- `import("...")`

A specifier is taken to name a re-export-only module when both hold:

- It is relative: `.` or `..` themselves, or something starting with `./` or `../`
- Its last segment, with the extension dropped, is spelled `index`; or the specifier ends at a directory (`.` or `..` themselves, or a trailing `/`)

Whether values are taken is settled by the same rules as in [no-barrel-module--declare-in-the-owning-module](no-barrel-module--declare-in-the-owning-module.md). `import type { ... } from "..."`, and a form where every specifier carries `type`, take no values. An import for side effects alone, binding no name, counts as taking values, because it runs the module.

### The invariant

The reasons are the same as in [no-barrel-module--declare-in-the-owning-module](no-barrel-module--declare-in-the-owning-module.md): resolving values through a forward keeps everything the barrel forwards to in the bundle, makes development-time resolution read all of it, and leaves the correspondence between a name and its owner unreadable.

The two are separate rules because the fixes differ. On the side that placed a forward-only file the fix is deleting the file; on the side that read it the fix is naming the declaring module. Enabling only one is a real choice: where your own repository keeps no surface while a package you depend on does, only the reading side can be stopped.

### Where detection does not reach

What a specifier points at is not read. A forward-only file under a name other than `index` is not reported when named, and a module carrying declarations under the name `index` is reported when named. The judgment rides the naming convention rather than the contents.

A relative specifier with no extension is not reported. `./models` could resolve to `models.ts` or to `models/index.ts`, and the syntax does not settle which.

External packages are not read. Whether such a package keeps a surface or not, the reader has no way to rearrange it.

A specifier assembled while the program runs is not read. That shape is reported separately by [forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier](forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.md).

### Configuration

None. The only material this rule judges on is the spelling of the specifier, and it carries no threshold and no vocabulary. Opening an exclusion would be the entry point for writing "this one forward may pass" into a setting. Holding a package's published entry out is a decision belonging to the side that places the surface, and [no-barrel-module--declare-in-the-owning-module](no-barrel-module--declare-in-the-owning-module.md) carries it as `exclude`.

### Why it is not shipped by default

The same reason as [no-barrel-module--declare-in-the-owning-module](no-barrel-module--declare-in-the-owning-module.md). This repository expresses its published surface as re-exports in `src/index.ts`, and forbidding reads through that surface contradicts keeping the surface at all. Naming it in `rules` is what turns it on.

## Fix

Rewrite the specifier to the module declaring the name. What the forward points at can be read by opening the re-export-only module being named.

Reading a published entry from outside the package spells the specifier as a package name, which is not relative and never enters this rule. A report therefore means something inside the same package is reading through its own surface. That shape has nothing to do with what a surface is for, so name the declaring module.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// naming a re-export module by its file is reported
import { total } from "./totals/index.ts";
```

```ts
// importing for the side effect alone still runs the whole re-export module
import "./totals/index.ts";
```

Code this rule accepts.

```ts
// naming the module that declares the binding is the shape this rule asks for
import { total } from "./total.ts";
```

```ts
// taking types alone leaves nothing behind once the build is done
import type { Total } from "./totals/index.ts";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Silencing it with a suppression directive and keeping the specifier
- Renaming the re-export-only module to something other than `index`. This rule reads the spelling of the specifier alone, so the report clears while values still resolve through a forward
- Dropping the extension and writing `./models`. Whether that resolves to a forward-only file is not read here
- Adding one more forward-only file and giving that one a name other than `index`

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
