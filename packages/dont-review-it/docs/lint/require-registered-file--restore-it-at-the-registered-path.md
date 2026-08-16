---
description: "Require every path the required-file table registers to hold a file that is not empty, so a file whose readers sit outside the source keeps its place instead of leaving with the change that stopped mentioning it"
---

# require-registered-file--restore-it-at-the-registered-path

<!-- BEGIN GENERATED rule-header -->

Require every path the required-file table registers to hold a file that is not empty, so a file whose readers sit outside the source keeps its place instead of leaving with the change that stopped mentioning it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Bundle: `toolchain`
- Source: [`require-registered-file--restore-it-at-the-registered-path.ts`](../../src/lint/oxlint/rules/toolchain/require-registered-file--restore-it-at-the-registered-path.ts)

<!-- END GENERATED rule-header -->

## Violation

A row of the required-file table that no longer stands. Three reports: the registered path holding no file, the file holding nothing, and a row naming an owner this repository does not have.

Each row carries the reason the file is required, and the report repeats it.

## Fix

Write the file at the registered path and put in it what the row asks for.

To retire the requirement, delete the row instead, and record that judgment in the commit message.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a registered path with nothing at it is reported against the repository root
export const shipped = true;

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Creating the file empty. A file that holds nothing is reported the same way
- Leaving a row pointed at a workspace this repository no longer has, so the file is asked of nobody

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `MISSING_REGISTERED_FILE_MESSAGE_ID` | A path the required-file table registers must not stand without a file. Write the file at \`{{registeredPath}}\`, which {{holder}} is registered to hold, and put in it what the row asks for: {{reason}}. Delete the row instead to retire the requirement, and record that judgement in the commit message. A file that holds nothing is reported the same way. {{contentGuarantee}} |
| `EMPTY_REGISTERED_FILE_MESSAGE_ID` | A file the required-file table registers must not hold nothing. Write into \`{{registeredPath}}\` under {{holder}} what the row asks for: {{reason}}. Delete the file and the row instead to retire the requirement, and record that judgement in the commit message. {{contentGuarantee}} |
| `DEAD_OWNER_REGISTRATION_MESSAGE_ID` | A row of the required-file table must not name an owner this repository does not have. Delete the row, or point it at the workspace that took over what the row asks for: {{reason}}. {{holder}} matches no workspace, so \`{{registeredPath}}\` is asked of nobody. Record that judgement in the commit message. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
