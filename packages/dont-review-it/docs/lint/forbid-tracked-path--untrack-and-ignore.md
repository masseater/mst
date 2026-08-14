---
description: "Require every path registered as untrackable to stay out of the tracked file list and to stand in the ignore settings, so values that belong to one machine and output that a build produces never ride a commit into another clone"
---

# forbid-tracked-path--untrack-and-ignore

<!-- BEGIN GENERATED rule-header -->

Require every path registered as untrackable to stay out of the tracked file list and to stand in the ignore settings, so values that belong to one machine and output that a build produces never ride a commit into another clone

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-tracked-path--untrack-and-ignore.ts`](../../src/lint/oxlint/rules/forbid-tracked-path--untrack-and-ignore.ts)

<!-- END GENERATED rule-header -->

## Violation

The table of paths registered as forbidden to track is read, and two things are looked at.

- A path matching any row of the table appearing in version control's list of tracked files
- A row's pattern not appearing in the repository's ignore settings

The input to the judgment is not "is the file present in the working tree" but "is it tracked". The tracked list is obtained by asking version control. The ignore settings are read from the `.gitignore` at the repository root. The global exclusion settings, which differ per machine, and `.git/info/exclude` are not read. Neither travels with a clone, so an ignore written there does not hold in another working environment.

A row of the table carries four items: the pattern, the reason, whether an ignore entry is required, and a list of exceptions. The default table is these four rows, and rows the consumer writes are added to them.

- `**/node_modules/**` — a dependency tree is restored from the manifest and the lockfile
- `**/dist/**` — build output is made from the source beside it
- `**/coverage/**` — coverage output is made by running the tests
- `**/.env` — a per-environment value belongs to the machine that runs the code

To lift a default row, write a release. A release is an addition carrying a reason, so reading the consumer's configuration gives a list of "which of the prohibitions I did not write have I lifted". A release with no reason reports the row itself and lifts nothing.

A release holds only against the four default rows. A release naming a pattern the defaults do not carry is reported as a dead release. The way to lift a row the consumer wrote is not a release but deleting that row. Write a release for your own row and the row keeps holding while the release alone is reported as dead.

An exception row requires a reason too. An exception with no reason is reported as a registration and exempts none of the paths it should have covered.

Reports stand on the file being checked directly under the workspace root. The unit of judgment for this discipline is the whole repository rather than the syntax of one file, so the position of the report is drawn to "where the table and the ignore settings sit". While a file below the workspace root is being checked, this rule reads nothing.

### The invariant

What is observed is something that should exist only locally — a per-environment setting, a build product, a cache — mixed into a commit and changing how another working environment behaves.

The first layer is that the moment a file is tracked, it is handed to everyone's working tree. A value that ought to differ per environment gets fixed, and a build product enters the state of "present without being built". Swap out what builds it and the old output stays, so which one is real is no longer settled inside the repository.

The second layer is that ignore settings only "ignore by default" — they do not stop a forced addition. And once a file is tracked, adding it to the ignore settings afterwards leaves it tracked. What is written in the ignore settings guarantees nothing about not being tracked. That asymmetry breeds an operation that reads the ignore settings and feels safe.

The third layer is that walking the working tree cannot detect this violation. The file is allowed to be there, and being there is not the violation. Since the input to the judgment is "is it tracked", it needs a different input from a check that reads whether a file exists.

An ignore entry is required at the same time because a row with no entry is only in the state of "not tracked right now", and it falls into being tracked the moment somebody adds files in bulk.

### Configuration

```jsonc
[
  "error",
  {
    "forbidden": [
      {
        "pattern": "**/*.tsbuildinfo",
        "reason": "an intermediate result of type checking belongs to the machine that ran it",
        "ignoreListing": true,
        "exceptions": [{ "pattern": "vendor/**", "reason": "upstream publishes only the built form" }],
      },
    ],
    "released": [{ "pattern": "**/coverage/**", "reason": "the measured result ships inside the package" }],
  },
]
```

`forbidden` is a list of rows added to the table. `pattern` and `reason` are required, and `pattern` is matched as a glob from the repository root. Setting `ignoreListing` to `false` makes that row forbid tracking alone and ask for no ignore entry. `exceptions` lists paths within that row where tracking is allowed, as pairs of a glob and a reason.

`released` is a list of releases lifting default rows. `pattern` must match the spelling of the default row exactly. A release writing a pattern the defaults do not carry is reported as a dead release.

The four default rows are always the starting point, and `forbidden` is added to them. It is not a replacement because a shape where one consumer line erases the whole default would show up only as the result "nothing is reported".

### What this check does not take on

- Whether the contents of a tracked file are secret. Contents are not read. What is protected is only "that path is not tracked", and which paths go in the table is decided by a person
- What to do about content already in the history. Rewriting history is a version control operation and outside the range of detection
- A working tree not under version control. The tracked list cannot be obtained, so the tracking check reports nothing. The ignore-entry check works as it stands
- Stock-taking of whether a table row actually covers anything. Finding registration rows that reach no check route belongs to the check that reconciles the register against the range of targets

## Fix

Take it out of tracking and put it in the ignore settings. The file may stay in the working tree.

Where a value is needed, track a template carrying no value under another name. Where it is a build product, get the build task in order and make it when it is needed.

Where the report says a pattern is missing from the ignore settings, write into the ignore settings the pattern exactly as the table row spells it. Lining up the spelling of the table row with the ignore settings is precisely what this check asks for. Rewrite only one of them and the next reader cannot settle which of the two spellings is right.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an environment file that reached the index is reported
export const total = 1;
```

<!-- END GENERATED examples -->

The subject of this rule is the paths the index tracks rather than the source in front of you, so the code above is the file the report stands on, and what settles the judgment is which paths the index holds and what the ignore settings register.

### Forbidden bypasses (do not do this)

- Adding to the ignore settings alone and leaving an already-tracked file where it is. Ignore settings do not hold against a tracked file
- Emptying the contents and keeping it tracked. That it is tracked does not change. **This shape does not fall to this check.** Contents are not read, so an empty file is simply reported as one more tracked row
- Deleting a row the consumer wrote to get past it. **This shape does not fall to this check either.** A default row needs a registered release and so appears in the diff, but deleting a row the consumer wrote themselves shows up only as one fewer row in the configuration
- Writing an exception reason that says only "to be decided later". The reason is where the grounds go for that path standing outside the table

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `trackedForbiddenPath` | A path registered as untrackable must not stand among the tracked files. \`{{path}}\` is tracked, and its row reads: {{reason}}. Remove it from the index, list its pattern in the ignore settings, and leave the file in the working tree. Move whatever another clone needs into a template tracked under a different name. Deleting the file is not the repair. |
| `unignoredForbiddenPattern` | A pattern registered as untrackable must not stay out of the ignore settings. \`{{pattern}}\` matches no entry of \`{{ignoreFile}}\`, and its row reads: {{reason}}. Add \`{{pattern}}\` to that file, spelled the way the row spells it. |
| `groundlessException` | An exception row that carries no grounds must not stand in the table. The row excepting \`{{excepted}}\` under \`{{pattern}}\` leaves its reason empty. Write the grounds into that row, or delete the row and untrack the paths it covers. |
| `groundlessRelease` | A release row that carries no grounds must not stand in the configuration. The row releasing \`{{pattern}}\` leaves its reason empty. Write the grounds into that row, or delete the row and leave the registered pattern in force. |
| `deadRelease` | A release row that names a pattern outside the default table must not stand in the configuration. No default row carries the released \`{{pattern}}\`. Delete the row, and delete the configured row itself to drop a pattern this configuration added. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
