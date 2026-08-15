---
description: "Disallow every dependency version that matches more than one release, in workspace manifests and in the catalog alike, so the release a workspace installs is decided by the declaration instead of by the moment the install ran"
---

# no-version-range--pin-the-exact-version

<!-- BEGIN GENERATED rule-header -->

Disallow every dependency version that matches more than one release, in workspace manifests and in the catalog alike, so the release a workspace installs is decided by the declaration instead of by the moment the install ran

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-version-range--pin-the-exact-version.ts`](../../src/lint/oxlint/rules/no-version-range--pin-the-exact-version.ts)

<!-- END GENERATED rule-header -->

## Violation

A dependency version that matches more than one release, reported separately for a workspace manifest and for the catalog. Which release a workspace installs then depends on the moment the install ran rather than on the declaration.

`intentionalRanges` lists the package names a range is kept for.

## Fix

Write the single release this repository installs in place of the range, in the manifest and in the catalog alike.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// the root workspace carries both its own ranges and the ones the catalog registers
export const shipped = true;

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding the package to `intentionalRanges` to keep a range nobody decided on
- Pinning in the lockfile alone. The declaration still matches more than one release

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `rangedManifestVersion` | A dependency version that matches more than one release must not stand in a manifest. \`{{packageName}}\` is declared as \`{{declaredVersion}}\` in \`{{workspace}}\`. Write the single release this repository installs in place of the range. |
| `rangedCatalogVersion` | A catalog listed that matches more than one release is forbidden. \`{{packageName}}\` is registered as \`{{declaredVersion}}\`. Write the single release this repository installs in place of the range. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
