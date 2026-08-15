---
description: "Require every package that more than one workspace declares to be registered in the catalog, so the version they resolve to is decided in one place instead of workspace by workspace"
---

# require-catalog-entry--register-shared-dependency

<!-- BEGIN GENERATED rule-header -->

Require every package that more than one workspace declares to be registered in the catalog, so the version they resolve to is decided in one place instead of workspace by workspace

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `workspace`
- Source: [`require-catalog-entry--register-shared-dependency.ts`](../../src/lint/oxlint/rules/workspace/require-catalog-entry--register-shared-dependency.ts)

<!-- END GENERATED rule-header -->

## Violation

A package more than one workspace declares while the catalog does not register it. The report lists the workspaces that declare it.

## Fix

Decide which version all of them take, register the package in the catalog at that version, and replace every declared value with the catalog reference.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a name shared with two other workspaces is reported in the root workspace
export const shipped = true;

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Writing the same version into each manifest by hand. The next change has to find every copy
- Dropping the dependency from one workspace and reaching it through another's node_modules

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unregisteredSharedDependency` | A package that more than one workspace declares must not stay outside the catalog. \`{{packageName}}\` is declared by {{sites}}. Decide which version all of them take, register \`{{packageName}}\` in the catalog at that version, then replace every declared value with the catalog reference. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
