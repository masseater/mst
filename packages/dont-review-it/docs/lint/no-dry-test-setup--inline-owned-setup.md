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
- Bundle: `testing`
- Source: [`no-dry-test-setup--inline-owned-setup.ts`](../../src/lint/oxlint/rules/testing/no-dry-test-setup--inline-owned-setup.ts)

<!-- END GENERATED rule-header -->

## Violation

A spec file coupling to a module that reads as shared setup. Two things put a module there: a name matching one of the setup-name patterns (`_*`, `*fixtures*`, `*harness*`, `*helper*`, `*.setup.*`, `setup.*` by default), and a module its own package's public entry cannot reach. A chain of forwarding modules is followed, and the report names the relays it walked.

Only couplings that carry values are read. `allowedFixturePackages` lists packages a spec may take setup from through their own public entry; an entry naming anything else is reported at the head of the file.

## Fix

Write the setup that module provides into a fixture in this spec. Setup repeated between specs is the state this bundle asks for.

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

- Renaming the module out of the setup-name patterns. Whether the package's public entry reaches it is read as well
- Putting a forwarding module between the spec and the setup. The chain is followed
- Adding the module's package to `allowedFixturePackages`. The entry has to name a package read through its own public entry

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
