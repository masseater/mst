---
description: "Disallow defining a finite value set inside a file that does not own it, so one place declares the vocabulary and every other place derives from it"
---

# no-local-finite-value-set--use-or-register-canonical-values

<!-- BEGIN GENERATED rule-header -->

Disallow defining a finite value set inside a file that does not own it, so one place declares the vocabulary and every other place derives from it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-local-finite-value-set--use-or-register-canonical-values.ts`](../../src/lint/oxlint/rules/no-local-finite-value-set--use-or-register-canonical-values.ts)

<!-- END GENERATED rule-header -->

## Violation

Syntax in a production source that defines a finite vocabulary of strings, numbers, booleans and `null`. Six shapes are read.

- A static scalar array handed to a call whose member is `enum` or `picklist`
- A type alias that is a union of scalar literals
- A static array of `literal` calls handed to a call whose member is `union`
- A static scalar array at a non-computed `enum` property of a JSON Schema
- A `Set` initializer, and a `typeof ARRAY[number]`, reported only where the values match a catalog owner
- A `keyof` over a named import or an `import()` type, and an `Object.keys` handed to a schema call, reported where the import route is not one the catalog registered

Fewer than two distinct values, and a set of booleans alone, are not vocabularies. The report names the owner to derive from, the candidates where several match, or the fact that no owner exists.

An owner is registered with a `@canonical-values` JSDoc directly above a single exported binding; the value range comes from the type the checker resolved for it. Only the annotated declaration itself is exempt.

## Fix

Delete the local values and derive the schema, the type and the membership check from the owner's binding, imported through a registered route.

Where no owner exists, register the runtime values in the module that owns the concept. Where a dependency already owns the vocabulary, derive from its published type.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a finite vocabulary written into a schema call defines it here
export const schema = z.enum(["draft", "published"]);
```

```ts
// a literal union type defines the same vocabulary over again
export type Status = "draft" | "published";
```

Code this rule accepts.

```ts
// a union that also admits any string names no finite vocabulary
export type Loose = string | "draft";
```

```ts
// a spec file is not a production source
// in /repo/src/status.test.ts
export type Status = "draft" | "published";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Declaring a binding of the owner's name locally, or reaching it through an unregistered subpath. The route is checked, not the spelling
- Moving the values into a file Git ignores so the scan cannot see it

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `localFiniteValueSetWithOwner` | Defining a finite value set inside a file that does not own it is forbidden. Delete the local values and derive the schema, type, or membership check from {{owner}}. Ownership policy: {{ownershipPolicy}}. |
| `localFiniteValueSetWithOwnerCandidates` | Defining a finite value set inside a file that does not own it is forbidden. Delete the local values and derive them from the matching owner among {{owners}}. Ownership policy: {{ownershipPolicy}}. |
| `localFiniteValueSetWithoutOwner` | Defining a finite value set without an owner is forbidden. Register the runtime values in the module that owns the concept. Ownership policy: {{ownershipPolicy}}. |
| `localFiniteValueSetOwnedByLibraryType` | Defining a finite value set that a dependency already owns is forbidden. Delete the local values and derive the type from {{owner}}. Ownership policy: {{ownershipPolicy}}. |
| `localFiniteValueSetOwnedByLibraryTypeCandidates` | Defining a finite value set that dependencies already own is forbidden. Delete the local values and derive the type from the matching owner among {{owners}}. Ownership policy: {{ownershipPolicy}}. |
| `unregisteredCanonicalValuesImportRoute` | Feeding a finite value set from an unregistered repository route is forbidden. \`{{name}}\` from \`{{specifier}}\` has neither a registered public export path nor an annotated declaration. Register the owner and import its registered binding. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
