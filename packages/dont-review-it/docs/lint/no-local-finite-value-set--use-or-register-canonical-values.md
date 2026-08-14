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

Syntax in a production TypeScript source that newly defines a finite vocabulary made of strings, numbers, booleans and `null`.

- A static scalar array handed to a call whose member name is `enum` or `picklist`
- A type alias that is a union of scalar literals
- A static array of scalar `literal` calls handed to a call whose member name is `union`
- A static scalar array handed to a non-computed `enum` property of a JSON Schema
- A static `Set` initializer matching a catalog fingerprint
- A `typeof ARRAY[number]` matching a catalog fingerprint
- A `keyof` referencing a named import or an `import()` type
- An `Object.keys` over a static object or a named import, handed to a schema call

A schema array covers both an array written inline and one placed in a module-scope identifier binding in the same file. `Object.keys` covers a module-scope object binding in the same file and a named import. Type assertions, `satisfies`, non-null assertions and parentheses are peeled before the value is read. A set of fewer than two values, and a set of `true` / `false` alone, are not vocabularies.

`Set` and indexed access also appear in ordinary local sets, so they are reported only where they match a catalog fingerprint. A schema, a literal union and a JSON Schema are themselves syntax defining a finite vocabulary, so they are reported even where no catalog owner exists yet.

There is no automatic fix. The same spelling can belong to a different concept, and which owner to derive from cannot be settled from the values alone.

### The order of analysis

The rule analyses the whole source once before returning its visitor.

1. Index module-scope static array and object bindings and named imports from the Oxc AST
2. Enumerate the target syntax across the whole source
3. Settle the diagnostics by matching local value ranges, catalog fingerprints and import routes
4. Leave the `Program` visitor doing nothing but reporting finished diagnostics

Binding state is never rewritten in the order the visitor arrives. Callback execution, standard API return values, collection mutation and general alias chains are not evaluated. Widening the targets means adding an explicit syntax contract and durable tests, not building a JavaScript runtime inside the lint.

### Confirming the import route

Where the target syntax receives a named import's binding, that import has to resolve to a public route the catalog registered, or to the owner declaration itself.

A public route holds all of this identity.

- The package specifier
- The exported name
- The runtime source path the package's `exports` resolved to

The consuming side resolves the real source through TypeScript module resolution too. The same specifier under a different export name, a different source, an unregistered subpath, or an alias where `paths` points at a shadow source is unregistered. A relative import must match the real path and the imported name exactly against the owner's declaration path and binding.

An ambient or local binding of the same name as a catalog owner is not taken as the owner on spelling alone. Hand a same-named binding with no runtime source identity to a target sink and it is reported as an unregistered route.

An external package is not a repository route and is outside this route check.

### Registering an owner

A `@canonical-values` owner must satisfy all of this.

- It is a module-scope JSDoc in a production TypeScript source
- Exactly one canonical tag stands in the JSDoc
- A single variable statement follows the JSDoc with nothing but whitespace between
- The variable statement carries a single identifier binding and a runtime initializer
- The concept id is lowercase alphanumeric words joined by `-` or `.`

A line comment, an ordinary block comment, a nested annotation, an intervening token, an ambient declaration, a multi-binding, a destructuring, a type alias, an enum, a function, a class, an import, a re-export and a control statement are none of them owners.

Owner candidates are gathered per nearest TypeScript configuration, and one `typescript-6` Program is built per configuration. The value range is derived from the type the checker resolved for that binding.

- An array's range is the literal union of its numeric index type
- An object's range is its closed property names, provided it carries no index signature
- Strings, numbers, booleans, `null` and negative numbers are handled
- Imports and spreads the checker can resolve are handled
- Empty, widened, scalar and non-literal domains, and directly written duplicate values, become problems

A duplicate concept removes every colliding declaration from the catalog. Strict verification uses no cache and fails where there is even one invalid, duplicate, out-of-scope, or range-derivation failure.

### The lint exemption

The exemption is created not by the annotation existing but only where the catalog entry and the current source's declaration identity match.

- The declaration path from the repository root
- The concept id and the binding
- The annotation start, the binding start, the declaration start and the declaration end

Only the canonical domain inside a matched owner declaration is exempt. Outside the declaration in the same file, another path, another binding, a stale cached range, and declarations that are invalid, duplicated, out of scope or failed to derive a range carry no exemption.

### Git ignore and the production scope

Files whose name carries `.fixture.`, `.mock.`, `.test.`, `.spec.`, `.stories.` or `.story.`, and anything under `__fixtures__`, `__mocks__`, `__stories__`, `__tests__`, `.cache`, `.local-agents`, `coverage`, `dist`, `dist-ssr`, `fixtures`, `test` or `tests`, are not production sources.

The repository scan and the import-route judgment follow the same source scope, built before the lint starts from `git ls-files --others --ignored --exclude-standard --directory`. Untracked files, directories and symlink ancestors that Git excludes are taken into neither the catalog input nor the repository routes. A file already tracked stays a repository source even where it later matches an ignore pattern. The source scope and the catalog are immutable for the life of the lint process, and no visitor or import-route lookup re-runs Git or re-scans the repository.

### The invariant

Where the same finite set is written independently in several places, changing only the owner fails neither the type check nor the tests. Derive the schema, the type and the membership check from one runtime binding and the supply of a vocabulary change is fixed to one place.

The value range of an owner candidate is left entirely to the TypeScript checker. Evaluate imports, spreads and public aliases from the Oxc AST independently and the meaning diverges from TypeScript's, opening another way out between the catalog and its consumers.

### Configuration

`ownershipPolicy` is taken as a string. It only rides along in the report message to state how ownership is assigned, and does not change what is detected.

## Fix

Where the report names an owner, delete the local finite set, import the owner binding from its registered public route, and derive the schema, the type and the membership check from it.

Where no owner is named, register the runtime values in the production module that owns that concept and reference them from the consumer. Where a dependency package owns the vocabulary, derive from its published type or runtime API.

For an unregistered route, either register the referenced declaration properly as an owner, or repoint the import to a public route that is already registered.

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

- Adding a per-vocabulary opt-out, a per-workspace exclusion, or an exclusion tag on the owner side
- Suppressing the canonical rules with `eslint-disable` or `oxlint-disable`
- Placing an ambient binding of the owner's name to pose as a registered route
- Moving the values into a Git-ignored untracked file to have it treated as a repository owner

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
