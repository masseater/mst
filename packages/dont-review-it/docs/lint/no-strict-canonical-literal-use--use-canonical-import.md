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

A literal in a production source spelling a value that a declared vocabulary already owns. The catalog of owners is built from the `@canonical-values` declarations across the repository, and the report names the concepts that own the value.

Verification files and anything outside the production scope are not read.

## Fix

Import the binding the owner publishes and use that in place of the literal.

Where the value belongs to a concept nobody owns yet, register the vocabulary in the module that owns it.

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

- Assembling the literal from parts so it no longer matches. The use site still carries its own spelling
- Declaring a local constant holding the same literal. The spelling is still decided here

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
