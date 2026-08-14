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
- Shipped in the preset: yes
- Source: [`require-catalog-entry--register-shared-dependency.ts`](../../src/lint/oxlint/rules/require-catalog-entry--register-shared-dependency.ts)

<!-- END GENERATED rule-header -->

## Violation

Every manifest in the repository is reconciled, and a name meeting all of these is reported.

- It appears among the regular, development or optional dependencies
- It appears in two or more different workspaces
- It points at an external package
- It is not registered in the catalog

The report comes out in each workspace declaring that name. Gather it in one place and the receiver is left room to read it as "not about my workspace". The report stands on a file that workspace holds and that the check opens: a manifest itself is not on the checking route, so the report goes to the files that manifest governs.

### How names are counted

The unit counted is the package name a declaration resolves to, not the key of the declaration. Where the value takes the shape of an alias resolution, the resolved name written inside the value does the counting. Declare the same package under an alias in one place only and it looks like two names; counted this way it gathers into one.

Where one workspace declares the same name in several sections, that workspace counts as one. The version carried into the report is the first found, in the order regular, development, optional.

The threshold for asking for registration is fixed at two. Allow the configuration to raise it to three and a split across two workspaces becomes justified by configuration.

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| A peer dependency declaration | Taking a wide range is the correct design there, and it is no subject for pinning to a single version |
| A name only one workspace uses | There is nothing for it to split from |
| A `workspace:`, `link:` or `file:` value | It holds no external version |
| A name already registered in the catalog | From there on, the shape of the reference is read by [require-catalog-protocol--use-catalog-literal](./require-catalog-protocol--use-catalog-literal.md) |
| A workspace-and-name pair registered as a deviation | The fact of the registration is itself the record of the judgment |
| A declaration whose value is not a string | It does not happen in a valid manifest. Where it does, that is the schema validation's ground |

Processing that rewrites the tree after installation, a run-time hook cutting into module resolution, and code swapping the real thing in at build time all sit outside this detection. Which packages are actually shared is settled only as the result of running that processing, and at the moment the declarations are read the value does not exist. It is not the kind of miss a cleverer condition would catch.

### The invariant

What is held is that the name of an external package two or more workspaces depend on is registered in the catalog. What is held here is that the catalog's own range of cover has no gaps; whether each workspace looks at the catalog is held by [require-catalog-protocol--use-catalog-literal](./require-catalog-protocol--use-catalog-literal.md).

The rule enforcing catalog references works only on names the catalog holds. Its ground is settled by the contents of a configuration file.

The first layer is that registering is at the discretion of whoever adds the dependency. Starting to use a new package in a second workspace takes fewer steps without registering it, and the shorter route is the one taken.

The second layer is that a name left unregistered never enters the population of the rule enforcing references. What happens is not "a violation is missed" but "the range of what defends shrinks". And the shrinking itself meets nobody's eye, because an omission — not having written a line of configuration — leaves no trace anywhere in the code.

Leave in place a structure whose range is proportional to the thickness of a configuration file and centralisation stays a thing that "works as far as it was registered". This rule settles that range by machine instead.

### Configuration

This rule reads no configuration file of its own. Of the material the judgment needs, what amounts to policy comes from the configuration, and what amounts to a fact about the repository comes from the reader of the workspace list.

`catalog` is the list of registered names. Empty, or not handed over at all, and nothing is reported. With no configuration it guesses nothing.

`deviations` lists, per workspace relative directory, the names registration is not asked for, matched exactly. The default is empty. A deviation clears the report for that workspace alone. Other workspaces declaring the same name are still asked to register it.

The workspace list and the contents of each manifest are supplied by the reader handed in when the rule is built. Looking at one file alone cannot settle "two or more workspaces use it", so that material sits outside the rule body.

## Fix

Register the name in the catalog and replace each workspace's value with a catalog reference literal. There is an order to it. Before registering, look at which version each workspace currently points at and settle what to level to. Register while they are uneven and one workspace's resolved version changes silently. The report lays out each workspace's current version so that this decision can be made without opening another file.

In this repository the registry is the `catalog` key of `pnpm-workspace.yaml`, and the reference side writes `"catalog:"` alone.

```yaml
catalog:
  es-toolkit: ^1.50.0
```

```json
{
  "dependencies": {
    "es-toolkit": "catalog:"
  }
}
```

Where circumstances prevent levelling, register the workspace-and-name pair as a deviation, writing both why it is needed and what would have to happen for it to go.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a name shared with two other workspaces is reported in the root workspace
export const shipped = true;

```

<!-- END GENERATED examples -->

The subject of this rule is the repository's manifests rather than the source in front of you, so the code above is the file the report stands on, and what settles the judgment is which workspace holds it.

### Forbidden bypasses (do not do this)

- Deleting the dependency declaration from one workspace and going on using it, resolved from a parent or a sibling. Against an undeclared dependency neither rule holds anything to compare. Deleting the declaration is a move out of range, not a move away from sharing
- Declaring one side under an alias so the same package looks like two names. Counting by the resolved name does not come off
- Folding the sharing workspace away so it appears to be one workspace. How workspaces are divided is not settled by the convenience of dependency management
- Silencing it with a suppression directive. [no-broad-lint-disable--use-next-line-with-reason](./no-broad-lint-disable--use-next-line-with-reason.md) takes that
- Swapping resolution out after installation, at run time or at build time. That shape alone can carry no detection condition. Where the same bypass repeats, it falls to forbidding the existence of the file holding that processing

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
