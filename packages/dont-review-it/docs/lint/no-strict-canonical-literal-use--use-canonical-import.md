---
description: "Disallow writing a value that a declared vocabulary already owns as a literal, so every use site derives its spelling from the one place that declares it"
---

# no-strict-canonical-literal-use--use-canonical-import

<!-- BEGIN GENERATED rule-header -->

Disallow writing a value that a declared vocabulary already owns as a literal, so every use site derives its spelling from the one place that declares it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-strict-canonical-literal-use--use-canonical-import.ts`](../../src/lint/oxlint/rules/no-strict-canonical-literal-use--use-canonical-import.ts)

<!-- END GENERATED rule-header -->

## Violation

A literal in a production source whose value belongs to the vocabulary of the canonical catalog.

These count as literals:

- String, number, boolean and `null` literals
- Template literals carrying no substitution
- Numeric literals carrying a unary `+` or `-`
- The same nodes standing as literal types

Where one value belongs to several concepts, all the candidates are named in one report. An owner with no public route is shown by its declaration path. No automatic fix is offered.

Before returning its visitor, the rule analyses the whole Oxc AST once and turns the canonical value candidates and their ancestors into an immutable list of diagnostics. The `Program` visitor only reports the finished diagnostics and never updates state as the traversal proceeds.

This rule does not evaluate general JavaScript expressions. It carries nothing for deriving a new value out of string concatenation, the return of a standard API, a callback, a mutation of a collection or an aliased binding. It forbids a literal spelling a catalog value at the site of use, and the syntax that defines a new vocabulary is carried by [no-local-finite-value-set--use-or-register-canonical-values](./no-local-finite-value-set--use-or-register-canonical-values.md).

### The exemption for an owner declaration

Canonical values inside a `@canonical-values` owner declaration are where the concept is defined and are not reported. The annotation merely existing does not grant the exemption.

The current source is re-scanned and the following are matched exactly against the catalog entry:

- The declaration path from the repository root
- The concept id and the binding
- The annotation start, the binding start, the declaration start and the declaration end

Inside a declaration range that matched, only literals belonging to that entry's canonical domain are exempt. Outside the declaration in the same file, another path, another binding, a stale cached range, and declarations that are invalid, duplicated, out of scope or failed to derive their domain all carry no exemption.

An owner's domain is settled by the checker of the `typescript-6` Program built in advance per nearest TypeScript configuration. An array's domain is the literal union of its numeric index type; an object's is its property names, provided it carries no index signature. Imports and spreads the checker can resolve are handled, and empty, widened, scalar, non-literal domains and direct duplicates produce no entry.

### Syntactic positions out of reach

These literals are not sites where a canonical value is used:

- Module specifiers in imports, exports, dynamic imports, `import type`, import attributes and ambient modules
- Import and export names spelled as strings
- Non-computed property keys in object literals, type literals, classes, interfaces and enums
- The second type argument of the standard `Pick<T, K>` and `Omit<T, K>`, where they are not shadowed

The keys of `Record<"draft" | "published", V>` are a target, because they describe a new set rather than selecting from an existing structure.

### The production scope and git's ignore

Files whose name carries `.fixture.`, `.mock.`, `.test.`, `.spec.`, `.stories.` or `.story.`, and anything under `__fixtures__`, `__mocks__`, `__stories__`, `__tests__`, `.cache`, `.local-agents`, `coverage`, `dist`, `dist-ssr`, `fixtures`, `test` or `tests`, are not production sources.

Before the lint starts, the source scope is built once from `git ls-files --others --ignored --exclude-standard --directory`. Untracked files, directories and symlink ancestors that git excludes are not taken into the repository sources. A tracked file stays a repository source even if it later matches an ignore pattern, so it remains subject to the production scope judgment. The source scope and the catalog are immutable for the life of the lint process, and no visitor re-runs git or re-scans the repository.

### The invariant

Even with an owner in place, a consumer that can rewrite the same value as a literal means a change to the owner does not reach the consumer. Not only schemas and types but the literals in comparisons, switches, arguments and return values have to derive from the same runtime binding.

This rule takes the literals at the sites of use, and the declaration-side rule takes the explicit syntax that builds a finite set. Enabling both forbids the local set and the individual raw literal alike.

### Configuration

`ownershipPolicy` is taken as a string. It only rides along in the report message to state how ownership is assigned, and does not change what is detected.

## Fix

Import the binding from the registered public route of the owner named in the report, and use that binding — or a type, a schema or a membership check derived from it.

Where the reported value is a different concept from the existing owner, register a separate owner in the production module that owns that concept. Do not tie it to an existing concept on the grounds of the spelling alone.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a catalog value spelled at the site of use is reported
const value = "draft";
```

```ts
// keys that describe a new set are each reported
type StatusMap = Record<"draft" | "published", boolean>;
```

Code this rule accepts.

```ts
// a value the catalog does not carry is spelled where it is used
const value = "unlisted";
```

```ts
// selecting from an existing structure is not describing a new set
type Draft = Pick<Model, "draft">;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Suppressing the canonical rules with `eslint-disable` or `oxlint-disable`
- Moving the literal into another declaration in the same file as the owner
- Placing an invalid annotation or an ambient binding of the same name to manufacture an exemption
- Moving the literal into an untracked file that git ignores, so it stops being treated as a repository source

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `canonicalValueLiteral` | Writing a value that a declared vocabulary already owns as a literal is forbidden. Replace {{value}} with the binding its owner publishes: {{concepts}}. Ownership policy: {{ownershipPolicy}}. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
