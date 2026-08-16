---
description: "Disallow every export whose outward name is `default`, so a symbol keeps the name it was defined under all the way to the places that call it"
---

# no-default-export--use-named-export

<!-- BEGIN GENERATED rule-header -->

Disallow every export whose outward name is `default`, so a symbol keeps the name it was defined under all the way to the places that call it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `writing`
- Source: [`no-default-export--use-named-export.ts`](../../src/lint/oxlint/rules/writing/no-default-export--use-named-export.ts)

<!-- END GENERATED rule-header -->

## Violation

Any export whose outward name comes out as `default`, in four shapes: a direct `export default`, a specifier aliased to `default` (with or without a `from`, spelled as an identifier or as a string), a namespace re-export bound to `default`, and a TypeScript `export =`. `export * from "..."` forwards no `default` and is left alone.

`toolRequiredFileNames` lists the exact base names a tool requires a default export from. In such a file only the direct `export default` passes; the other three shapes are still reported.

## Fix

Give the value a name and export the name.

```ts
export const parseUser = (input: string): User => parse(input);
```

Turn `export = total` into `export { total }`, and give a namespace re-export a name of its own.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a default exported anonymous expression is reported
export default () => 1;
```

```ts
// renaming a local binding to default on the way out is reported
const total = 1;
export { total as default };
```

Code this rule accepts.

```ts
// a named export keeps the defined name at the module boundary
export const total = 1 + 2;
```

```ts
// giving an outward name to another module's default is the way across the boundary
export { default as total } from 'external-package';
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming a file to earn the `toolRequiredFileNames` exemption. The exemption rests on a tool reading that file as an entry
- Writing one named export and a default export beside it. Callers can still choose either
- Growing a default-equivalent property through CommonJS. It never passes through an export declaration, and the importing side still names it whatever it likes

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `defaultExport` | A module must not put a value out under the name \`default\`. Name the value and export the name: \`export const parseConfig = ...\` or \`export function parseConfig() {}\`. |
| `defaultAliasReExport` | A re-export must not rename what it forwards to \`default\`. Forward the name the owning module already gave it: \`export { parseConfig } from "./parse-config.ts"\`. |
| `namespaceDefaultReExport` | A namespace re-export must not be bound to the name \`default\`. Give the namespace a name here: \`export \* as parseConfig from "./parse-config.ts"\`. |
| `exportAssignment` | An export assignment must not stand in for a named export. Export the value under the name it was declared with: \`export { parseConfig }\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
