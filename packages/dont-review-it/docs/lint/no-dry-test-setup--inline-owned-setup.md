---
description: "Disallow a spec file coupling to a module that its own package's public entry cannot reach or that is named as shared setup, so the setup a spec runs on stays written in the spec that runs it"
---

# no-dry-test-setup--inline-owned-setup

<!-- BEGIN GENERATED rule-header -->

Disallow a spec file coupling to a module that its own package's public entry cannot reach or that is named as shared setup, so the setup a spec runs on stays written in the spec that runs it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-dry-test-setup--inline-owned-setup.ts`](../../src/lint/oxlint/rules/no-dry-test-setup--inline-owned-setup.ts)

<!-- END GENERATED rule-header -->

## Violation

Each edge of coupling running from a spec file to another module is read one at a time, and where it lands on a setup module it is reported. The judgment happens when a spec is visited, and only against the edges that spec wrote. A file nothing couples to is out of this rule's scope, wherever it sits and whatever it is called.

These shapes count as coupling. Each is another spelling of the one fact "it coupled to that module", and they are handled alike.

- An `import` declaration, including a side-effect-only `import "./x.ts"` binding nothing
- A named re-export (`export { x } from`) and a whole re-export (`export * from`)
- A dynamic `import()` or `require()` whose specifier settles before the run. "Settles before the run" means a string literal, a `const` bound to a string literal in the same file, and a template literal assembled from those two alone

Edges carrying only types are not read. `import type` and `export type` carry no value, so they cannot carry setup either.

Whether the coupling target is a setup module is settled in this order. It is evaluated top down and stops where it hits.

1. **A specifier of an allowed shared fixture package** (`allowedFixturePackages`). No further judgment is made
2. **An unresolvable specifier.** A subpath import starting with `#`, an absolute path, a dynamic import specifier settling only at run time, and a package installed outside the workspace land here
3. **A specifier naming another package's public entry.** Where any running code other than a spec references that package even once, it is production and out of scope. Where the references come only from specs, it is reported as a setup module. What appears in the report is the package's directory rather than a file
4. **An assets file.** Delegated wholesale to [require-test-assets-constants--move-setup-to-spec](./require-test-assets-constants--move-setup-to-spec.md) and [no-cross-spec-assets-import--use-own-assets](./no-cross-spec-assets-import--use-own-assets.md)
5. **A file holding only type declarations.** It holds no value, so it cannot carry setup
6. **A file reachable from its own package's public entry.** This is the subject under test
7. **A file matching a name pattern** (`setupModuleNamePatterns`). Reported
8. **A file not reachable from its own package's public entry.** Reported
9. Where its package cannot settle a public entry, the file is taken as a relay and the coupling edges it holds go through the same judgment. Followed up to four steps

A "public entry" is a file named by `exports`, `main` or `bin` in `package.json`. For this repository's `packages/dont-review-it` those are `./src/index.ts` (`.`), `./src/plugin.ts` (`./plugin`) and `./src/cli.ts` (`bin`). Reachability is worked out by following coupling edges from there, walking only inside the package's directory. `src/lint/oxlint/rules/*.ts` are treated as subjects because `plugin.ts` imports them, not because of their names or where they sit.

Reachability, and whether running code references a package, are remembered only while the process is alive. Add a file while the lint is running and that process's answer does not change; it changes the next time the lint starts.

A specifier listed in `allowedFixturePackages` is evaluated before the coupling judgment, and at the same time the configuration itself is checked. Where something that is not a package specifier, something naming a file inside a package directly, or a subpath the package does not publish through `exports` appears there, the configuration is reported as wrong. The report stands on the whole spec file being checked — configuration has no position inside a file — so the same configuration error appears once per spec.

### The invariant

The first layer: what a spec verifies stops being settled by that file alone. With the assembly steps in another file, reading the body of an `it` does not say what the subject is, so the reader moves to another file and from there to another. The test stops describing a contract and becomes a call to something assembled somewhere.

The second layer: that other file sits outside the checks. This package's rules demand a shape of spec files. Move the assembly out of the spec and the demanded shape disappears from inside the spec, while the layer moved out is looked at by nobody. What was evaded is not one rule but the whole policy of demanding a shape of specs.

The third layer: shared setup carries mutable state. Tests run in parallel by default, so a mock configuration or a rewritable value placed at module scope leaks into another test running at the same time. Allow sharing and single-file readability and parallel isolation break together, and the breakage depends on execution order, so it does not reproduce.

The fourth layer: the utility built for reuse is not itself tested. Code written to help tests piles up without ever being treated as a subject, and when it breaks, every spec using it fails at once for no legible reason.

One of these four would not be enough. Readability alone would be served by formatting; parallel isolation alone by isolating the run. Because all four point the same way, the trade of accepting duplication holds.

### Configuration

