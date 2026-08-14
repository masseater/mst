---
description: "Require the tsconfig.json that governs a file to extend one of the shared presets, so compiler ruleOptions are decided in one place instead of being copied into every workspace"
---

# no-standalone-tsconfig--extend-shared-preset

<!-- BEGIN GENERATED rule-header -->

Require the tsconfig.json that governs a file to extend one of the shared presets, so compiler ruleOptions are decided in one place instead of being copied into every workspace

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-standalone-tsconfig--extend-shared-preset.ts`](../../src/lint/oxlint/rules/no-standalone-tsconfig--extend-shared-preset.ts)

<!-- END GENERATED rule-header -->

## Violation

The first `tsconfig.json` found by walking up from a linted file extending none of the presets the configuration allows. Carrying no `extends` at all and pointing at some other preset are both caught here.

Only the `extends` entry is read; the contents of `compilerOptions` are not. Extending a preset and overriding part of it is not reported. What may be overridden is not this rule's to settle, and overrides piling up is visible in review.

`extends` is accepted as a single string or as a list of strings. In a list, one allowed entry is enough to pass.

`tsconfig.json` is read as JSONC rather than JSON, so comments and a trailing comma do not hide the `extends`. The `tsconfig.json` a template generates comes out with comments in it, and failing to read that would let this rule pass over exactly the case it most needs to catch.

A `tsconfig.json` that cannot be read — as JSON or as JSONC — is treated as carrying no `extends`.

A file with no `tsconfig.json` anywhere above it is not reported, because which configuration it belongs to is not settled.

Every file belonging to an offending `tsconfig.json` is reported. Narrowing that to the first file would leave which file carries the report up to the order the lint happens to run in, moving the report around from run to run. Fixing one `tsconfig.json` clears every report for that workspace at once.

The report covers the whole file (the Program node), because there is no line to point at inside the file being reported.

The contents of a `tsconfig.json` are read once per directory, and the answer is remembered for as long as the process lives. Rewriting a `tsconfig.json` mid-run does not change that process's answer; the next run does.

### The invariant

Writing compiler options out per workspace produces copies that are identical the moment they are written. Nothing holds them identical, so the first time one is touched they stop being copies, and nothing reports that they have diverged.

This repository was in exactly that state. Three packages' `tsconfig.json` files agreed on 15 entries, while the root and `apps/website` held something else. `strict` was in only three of them and was not in force at the root or in `apps/website`. Nobody had removed it: each had received what the template handed out and left it where it landed.

Consolidating alone returns to the same state. The next person adding a workspace drops in the `tsconfig.json` the template emitted, and it works. Because it works, nothing notices until a review says so, and the review then says the same thing every time.

With this rule, a machine reports the moment something falls out of the consolidated state. The argument about which options to choose gathers in the one place that fixes the preset.

### Configuration

The allowed `extends` entries are taken as a list of strings matched by suffix. Left unset, or handed an empty list, this rule reads nothing.

The match is on the suffix because there are two ways to point at the same preset. A workspace that can depend on the package owning the preset points at it by package name (`@mst/dont-review-it/tsconfig/library.json`); one that cannot, because the dependency runs the other way, points at it by relative path (`../dont-review-it/tsconfig/library.json`). Both end in `dont-review-it/tsconfig/library.json`, so the list carries that part alone.

Include the name of the package owning the preset in each entry. Allowing a bare suffix such as `./tsconfig/library.json` would also let through a preset from any other package that happens to carry a file of the same name.

Which presets are allowed is not settled inside the rule. How the presets are arranged follows from the situation of whoever uses them, and embedding that in the rule would mean changing the rule every time a preset is added.

## Fix

Delete that `tsconfig.json`'s `compilerOptions` and `extends` the shared preset matching where the workspace runs: the library preset for Node, the app preset for a browser.

What may stay is only what is specific to that workspace and would break other workspaces if it were put in the preset. In practice that is `include`.

If an option the preset does not hand over is needed, there are two choices. Where every workspace needs it, add it to the preset. Where the workspace runs somewhere none of the existing presets covers, make a new preset for that place and add it to the list of allowed entries. Settling it on the workspace side instead means the next workspace makes the same decision again, which is the state this rule exists to prevent.

Extending the base preset directly is not a fix. The base settles nothing about where the code runs, so that workspace alone is left without an answer to whether it targets Node or a browser.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a tsconfig that writes its own compilerOptions is reported
export const total = 1;
```

<!-- END GENERATED examples -->

The subject of this rule is the compiler configuration a workspace holds rather than the source in front of you, so the code above is the file the report stands on, and what settles the judgment is what the configuration beside it extends.

### Forbidden bypasses (do not do this)

- Adding a preset dedicated to one workspace to the allowed list, one for one. Once the number of presets catches up with the number of workspaces, nothing has been consolidated
- Extending the preset and then writing the original `compilerOptions` underneath. The report clears while the copy remains, so the divergence happens exactly as before
- Silencing that one file with a suppression directive. A workspace standing outside the preset is then pinned in place with no explanation of why
- Adding a conditional branch to an existing preset rather than making a new one for a place that runs differently. `extends` in a `tsconfig.json` carries no conditions, so the branch ends up on some workspace's side anyway

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `standaloneTsconfig` | The tsconfig.json that governs this file must not decide compiler ruleOptions on its own. \`{{tsconfigPath}}\` extends none of {{allowedSuffixes}}. Replace its compilerOptions with an \`extends\` naming the preset that matches how the workspace runs, and keep only what is particular to the workspace, such as \`include\`. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
