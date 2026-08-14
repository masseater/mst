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

A file whose every statement directly under Program is an export carrying a module source, where at least one of them carries values. One report is raised for the whole file, on the Program node.

Two shapes count as re-exports:

- `export ... from "..."` (an `ExportNamedDeclaration` with a `source`)
- `export * from "..."` and `export * as ns from "..."` (an `ExportAllDeclaration`)

Whether values are carried is settled like this:

- `export * from "..."` carries values. `export type * from "..."` does not
- `export { ... } from "..."` carries values when even one specifier lacks `type`. `export type { ... } from "..."`, and a form where every specifier carries `type`, do not

A file forwarding types alone is therefore not reported, while one value among the forwarded names is enough to report it.

One declaration, import, expression statement, `export default` or directive is enough for the file to stop being made of re-exports alone, and it is not reported.

### The invariant

Three layers hold this up, and all three come from how values are resolved. That is why a file forwarding types alone is left alone.

**The first is that a bundler needs conditions met to see through a barrel.** Every module being forwarded to has to be free of side effects, be ESM, and declare `sideEffects`. Miss one and taking a single name from the barrel keeps everything it forwards to in the bundle. Class fields, decorators and enums can come out of transpilation as expressions with side effects, and without a `/*#__PURE__*/` on them the same thing happens. [vercel/next.js#12557](https://github.com/vercel/next.js/issues/12557) records an app reading about 100 components through a barrel where all of them landed in the shared chunk while only a few were used.

**The second is that tree shaking is an optimisation of the production build and nothing else.** The dev server, the test runner and the type checker all resolve the module graph exactly as written. Taking one name from a barrel means every module that barrel points at is parsed and initialised. Angular, in the change that dropped the linker's dependency on TypeScript, named imports through a barrel file as the cause and wrote that "[By removing the usage of this barrel file and restructuring the imports to be more granular, we can avoid unnecessary TypeScript imports](https://github.com/angular/angular/pull/61618)". What that change removed was 500ms to 1s of application compile time. What is at stake there is not the size of the production artefact but the time paid on every run during development.

**The third is that the correspondence between a name and its owner is lost.** From code reading `import { total } from "./models"`, the module declaring `total` cannot be read. Reading it means opening the barrel and following the forward, and that step deepens as names multiply and forwards nest.

Circular references become likelier under this structure, but the invariant that watches for cycles is not this rule's to hold. [`import/no-cycle`](https://oxc.rs/docs/guide/usage/linter/rules/import/no-cycle) holds it, and settling it takes the whole module graph. This rule reads the syntax of one file.

### Against `require-re-export-only-files`

This rule and [require-re-export-only-files--move-declaration-to-owning-module](require-re-export-only-files--move-declaration-to-owning-module.md) demand the opposite of each other about the same file. One says a file named as a target must hold re-exports alone; this one says do not keep a file made of re-exports alone.

Enabled together, a file named as a target can satisfy neither. Choosing between the two is a choice about how a published surface is expressed, and taking both is not among the options.

### Why the off-the-shelf rule was not taken

oxlint carries [`oxc/no-barrel-file`](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-barrel-file.html). It holds a different invariant.

That rule watches files carrying `export *` and reports only once the total number of modules forwarded passes a threshold, which defaults to 100. It does not report a named re-export `export { foo } from "./foo"`, and the official documentation presents that as the correct way to write one. [The proposal issue](https://github.com/oxc-project/oxc/issues/3004) starts from Biome's implementation watching `export *` alone and adds a count of dependencies taken from the module graph on top of it.

What `oxc/no-barrel-file` holds, then, is "do not keep a file that forwards a great many things by wildcard", not "do not keep a file that only forwards". None of the three layers above comes from how many forwards there are — they come from forwarding itself — so lowering the threshold does not arrive at the same invariant.

### Why it is not shipped by default

This repository expresses its published surface as re-exports in `src/index.ts`, and [EDR 0018](../../../../docs/engineering-decision-logs/0018-narrow-the-export-surface-to-what-is-used.md) enables knip's `includeEntryExports` to check that the names on that surface are actually used. Dropping the surface would remove what that check reads.

For the same reason this repository enables [require-re-export-only-files--move-declaration-to-owning-module](require-re-export-only-files--move-declaration-to-owning-module.md) over `**/index.ts`. As written above, the two do not stand together.

Which one to take therefore follows from the structure of whoever adopts it. A structure expressing a package's published surface as re-exports takes the former; one that keeps no surface and always names the declaring module takes this one. The shipped preset does not settle that choice, which is why this rule is not in it: naming it in `rules` is what turns it on.

### Configuration

The only option is `exclude` (optional, a glob), which picks the files held out of the check, for holding out a package's published entry. Matching follows the same rules as the `exclude` of [require-re-export-only-files--move-declaration-to-owning-module](require-re-export-only-files--move-declaration-to-owning-module.md).

There is no `targets`. This rule settles "a file made only of forwards" from its shape rather than "a file placed as a surface", so which files to read is not something the consumer has to decide.

### Where detection does not reach

A file carrying even one declaration is not reported. A file that is mostly forwards with a single declaration is no different from a barrel to whoever reads it, and it does not enter this rule.

Barrels published by external packages are not read. Whoever reads them has no way to rearrange that package's contents, and a report there would carry no fix that stands.

What the target of an `export ... from` actually declares is not read. The judgment closes over the syntax of one file.

## Fix

Remove the barrel and let the modules that were reading it name the module declaring the name directly.

Where the file exists because a surface has to stand in one place, that requirement belongs to a package's published entry alone. The way in from outside the package should be one door, and that door is held out through `exclude`. Inside the package, name the declaring module rather than going through the door.

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

- Silencing it with a suppression directive and keeping the forward-only file. The structure of the forwarding is unchanged, so all three layers stay exactly as they were
- Adding one meaningless statement beside the forwards so the file stops being made of forwards alone. The judgment reads the shape, so the report disappears — and that is all that disappears
- Dressing a value forward up as a type forward. A name carrying `export type` cannot be used as a value by whoever reads it
- Adding one more hop so there are two forward-only files instead of one. Both files are reported

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