- `specFileSuffixes` (a list of strings, optional): the suffixes taken as spec files. Defaults to `.test.ts` and `.test.tsx`
- `setupModuleNamePatterns` (a list of strings, optional): the name patterns taken as setup modules. Defaults to `_*`, `*fixtures*`, `*harness*`, `*helper*`, `*.setup.*`, `setup.*`
- `allowedFixturePackages` (a list of strings, optional): the package specifiers of the one shared fixture package the repository allows. Defaults to empty
- `assetsNameMarkers` (a list of strings, optional): the word appearing in an assets file's name. Defaults to `assets`

```jsonc
["error", { "allowedFixturePackages": ["@mst/spec-fixtures"] }]
```

Patterns are matched against each segment of the resolved target's path, taken relative to the repository. `*` does not cross a path separator, and both ends are anchored. `*helper*` hits `test-helpers.ts` and a directory named `helpers`, but does not sweep in some other path that merely contains the string `helper`. Matching runs on the resolved target rather than the specifier string, so coupling to the same file through an alias gives the same answer.

`setupModuleNamePatterns` replaces the default rather than adding to it. The state "an empty array silences the name-based judgment alone" has to be expressible, and an additive form cannot write it.

The name-based judgment is an addition for cutting quickly through the range the position-based judgment does not reach, not a premise this rule stands on. With nothing configured at all, the public entries and the coupling graph are settled by the repository's contents, so the position-based judgment works.

### Where the judgment does not reach

Not being detected does not mean it is allowed. What is listed here is only where static analysis cannot settle the coupling target, or where the repository holds no information to settle it with.

- A dynamic `import()` whose specifier settles only at run time: handing it a variable, the return of a function, or a string assembled while running
- A specifier going through tsconfig `paths` or a build tool's alias. Only relative specifiers and installed package specifiers are resolved
- A package whose public entry names a build product that does not exist yet. Where no public entry resolves, the position-based judgment goes quiet and only the name-based one is left
- A chain of relays longer than four steps
- Where the running code referencing that package is written in JavaScript. Only TypeScript sources are walked as referrers

## Fix

Write the setup that spec needs into that spec's own fixture. Where another spec needs the same setup, write the same thing there too. In this bundle duplication is not debt to be reduced but the price paid for single-file readability. A review comment in the direction of "this is duplicated, let us consolidate" does not hold against this rule.

Where a package directory was reported, that package exists only for specs. Choose between deleting the package and writing its contents into each spec, or growing it into something production running code uses.

Where the reported module was actually part of production, what needs fixing is the publishing side rather than the spec. Make that module reachable from its own package's public entry. Something unreachable cannot be claimed to be production.

The route of adding a published fixture to a shared fixture package stays open, but only where three things hold at once.

1. Evidence that the shape recurs at repository scale
2. A paired rule, in the same change, forbidding direct use of the low-level API that fixture wraps. A fixture with no paired rule is a recommendation rather than a boundary, and the duplication returns at once
3. Tests for that fixture itself

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a static import of a module named as shared setup is reported
import { build } from "./helpers.ts";

export const used = build;

```

```ts
// another spec read as setup is a setup module
import { other } from "./other.test.ts";

export const used = other;

```

Code this rule accepts.

```ts
// the module a spec tests is reachable from the public entry, so it is the subject
import { widget } from "./widget.ts";

export const under = widget;

```

```ts
// a type-only import carries no setup
import type { Shape } from "./shapes.ts";

export const size = (shape: Shape) => shape.size;

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Rewriting it as a dynamic `import()`. As long as the specifier settles before the run, it is reported as the same coupling as a static `import`
- Interposing a relay file that only re-exports. Relays are followed, and where the walk lands on a setup module it is reported
- Renaming the file so it misses the name patterns. The position-based judgment does not read names, so the report does not clear
- Adding your own helper to `allowedFixturePackages`. The coupling report clears, but naming a module inside the repository reports the configuration itself, so nothing has passed
- Moving the setup into another spec file and reading each other's. A spec is not reachable from a public entry, so the spec that was read is reported as a setup module
- Placing the setup under an assets file name. Another rule requires assets to hold static data only, so setup that executes falls there
- Emptying `setupModuleNamePatterns`. The name-based judgment goes quiet, but the position-based judgment takes no configuration and keeps running

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `setupModuleCoupling` | A spec file must not take its setup from another module. This file couples to \`{{path}}\`. Write the setup that module provides into a fixture in this file. |
| `relayedSetupModuleCoupling` | A spec file must not take its setup from another module. This file couples to \`{{path}}\` through \`{{relays}}\`. Write the setup that module provides into a fixture in this file. |
| `misplacedFixturePackage` | An allowed fixture package must not name anything other than a package read through that package's own public entry. \`{{entry}}\` is configured as one. Drop that entry and write the setup it provides into a fixture in each spec that needs it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
