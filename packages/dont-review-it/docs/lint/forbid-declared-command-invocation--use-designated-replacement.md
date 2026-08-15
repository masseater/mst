---
description: "Disallow starting a command the shared declaration has retired as a child process, so the declaration that closes the import route and the manifest route closes the process route with the same entry"
---

# forbid-declared-command-invocation--use-designated-replacement

<!-- BEGIN GENERATED rule-header -->

Disallow starting a command the shared declaration has retired as a child process, so the declaration that closes the import route and the manifest route closes the process route with the same entry

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-declared-command-invocation--use-designated-replacement.ts`](../../src/lint/oxlint/rules/forbid-declared-command-invocation--use-designated-replacement.ts)

<!-- END GENERATED rule-header -->

## Violation

A child process started with a command the shared declaration has retired. Each spawn form named in `spawnForms` says where its target sits; the target is read as one string the source spells out, and where the form hands a shell a whole command line, every name standing in command position on that line is matched against the declaration.

A target or a command line that only settles while the program runs is reported on its own. Nothing can match it against the declaration, so leaving it unread would make a variable the way past this rule.

`declared` adds entries to the standing declaration and `withdrawn` lifts one, each withdrawal carrying the grounds it stands on. `exceptions` registers a position that keeps starting a retired command, again with grounds. A withdrawal or an exception written without grounds, and a withdrawal naming a command no declaration carries, are reported at the head of the file.

## Fix

Start what the declaration names in place of the retired command. The report carries that substitute.

Where the target was assembled while the program runs, write the command out by name and hand it its arguments separately.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a retired command named as the target of a start is started
import { spawn } from "node:child_process";
spawn("lerna", ["run"]);
```

```ts
// a runner written in front of a retired command starts it
import { exec } from "node:child_process";
exec("npx lerna run build");
```

Code this rule accepts.

```ts
// a command no declaration retires is started as it stands
import { execFile } from "node:child_process";
execFile("git", ["status"]);
```

```ts
// a retired name written inside a path is not what starts
import { execFile } from "node:child_process";
execFile("node", ["./node_modules/lerna/cli.js"]);
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving the command name into a variable, or building the command line at run time. An unreadable target is itself reported
- Withdrawing the entry to clear one call site. A withdrawal lifts the command for the whole repository and has to say why
- Registering the position in `exceptions` without grounds. It is reported until the grounds are written

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `declaredCommandInvocation` | A command the declaration has retired must not be started as a child process. The declaration covers starting it, not only importing it. Replace \`{{name}}\` with what the declaration names in its place: {{substitute}} |
| `undecidedCommandTarget` | A child process must not be started through a target the source leaves undecided. \`{{written}}\` is settled while the program runs, and nothing matches it against the commands the declaration has retired. Write one name the source spells out at the target position. |
| `unreadableCommandLine` | A command line handed to a shell must not settle what it starts while it runs. \`{{line}}\` reaches text nobody can read here, and nothing matches it against the commands the declaration has retired. Write the command out by name and hand it its arguments. |
| `groundlessWithdrawal` | A withdrawal must not lift a declared command without grounds. \`{{name}}\` is withdrawn with none. Write what makes this repository need that command, or drop the withdrawal. |
| `deadWithdrawal` | A withdrawal must not name a command no declaration carries. \`{{name}}\` is withdrawn and declared nowhere. Delete the withdrawal. |
| `groundlessInvocationException` | A registered position must not stand without the grounds it stays. \`{{path}}\` is registered with none. Write what starts a retired command at that position, or drop the entry. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
