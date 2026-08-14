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

A declared value that does not settle on one release, read from every manifest in the repository and from the catalog of the workspace definition.

There are two reports. A manifest's declaration is reported against the workspace declaring it. A catalog entry is reported against the repository's root workspace, because that is where the file to fix lives and a catalog declaration belongs to no workspace in particular. The report stands on a checked file that workspace holds: neither manifests nor the workspace definition ride the checking route, so the report goes to the files they govern.

### How values are read

The three sections read are the regular, development and optional dependencies, along with every entry of the default catalog and of the named catalogs.

Where a value takes the alias form, it is reported under the name it resolves to and what follows `@` is read as the version. `npm:left-pad@^1.0.0` is treated as `^1.0.0` of `left-pad`.

A value settling on one release takes the shape `1.2.3`, optionally followed by pre-release identifiers and build metadata. `1.2.3-beta.1` and `1.2.3+build.5` both qualify.

### Shapes deliberately left out

| Shape | Why it is not a target |
| --- | --- |
| Peer dependency declarations | Taking a wide range is the correct design there, and they are not something to pin to one release |
| `workspace:`, `link:` and `file:` values | They point at no external release |
| A `catalog:` reference | A reference carrying no version; the catalog entry it points at is read directly |
| Distribution tags, repository URLs and values written as a host | They carry no version syntax, so which release to pin to is not settled from within the declaration |
| Names registered as intentional ranges | The registration itself is the record of the decision |
| A declaration whose value is not a string | It cannot happen in a valid manifest. Where it does, that is schema validation's territory |

Processes that rewrite the tree after installation, and hooks that intercept module resolution at run time, stand outside this detection: which release actually lands is settled only by running that process, and no value exists at the moment the declaration is read.

### The invariant

Which release lands is settled by reading the declaration.

A declaration written as a range holds several answers for one commit. What decides among them is the lockfile, not the declaration. As long as the lockfile is there the release is fixed, so being a range is invisible in everyday work.

The first layer is that a range does take effect outside the lockfile. Updating the lockfile, resolving from a dependency source that carries none, and an installation running with `--no-frozen-lockfile` all take the newest matching release published at that moment. The wider the declaration, the wider the span of releases that can land through those routes.

The second layer is that the widening itself is seen by nobody. A range declaration changes nothing at the moment of the commit. The difference appears later, when another environment pulls another release, and at that point both the declaration and the update history read as "unchanged". Tracing the cause back to the declaration means reconstructing when and through which route the resolution ran.

Leaving version bumps as rewrites of the declaration removes that reconstruction. Which release landed when is held by the history, and the declaration holds only the current answer.

### Configuration

This rule does not read a configuration file itself. Of the material the judgment needs, what amounts to policy comes from the configuration and what amounts to facts about the repository comes from the readers of the workspace list and the catalog.

`intentionalRanges` lists, by exact match, the names that may stay as ranges. It defaults to empty, and while empty every declaration is asked for a version. A registered name is reported neither in a manifest declaration nor as a catalog entry.

The workspace list, the contents of each manifest and the catalog entries are supplied by the readers handed in when the rule is created. Neither a manifest declaration nor a catalog registration can be read from one file alone, so that material lives outside the rule itself.

## Fix

Rewrite the declaration to the version of the release that is actually installed. The lockfile holds that version. After rewriting, run the installation and confirm that the declaration side of the lockfile lines up with the new value.

In this repository, versions written straight into a manifest live in each workspace's `package.json`, and shared versions live in the `catalog` of `pnpm-workspace.yaml`. Which of the two a version belongs in is settled by the dependency declaration check in `dont-review-it check`.

```json
{
  "dependencies": {
    "es-toolkit": "1.50.0"
  }
}
```

Where circumstances genuinely require a range, register that name as an intentional range and write alongside it why the range is needed and what would let it go.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// the root workspace carries both its own ranges and the ones the catalog registers
export const shipped = true;
```

```ts
// an alias carrying a range is reported under the package it resolves to
export const shipped = true;
```

Code this rule accepts.

```ts
// a workspace declaring references, an exact alias, a tag and a host passes
export const shipped = true;
```

```ts
// names registered as intentional ranges are not asked to be pinned
export const shipped = true;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Deleting the declaration and carrying on by resolving the package from a parent or sibling workspace. This rule has nothing to compare against for a dependency that is not declared. Deleting a declaration leaves the range behind; it does not settle a version
- Hiding the version behind an alias. It is read as the version of what it resolves to, so it does not escape
- Replacing it with a distribution tag. It stops being reported as a range while being even less settled. Tags are outside the detection because which release to pin to is not settled from within the declaration, not because they are permitted
- Silencing it with a suppression directive. `no-broad-lint-disable--use-next-line-with-reason` receives that
- Swapping the resolution after installation or at run time. This one shape cannot be given a detection condition. If the same detour keeps recurring, the answer is to forbid the existence of the file carrying that process

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
