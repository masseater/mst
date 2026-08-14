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
- Shipped in the preset: yes
- Source: [`no-default-export--use-named-export.ts`](../../src/lint/oxlint/rules/no-default-export--use-named-export.ts)

<!-- END GENERATED rule-header -->

## Violation

Only one question is asked of an export declaration: does the outward name it produces come out as `default`? The judgment runs on that property rather than on a list of syntax, which splits the reports into three families.

1. A direct default export (`ExportDefaultDeclaration`). What follows — a function declaration, a class declaration, an object literal, an existing identifier, any expression at all — makes no difference, and neither does whether it is a value or a type
2. A re-export aliased to the name `default`. That covers `export { total as default }`, `export { total as default } from "..."`, `export { default } from "..."` and `export type { Total as default } from "..."`, with or without a `from` clause. Whether the outward name is written as an identifier or as a string literal (`export { total as "default" }`) makes no difference, because the result is the same `default`. Closing one and leaving the other would leave the other standing as the way around
3. A TypeScript export assignment (`export = total`). It matches a default export in leaving the published name up to whoever imports it, while still existing as a static export declaration node that can be detected

What a re-export is judged on is always the outward name, never the inner one.

The report covers the whole statement for families 1 and 3, and the specifier going out as `default` for family 2. When one statement carries several specifiers, only the one that comes out as `default` is reported.

The rule carries no exemption by file name of its own. Tools do require a default export from certain files, but the spelling of those files follows from which tools a deployment uses and what it named them. `vite.config.ts` exists only where Vite is used, and an oxlint JS plugin is whatever file the `jsPlugins` specifier points at — no tool asks for the name `plugin.ts`. Holding those names in the rule would ship one deployment's spellings to every deployment that does not share them.

A deployment names its exempt spellings through `toolRequiredFileNames`. In a named file only the direct default export (family 1) passes; families 2 and 3 are still reported there. What the tool requires is the single shape `export default`, not every route by which the name `default` reaches the outside.

The match is on the exact base name. `my-plugin.ts` and `plugin.entry.ts` are not `plugin.ts`, and `vite.config.js` is not `vite.config.ts`, so none of them is exempt. Directory position is not read, so a named spelling is exempt in every workspace alike.

`toolRequiredFileNames` is a list of strings and is the only option the rule takes:

```jsonc
["error", { "toolRequiredFileNames": ["plugin.ts", "vite.config.ts"] }]
```

It defaults to empty, so writing nothing leaves no exemption at all, and an unknown key is refused by the schema. Turning the rule off for a file pattern through `overrides` reaches the same result for that one file, but it stops the whole rule there; naming the file through the option keeps the other violations inside it (`export { total as default }` and the rest) reported.

### The invariant

A symbol keeps its name from where it is defined to where it is called.

A default export has no name. The name is chosen by whoever imports it, and they may choose whatever they like. The same function ends up called `parseUser` in one file, `parse` in another and `userParser` in a third, and nothing anywhere warns about it.

What that breaks first is searching. Someone who knows the definition greps for that name and misses every call site that renamed it. Someone reading a call site searches for the definition under the name in front of them and finds it written under another. Once names stop corresponding, working out the reach of a change becomes a matter of opening files one at a time.

Renaming breaks for the same reason. Under a named export, changing the name at the definition breaks the imports and forces them to follow. Under a default export, the definition can be renamed as often as you like while the imports carry on untouched under the old name, and nothing detects that the name and the thing have come apart.

Sometimes there is no name at all. An anonymous function expression or an object literal exported directly as default leaves the definition side with no name anywhere, and then there is no canonical name to search for in the first place.

### What is not a violation

- Named exports in general: attached to a declaration, grouped over bindings, or forwarded from another module under the name it already had
- `export * from "..."`. The ES module specification does not forward `default` through it, so no new `default` grows out of it
- A namespace re-export under any name but `default` (`export * as total from "..."`)
- Giving an outward name to another module's default (`export { default as total } from "external"`). The outward name is not `default`, so it is not a violation. This is the one bridge by which an external package that publishes only a default can be handled under this discipline
- Anything on the importing side. This rule reads the exporting side alone

Where the machine reaches and where the discipline reaches are not the same. Detection is the floor under the invariant, not the ceiling.

## Fix

Give the value a name and export that name.

```ts
export const parseUser = (input: string): User => JSON.parse(input) as User;
```

Receive it under the same name:

```ts
import { parseUser } from "./parse-user.ts";
```

Where a name is already there, as in `export default function foo() {}`, dropping `default` for `export function foo() {}` is the whole fix. Where an anonymous value was being exported, the first step is deciding on a name. A value you cannot name is usually a sign that the unit being carved out is the wrong one.

Forward re-exports under the original name rather than renaming them to `default`. `export * as default from "..."` has no original name to forward, so give the namespace one (`export * as parseUser from "..."`).

Turn `export = total` into `export { total }`.

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
export { default as total } from "external-package";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Growing a default-equivalent property through CommonJS. It never passes through an ES module export declaration, so it does not appear to this rule, while the emitted shape is a default in every respect and the importing side still names it whatever it likes. Not being detected is not a reason to adopt it
- Assembling the export name at runtime, or any other indirection whose only purpose is to avoid a static match
- Renaming a file to `plugin.ts` or `vite.config.ts` to earn the exemption. Putting that name on a file no tool reads as an entry breaks the premise the exemption stands on
- Writing one named export and placing a default export beside it. Callers can still choose either, so nothing guarantees the name is kept
- A suppression directive. The only sanctioned routes to an exception are the rule's own default and the `toolRequiredFileNames` that replaces it

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
