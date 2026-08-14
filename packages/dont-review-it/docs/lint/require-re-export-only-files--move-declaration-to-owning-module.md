---
description: "Require the files the deployment lists as re-export only to carry re-exports and nothing else, so the surface a module presents can be read off that file without opening what it forwards"
---

# require-re-export-only-files--move-declaration-to-owning-module

<!-- BEGIN GENERATED rule-header -->

Require the files the deployment lists as re-export only to carry re-exports and nothing else, so the surface a module presents can be read off that file without opening what it forwards

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`require-re-export-only-files--move-declaration-to-owning-module.ts`](../../src/lint/oxlint/rules/require-re-export-only-files--move-declaration-to-owning-module.ts)

<!-- END GENERATED rule-header -->

## Violation

This rule is opt-in. It checks as a "re-export only file" nothing but the files written in the configuration's `targets`, and with none written it never fires. Which files are a surface is settled by the consumer; the rule does not know any file name of its own.

For a target file, two things are judged independently.

- Every statement directly under Program is an export statement carrying a module source
- At least one such statement is there

Only two things pass as a re-export.

- `export ... from "..."` (an `ExportNamedDeclaration` carrying a `source`). `export type { T } from "..."` and `export { default as X } from "..."` are included
- `export * from "..."` / `export * as ns from "..."` (an `ExportAllDeclaration`)

Everything else — a declaration, an import, an expression statement, an `export default`, a directive such as `"use client"` — is reported as a surplus statement. The judgment runs on "is this the shape of a re-export" alone, and the violating side is not enumerated.

There are two reports.

- `missingReExport`: not one re-export is there. It points at the whole file (the Program node)
- `extraStatement`: a statement that is no re-export is there. It points at that statement itself. Several in one file are reported one by one

The two are judged independently, so a file holding local declarations alone gets both. That is not a duplicate but a deliberate design treating "something surplus is here" and "what is needed is missing" as separate defects.

Written as the two statements `import { total } from "./total.ts";` and `export { total };`, both statements are reported as `extraStatement`. Two reports come out for one problem, and they are not gathered, because there are two statements to fix.

### Naming the targets

`targets` and `exclude` patterns are matched on the premise that the path reaching the lint may be absolute.

- A pattern beginning with `/`, `./` or `../` is resolved against the working directory and matched against the whole path
- Every other pattern is matched against the tail of the path, aligned at a segment boundary. `models/index.ts` does not match `data-models/index.ts`
- Because it is a tail match, a pattern written relative to the repository matches even where a tool's working directory or a dot-directory sits in the middle of the path
- `*` stands for any run of characters (the empty one included) inside one segment. It does not span `/`
- `**` carries meaning only when written as a whole segment, and stands for zero or more segments
- There is no brace expansion, no negated pattern and no character class. Case is distinguished
- `exclude` is evaluated by the same matching rules as `targets`

```jsonc
["error", { "targets": ["**/index.ts"], "exclude": ["**/generated/index.ts"] }]
```

Turned on without `targets`, the schema refuses it through `required` and `minItems: 1`. Handed in through a route that does not enforce the schema, nothing is checked — an empty array is not distinguished from a pattern matching no file.

### The invariant

A re-export only file is placed to fix, uniquely, the surface a module puts outside itself. Mix a value declaration in and that surface breaks at three points.

- The reader can no longer assume "this file is the surface itself and holds no implementation". Learning the surface now needs reading the contents, and the file's function as a surface is gone
- Tree shaking and renaming behave differently between a surface-only file and a file holding implementation. The premise that "passing through it is passing straight through" stops holding
- Allow top-level statements and side effects — a side-effect import, an initialisation — slip in behind the surface. A state where importing the surface alone runs a side effect is invisible from the importing side

Not allowing imports, and exports carrying no `source`, follows from the same reason. `export { total } from "./total.ts";` says in one statement both the name being published and the module that owns it. Split into two and reading what the public surface puts out means going back to another statement and tying them together again. That re-tying tells more the more names are exported.

Being a surface can be written as a convention, but then only human attention holds it. Guaranteeing by machine that "this file is the surface itself and there is nothing else" is what this rule is for.

### Configuration

It takes the naming of targets and nothing else.

- `targets` (required, one or more globs): selects the files treated as re-export only
- `exclude` (optional, globs): selects files matching `targets` that are taken out of the check. For writing a broad target and cutting exceptions out of it

There is no other escape (a switch permitting declarations conditionally, say). "The consumer settles the definition of a surface" is the point of the opt-in design, so the keys are held to these two and the schema refuses an unknown key.

## Fix

There are two repairs, and which one applies is settled by whether that file really is a surface.

Where it is a surface, move the declaration to the neighbouring module that ought to own that value, and re-export it from the surface with `export ... from`. Name the file it moves to after the name of that declaration. The two statements of an import and a source-less export are gathered into the one statement `export ... from "..."`. An import for a side effect moves to the module that needs that side effect.

Where it is no surface — where holding values is the correct thing — it is no re-export only file. Take that file out of `targets`. Since the rule is opt-in, fixing a naming that wrongly took the file in is the coherent move.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an exported declaration on a listed file is reported
// in src/index.ts
export const total = 1;
export * from "./sum.ts";
```

```ts
// an import paired with a source-less export is reported on both statements
// in src/index.ts
import { total } from "./total.ts";
export { total };
export * from "./sum.ts";
```

Code this rule accepts.

```ts
// a named re-export names the module that owns the declaration
// in src/index.ts
export { total } from "./total.ts";
```

```ts
// several re-exports stand together in any order
// in src/index.ts
export * from "./sum.ts";
export { total } from "./total.ts";
export type { Total } from "./total.ts";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Silencing it with a suppression directive and leaving the declaration where it is. That breaks the surface itself. Pairing it with the rule that forces grounds to be written does not justify it either: the "grounds" that could be written are nothing but a denial of this rule's purpose, and do not amount to legitimate suppression
- Renaming the file so it falls out of `targets`. Its role as a public surface is unchanged while the one clue that it is a surface is lost
- Cutting the declaration out into another file used only by the surface. The file name does not name the owner, so the same thing happens as when it stood on the surface
- Leaving the declaration on the surface as an `export default`. That is no re-export shape, so it is reported

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `extraStatement` | A file the deployment lists as re-export only must not carry a statement that is not a re-export. Move what this statement brings in or declares into the module that should own it, and re-export it from here with \`export { ... } from "..."\`, \`export \* from "..."\` or \`export \* as Name from "..."\`. |
| `missingReExport` | A file the deployment lists as re-export only must not carry zero re-exports. Re-export from here what the modules beside this file own, with \`export { ... } from "..."\`, \`export \* from "..."\` or \`export \* as Name from "..."\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
