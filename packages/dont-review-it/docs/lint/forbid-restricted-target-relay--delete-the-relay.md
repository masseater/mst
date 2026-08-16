---
description: "Disallow a local module passing a restricted target straight to its own public surface and disallow reading a restricted target through such a module, so a target held out of reach in one file stays out of reach behind a chain of local modules"
---

# forbid-restricted-target-relay--delete-the-relay

<!-- BEGIN GENERATED rule-header -->

Disallow a local module passing a restricted target straight to its own public surface and disallow reading a restricted target through such a module, so a target held out of reach in one file stays out of reach behind a chain of local modules

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `governance`
- Source: [`forbid-restricted-target-relay--delete-the-relay.ts`](../../src/lint/oxlint/rules/governance/forbid-restricted-target-relay--delete-the-relay.ts)

<!-- END GENERATED rule-header -->

## Violation

Two shapes, both about a restricted target reached through a local module.

- A module that re-exports a restricted target straight to its own public surface, whether it names the target itself or another local module that forwards it
- A module that reads a restricted target through such a forwarding module. Static imports, dynamic imports, `require`, import-equals declarations and `import()` types are all read

The report names the chain of relays it walked. The rule does nothing until `restrictedTargets` carries an entry; entries can be narrowed to the files they hold for, and `internalAliases` says which specifiers resolve to this repository's own modules.

## Fix

Delete the forwarding module, or rebuild it as a boundary that publishes its own vocabulary rather than passing another module's through. The report names the substitute the entry designates.

Where the forward has to stay, register it as an entry in the lint configuration.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a named re-export puts the target on this module's surface
export { readFile } from "retired-lib";
```

```ts
// reading a module that forwards the target reaches the target
import { readFile } from "./star-forward.ts";
```

Code this rule accepts.

```ts
// a boundary that publishes its own vocabulary keeps the target off its surface
import { readFile } from "retired-lib";
export const read = (path: string) => readFile(path);
```

```ts
// reading a boundary that transforms the binding reaches nothing
import { read } from "./boundary.ts";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Adding another module between the relay and the reader. The whole chain is walked
- Renaming the export on the way out. What is matched is the target the specifier resolves to, not the name it is published under

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `restrictedTargetForward` | A local module must not pass a restricted target straight to its own public surface. This module exposes \`{{target}}\` as \`{{exposed}}\`. Delete this forward, or rebuild this module as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration. |
| `relayedTargetForward` | A local module must not pass a restricted target straight to its own public surface. This module exposes \`{{target}}\` as \`{{exposed}}\` through \`{{relays}}\`. Delete this forward, or rebuild this module as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration. |
| `relayedTargetReach` | A module must not read a restricted target through a local module that forwards it. \`{{specifier}}\` reaches \`{{target}}\` through \`{{relays}}\`. Delete the forwarding module, or rebuild it as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
