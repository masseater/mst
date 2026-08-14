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

A command the declaration retired being started as a child process.

The way in is a call to an API that starts a child process. Which APIs start one, and which argument carries what gets started, are held in a table. One row of the table is written with four things: the module specifier, the name that module publishes, the position of the argument carrying the target, and whether that argument carries one command name or a whole command line. The default table covers the runtime's own child-process module and two widely used starting libraries.

**Calls are matched by binding, not by spelling.** Not every call named `exec` starts a process, so the name is resolved to what module and what export it is bound to before the table is applied. Named imports, member references through a default import and a namespace import, destructured bindings from a synchronous request, and wrappers built by a call that takes a starting API as an argument are all resolved. A regular-expression match, and a function of your own carrying the same name, are not treated as starting anything.

The target argument is folded before it is matched. A written-out string, a template whose every substitution folds, a concatenation of strings, and a value bound to a `const` in the same file are what folding reaches.

An argument carrying a command line, and a start with a runner in the target position, are split into tokens as a line before matching. There is one set of matching rules.

- Only a word at the head of the line, or straight after a separator (whitespace, semicolon, pipe, logical operator, bracket, newline), counts as a command position
- Environment variable bindings placed at the head are read past
- A one-off runner and a shell's `-c` are read past as a preamble, and the word behind them counts as the command. Flags standing straight after the preamble are read past too
- A specifier handed to a runner is matched with its version dropped. A scoped name keeps its scope
- A fetch address is split into elements at path separators, the scope marker and the query marker, and only whole-element equality is read

Reports divide into three. The start of a retired command, a start whose target does not settle before the run, and a command line whose target only settles while the program runs. The last two say "the match did not come off" rather than "this hit a prohibition", and are worded apart. A line whose target only settles while running is one that hands fetched content to a shell, one that evaluates content, and one where the command position is written as a substitution.

Defects in the registration itself are reported too. A withdrawal entry carrying no grounds, a withdrawal entry naming what the declaration does not carry, and a registered position carrying no reason. All three come out even where the file being analysed holds no violation.

These are not violations.

- Importing a starting API at all. Only what gets started is read
- A retired name appearing as a file path or as part of an argument rather than as the target
- A command the declaration does not carry. Commands that look dangerous are not guessed at
- A target whose folded result matches none of the declared names
- An empty declaration, or none given. There is nothing to match against

### The invariant

What is observed is a tool that has left the dependency list and left the source imports, still turning up in the run log.

Forbidding an import reads the module graph; forbidding it in the manifest reads the declaration text; starting a child process appears in neither. The string handed to a starting API is, in that position, just an argument, and it touches neither module resolution nor the manifest.

The reason a tool was retired holds regardless of how it is called. "A successor was taken into the runtime", "maintenance has stopped", "the distribution route cannot be trusted" — these hold the same for an import and for a CLI. Yet the enforcement has to be built per calling shape or it does not reach. **Close two routes and the third gets chosen as the only writable shape left.** The stronger the prohibition, the more pressure gathers on the route still open.

Waiting for a general discipline of "do not use a subprocess where a typed API exists" does not fill this gap. Whether the same work can be written with a typed API needs knowledge particular to each target, and that is not a judgment a machine can hold. Reduced to a shape it can hold, it becomes one line: a retired name, and an instruction for what to do instead. General discipline or not, reducing what can be reduced leaves no gap.

### Configuration

```jsonc
[
  "error",
  {
    "declared": [{ "name": "lerna", "substitute": "use the workspace task runner" }],
    "withdrawn": [{ "name": "gulp", "grounds": "the release job accepts only this command" }],
    "spawnForms": [
      {
        "specifier": "node:child_process",
        "exported": "exec",
        "position": 0,
        "carries": "commandLine",
      },
    ],
    "exceptions": [{ "path": "apps/*/release-job/**", "reason": "the published tag settles the target" }],
  },
]
```

`declared` is a list of rows pairing "the name to retire" with "an instruction for what to do instead". **This array shares its type definition with the check that reads imports and the check that reads manifests, and follows the same composition rule.** The rule is "start from the default list and add what the consumer names" — not replacement. The instruction is embedded in the report as written, so write it as an action rather than a noun.

`withdrawn` is a list of entries lifting rows out of the default list. A row whose `grounds` is empty is an invalid registration, and a row naming what neither the default nor the consumer's declaration carries is reported as a dead withdrawal.

`spawnForms` replaces the table of starting APIs wholesale. `carries` is either `name` (one command name) or `commandLine` (a command line), and omitting `position` reads the first argument.

`exceptions` is a list of rows pairing a position this check does not apply to with its reason. `path` is a glob, and a row whose `reason` is empty is an invalid registration.

The default `declared` is empty. What gets retired is settled by the repository's configuration, within what can be explained from published technical information alone.

### What this check does not take on

- Whether the same work can be written with a typed API. A person writes that as the `substitute`. What the machine guarantees is only that the command is not started
- Command strings written outside the source. CI workflow definitions, shell scripts in the repository, the script field of a package manifest and code blocks in documents are not opened by a static analyser, so they never appear in this rule's input. **Reaching those with the same declaration needs a separate way in.** That is why this rule does not hold the line-matching rules of its own but keeps them as a shared implementation, so the same one can be read when that way in is built
- A start whose target is written as a file path. Matching is whole-token equality, and a name appearing inside a path is not picked up
- Runs defined outside the repository. Features a CI provider supplies, and starts baked into a container image built elsewhere, do not appear in the input
- That the command is declared in the manifest, and that the module is imported. The former belongs to the check that reads manifests, the latter to the check that reads imports. Three of them reading one declaration closes all three routes: pulled in, loaded, started

## Fix

Replace it with the command or API the instruction in the report names. The instruction is carried by the declaration row, so the replacement does not have to be chosen afresh at each call.

Where the report says the target does not settle before the run, write the target as a name. Where a branch changes the candidate, write a start per branch; where a table maps a name to an implementation, move it to the side that reads the table.

Where the report says the command line cannot be read, separate fetching from running. Stop handing fetched content straight to a shell, and write the command to run as a name with its arguments beside it.

Where that command has to keep being used, settle it in the configuration layer rather than at the call site. Place a withdrawal entry lifting the declaration row, with grounds; or register that position as an exception, with a reason. Both appear in the diff and read as a list from the consuming side.

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

- Assembling the target into a variable and handing that over. The report that the target does not settle before the run comes out
- Making a thin function around a starting API and writing the retired name only there. A wrapper is resolved as a binding, so wrapping it reports at the same position. Passing the name as an argument only makes the wrapper's own target unfoldable, and that shape is itself a report
- Putting a one-off runner in front. The runner is read past as a preamble and the name behind it is matched
- Interposing a shell file that does nothing but start the retired command. A shell file's body is a supplier matched by the same declaration
- Silencing it with a suppression comment. Exceptions live in the configuration, not on a line of source
- Registering a withdrawal or a position while leaving the reason empty. It grants no exemption, and the registration itself is reported

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
