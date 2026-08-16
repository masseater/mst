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
- Bundle: `writing`
- Source: [`require-re-export-only-files--move-declaration-to-owning-module.ts`](../../src/lint/oxlint/rules/writing/require-re-export-only-files--move-declaration-to-owning-module.ts)

<!-- END GENERATED rule-header -->

## Violation

A file matching `targets` that carries a statement other than a re-export, or that carries no re-export at all. `exclude` takes paths back out of the target set.

## Fix

Move what the extra statement brings in or declares into the module that should own it, and re-export it from here with `export { ... } from "..."`, `export * from "..."` or `export * as Name from "..."`.

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

- Adding the path to `exclude` so a surface file may declare things of its own
- Leaving the file empty. A surface with no re-export presents nothing

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
