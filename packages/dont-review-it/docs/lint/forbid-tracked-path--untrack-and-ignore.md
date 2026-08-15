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

Read once at the repository root, against the table of paths registered as untrackable. Five shapes are reported.

- A tracked file matching a registered pattern
- A registered pattern that is absent from the ignore settings
- An exception row carrying no grounds
- A release row carrying no grounds
- A release row naming a pattern the default table does not carry

The table's rows come from the rule's own defaults plus what the configuration registers; `releases` lifts a default row, each release stating its grounds.

## Fix

Remove the file from the index, list its pattern in the ignore settings, and leave the file in the working tree. Whatever another clone needs belongs in a template tracked under a different name.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an environment file that reached the index is reported
export const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Deleting the file instead of untracking it. What one machine needs is then gone
- Releasing the pattern to clear one file. A release lifts the row for the whole repository and has to say why
- Adding an exception row with an empty reason. It is reported until the grounds are written

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
