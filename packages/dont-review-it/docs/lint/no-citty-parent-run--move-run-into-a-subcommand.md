---
description: "Disallow a `run` handler on a citty command that declares `subCommands`, so a matched subcommand's output is never followed by the parent's"
---

# no-citty-parent-run--move-run-into-a-subcommand

<!-- BEGIN GENERATED rule-header -->

Disallow a `run` handler on a citty command that declares `subCommands`, so a matched subcommand's output is never followed by the parent's

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-citty-parent-run--move-run-into-a-subcommand.ts`](../../src/lint/oxlint/rules/no-citty-parent-run--move-run-into-a-subcommand.ts)

<!-- END GENERATED rule-header -->

## Violation

A `defineCommand` call, imported from `citty`, whose definition object carries both `subCommands` and `run`. The binding is followed from the import, so an alias reaches the same judgment.

## Fix

Delete the parent `run` and move its behaviour into a subcommand of its own.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a parent that declares both subCommands and run is reported
import { defineCommand } from "citty";
const main = defineCommand({ subCommands: { check }, run() {} });
```

```ts
// declaring default does not excuse the parent run
import { defineCommand } from "citty";
const main = defineCommand({ subCommands: { check }, default: "check", run() {} });
```

Code this rule accepts.

```ts
// a parent that only dispatches leaves the bare invocation to the framework
import { defineCommand } from "citty";
const main = defineCommand({ meta: { name: "cli" }, subCommands: { check } });
```

```ts
// a parent names its bare-invocation behavior through default
import { defineCommand } from "citty";
const main = defineCommand({ meta: { name: "cli" }, subCommands: { check }, default: "check" });
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Leaving `run` and having it return early when a subcommand matched. The parent's output still follows the subcommand's
- Building the definition object elsewhere and spreading it in. The parent still registers both

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `parentRun` | A citty command that declares \`subCommands\` must not register \`run\`. Delete the parent \`run\` and move its behavior into a subcommand of its own. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
