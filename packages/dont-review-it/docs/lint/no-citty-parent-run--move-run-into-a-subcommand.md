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

An object handed to citty's `defineCommand` declaring `subCommands` and `run` at once. The report points at the `run` property.

Whether a call is `defineCommand` is settled from the imports. Only calls to a `defineCommand` imported from `"citty"` are read, renamed imports and namespace imports included, so an API of the same name from another library and a function of one's own are left alone.

### The invariant

citty's `runCommand` always returns to the parent command after a subcommand finishes, and runs the parent's `run` when there is one (visible in [`src/command.ts` at v0.2.2](https://github.com/unjs/citty/blob/v0.2.2/src/command.ts), and unchanged on main). Putting `run` on a parent carrying `subCommands` therefore mixes the parent's output in behind every successful subcommand, dirtying a stdout that was supposed to be consumable through a pipe.

With no `run` on the parent, an invocation naming no subcommand fails with `E_NO_COMMAND` instead. That is the wanted behaviour for a CLI built out of subcommands, and it matches what a user expects: called with no arguments, print the usage and exit non-zero.

For giving the bare invocation a default behaviour, citty carries a `default` property. `default` names a subcommand, so the default behaviour surfaces as a subcommand carrying a name. Declaring `default` and `run` together is refused by citty itself with `E_DEFAULT_CONFLICT`. The one pair citty does not refuse is `subCommands` with `run`, and that is precisely the pair that dirties the output. Since it never produces what the writer intended, a machine stops it.

### What is not a violation

- `run` on a command carrying no subcommands. A leaf command's `run` is its body
- A parent carrying `subCommands` alone. Where validation or shared context is needed, `setup` is available
- `subCommands` with `default`. The default behaviour surfaces as a named subcommand, which is the fix this rule pushes for
- An API of the same name imported from somewhere other than citty, or a call to a `defineCommand` defined locally

Where the machine reaches and where the discipline reaches are not the same. Detection is the floor under the invariant, not the ceiling.

## Fix

Delete the parent's `run` and carve out what it was doing as a subcommand.

```ts
import { defineCommand } from "citty";

import { checkCommand } from "./check-command.ts";

export const dontReviewItCommand = defineCommand({
  meta: {
    name: "dont-review-it",
    description: "Run the checks that keep review questions answered by machines.",
  },
  subCommands: {
    check: checkCommand,
  },
});
```

To give the bare invocation a default behaviour, name a subcommand with `default: "check"` rather than burying it in an implicit parent `run`.

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

- Lifting the body of `run` into a function and handing it over by reference, as `run: dispatchFallback`. The declaration has the same shape and is still detected — and were a spelling found that escapes detection, the parent still runs after a subcommand succeeds
- Composing the object from a spread carrying `run` to escape the static judgment. The command that comes out behaves the same
- Moving the body into `setup` instead of the parent's `run`. `setup` runs before every subcommand, which makes it worse: now every subcommand's output is dirtied

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
