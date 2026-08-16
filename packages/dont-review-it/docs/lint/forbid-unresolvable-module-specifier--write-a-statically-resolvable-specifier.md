---
description: "Disallow a module specifier whose value is decided while the program runs, so every specifier in the source is one string the checks that read specifiers can match"
---

# forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier

<!-- BEGIN GENERATED rule-header -->

Disallow a module specifier whose value is decided while the program runs, so every specifier in the source is one string the checks that read specifiers can match

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `writing`
- Source: [`forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts`](../../src/lint/oxlint/rules/writing/forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier.ts)

<!-- END GENERATED rule-header -->

## Violation

A dynamic `import` or a `require` whose specifier is not one string the source settles. A string literal, a template literal with no substitution, and a `const` in the same file holding one of those all count as settled; anything else leaves the request unmatched against the modules this repository refuses.

`staticallyResolvedForms` names call shapes that resolve a specifier for themselves and are left alone. `exceptions` registers a position that keeps an unsettled specifier, and an entry with no grounds is reported at the head of the file.

## Fix

Write one literal specifier in each branch, or import every implementation and pick one by name from a table.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a specifier read from a binding is decided while the program runs
export const loaded = import(chosen);
```

```ts
// a specifier chosen by a condition is more than one string
export const loaded = import(wide ? "./wide.ts" : "./narrow.ts");
```

Code this rule accepts.

```ts
// a template filled from a constant of this file folds to one string
const STEM = "reader";
export const loaded = import(`./${STEM}.ts`);
```

```ts
// candidates written as a literal in each branch are each one string at rest
export const load = async (wide: boolean) =>
  wide ? await import("./wide.ts") : await import("./narrow.ts");
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Assembling the specifier in a `let` or from a call. Only a `const` holding a literal is followed
- Suppressing the report instead of registering the position. An exception belongs in the configuration with its grounds

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unresolvableModuleSpecifier` | A module specifier must not be an expression decided while the program runs. \`{{written}}\` leaves this request unchecked against the modules this repository refuses. Write one literal specifier in each branch, or import every implementation and pick one by name from a table. Register a specifier that has to stay this way in this rule's \`exceptions\` option with the grounds it stays, never in a suppression comment. |
| `groundlessSpecifierException` | A registered exception must not stand without grounds. \`{{path}}\` carries none. Write what decides the candidates outside this repository into that entry, or delete the entry and write specifiers the source spells out. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
