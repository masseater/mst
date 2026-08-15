---
description: "Require a package to declare either the surface it is run through or the surface it is imported through, so which discipline owns the package is decided by its manifest instead of by whoever reaches into it next"
---

# no-mixed-package-surface--declare-one-surface

<!-- BEGIN GENERATED rule-header -->

Require a package to declare either the surface it is run through or the surface it is imported through, so which discipline owns the package is decided by its manifest instead of by whoever reaches into it next

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: no
- Source: [`no-mixed-package-surface--declare-one-surface.ts`](../../src/lint/oxlint/rules/no-mixed-package-surface--declare-one-surface.ts)

<!-- END GENERATED rule-header -->

## Violation

A package manifest declaring both the surface the package is run through and the surface it is imported through. Where the configuration registers a package as run-only, an import surface on it is reported; where it registers one as importable, a runnable entry on it is reported. A package listed as exempt is skipped.

This rule is not in the shipped preset. A consumer names it in `rules` to turn it on.

## Fix

Split the two surfaces into two packages: the runnable entry in the package that is only run, the import entries in the package that is only imported, and a dependency from the first on the second.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a manifest that declares a runnable entry and an import surface carries both
export const shipped = true;

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Registering the package as exempt to keep both surfaces. Which discipline owns the package is still undecided
- Moving one entry into a nested manifest inside the same package

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `mixedPackageSurface` | A package must not declare both the surface it is run through and the surface it is imported through. \`{{packageName}}\` declares a runnable entry at {{runnableFields}} and an import surface at {{importableFields}} in \`{{manifestPath}}\`. Split the two surfaces into two packages, keep the runnable entry in the package that is only run, keep the import entries in the package that is only imported, and declare a dependency from the first on the second. |
| `importSurfaceOnRunnablePackage` | A package registered as run-only must not declare an import surface. \`{{packageName}}\` is registered as a package that is only run, and \`{{manifestPath}}\` declares an import surface at {{importableFields}}. Move the shared implementation into a package that declares only import entries, declare a dependency on that package from here, and leave this manifest holding its runnable entry alone. |
| `runnableEntryOnImportablePackage` | A package registered as importable must not declare a runnable entry. \`{{packageName}}\` is registered as a package that is only imported, and \`{{manifestPath}}\` declares a runnable entry at {{runnableFields}}. Move that entry into a package that declares only a runnable entry, and declare a dependency from that package on this one. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
