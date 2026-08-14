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

The manifest governing the file being checked — the first `package.json` found walking up from that file — is read, and the surfaces declared in it are counted. There are only two kinds of surface: the surface that is run (a runnable entry) and the surface that is imported (a public entry and a type entry).

Three reports.

- `mixedPackageSurface` — a package declaring no classification declares both surfaces
- `importSurfaceOnRunnablePackage` — a package registered as run-only declares an imported surface
- `runnableEntryOnImportablePackage` — a package registered as a library declares a runnable entry

The manifest itself is not among the static analyser's inputs, so the report stands on the source files that manifest governs. One report per file of that package. Gather them into one place and whoever receives it has room to read it as "not about my file".

### Declarations counted as a surface

| Manifest field | Surface counted |
| --- | --- |
| `bin` | The surface that is run |
| `exports` / `main` / `module` / `types` / `typings` | The surface that is imported |

`exports` is walked through its conditions and nesting, and counts as declared where even one string reaching a real file is found. Alternatives written as arrays are walked too. The walk is cut off where the nesting grows too deep, because this judgment shares that cap with the other manifest readers.

### Deliberately out of scope

| Shape | Why it is left out |
| --- | --- |
| Task definitions in `scripts` | A task is not a surface. It is a procedure somebody invokes, not a way in reachable from outside |
| An `exports` reaching only the manifest itself | What is published is the manifest, not the implementation. This is the normal shape for a run-only package |
| Internal files declared as no surface | Tests and internal type declarations are not ways in merely by sitting there |
| An empty or whitespace-only declaration | Written but naming nothing |
| Several runnable entries | What is read is that the kind of surface is one; the number of entries inside one surface is not read |
| A package registered as an exception with a reason | The fact of the registration is itself the record of the judgment |

Whether the contents of a surface are right (does it publish too much, does an internal implementation leak) and how coarsely to split packages both sit outside this rule.

### The invariant

One package declares one kind of surface.

What is observed is a package made for holding scripts that has, at some point, become a utility store other places import.

The first layer is that a package holding both surfaces has no settled discipline. Run-only means the contents can move without regard for the compatibility of a public surface. The moment it holds an imported surface, other packages' concerns enter and it stops moving. Conversely, adding a runnable entry to a library leaves that one execution route missing from the dependency declarations: what is run is imported by nobody, so it accumulates run-time requirements that never appear in a dependent's declaration.

The second layer is that forbidding a location alone only relocates the location. The discipline forbidding a script store directly under the repository says "move it into a package with an owner" without settling the shape of the destination. Where the destination holds both surfaces, the "anything goes here" spot under the repository root is reborn under another name. That rebirth cannot be observed from the side watching locations.

The third layer is that surface declarations are text in the manifest, so the mixture is statically visible. Visible and unchecked is precisely the gap between what the discipline claims and what the mechanism does.

### Configuration

A table of classifications and a table of exceptions. Both are written as pairs of a package name and a reason.

`runnablePackages` registers packages as run-only, and `importablePackages` registers them as libraries. A package with no classification is asked only not to hold both. The classification is split across two tables rather than written in one field so that the classification's value does not itself become vocabulary inside the configuration. Which table it is written in is the classification.

`exceptions` are the packages whose reports are stopped. A registration whose reason is empty or whitespace-only does not count as an exception. Let an exception without a reason through and clearing a report becomes one line of configuration, with the clearing invisible in the check's output.

On the classification tables, a registration with an empty reason stays alive. A classification registration only makes the check stricter, so dropping it because no reason was written would turn a configuration defect straight into a looser check. An empty reason is refused by the schema.

Package names are matched exactly against the manifest's `name`. A manifest declaring no `name` is called by its directory relative to the repository root.

### Why it is not shipped in the preset

This rule is not in the shipped preset; it takes effect only once a consumer writes its name.

Enabling it reports any package that already declares both a runnable entry and a public entry. There are two ways to clear such a report, and both move the package's own structure: split the package in two so the run surface and the import surface are separate, or write a reason with a deadline and register an exception. Which to choose is a decision apart from whether to adopt this lint rule.

Putting it in the shipped preset would push that decision onto whoever adopts the preset. A repository already holding a package with both surfaces goes red the moment it `extends` the preset, and is forced to move its structure or write an exception before it has considered the rule at all. So it is left out, and a repository that has decided to keep one surface per package writes the name into `rules` to enable it.

## Fix

Split the surfaces in two. Move the running part into a run-only package and the shared implementation into an imported package, with the former depending on the latter. After the split, the run-only side declares only `bin` and the implementation side only `exports`.

Before splitting, count which one the package is currently used as. With not one import from another package, what to delete is the `exports` side. With the execution route called by nobody, what to delete is the `bin` side. Only where both are in use is a split needed.

Declaring the classification also reports a surface added later. Add `exports` to a package registered as run-only and the report comes out then, without waiting for both surfaces to line up.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a manifest that declares a runnable entry and an import surface carries both
export const shipped = true;

```

<!-- END GENERATED examples -->

The subject of this rule is what a package's manifest declares rather than the source in front of you, so the code above is the file the report stands on, and what settles the judgment is the surfaces that manifest names.

### Forbidden bypasses (do not do this)

- **Declaring no imported surface and reading it from another package by a deep path.** Only the declaration disappears; the dependency stays real. A deep path starting from the package name is normalized and treated as reaching the same package
- **Registering an exception and keeping both surfaces.** An exception is for holding a deadline on the splitting work, not for a permanent classification
- **Deleting `main` and keeping only `types`.** A type entry is an imported surface too
- **Rewriting the runnable entry as a task definition while it stays callable from outside.** A task is not a surface so the report clears, and in that case confirm it really has become callable only as a task

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
