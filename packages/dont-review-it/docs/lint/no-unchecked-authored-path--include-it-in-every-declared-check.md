---
description: "Require every authored path to sit inside a check this repository declares, and every registration row to sit inside the check that consumes it, so a check that opens nothing is reported instead of passing for a check that found nothing"
---

# no-unchecked-authored-path--include-it-in-every-declared-check

<!-- BEGIN GENERATED rule-header -->

Require every authored path to sit inside a check this repository declares, and every registration row to sit inside the check that consumes it, so a check that opens nothing is reported instead of passing for a check that found nothing

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-unchecked-authored-path--include-it-in-every-declared-check.ts`](../../src/lint/oxlint/rules/no-unchecked-authored-path--include-it-in-every-declared-check.ts)

<!-- END GENERATED rule-header -->

## Violation

An authored path, or a registration row, sitting outside the check that should reach it. Seven reports.

- An authored path opened by none of the declared checks
- A declaration of paths no check reads that covers a whole directory rather than an extension or a single path
- A registration row aiming at paths the consuming check leaves out through an exclusion
- A registration row aiming at paths the consuming check never opens
- A row allowing an exception that matches no authored path
- A record naming a receiver this repository does not declare
- A file reached from a registered file that the scope registration leaves out

## Fix

Add the path to the paths one of the declared checks opens, or declare its extension among the paths no check reads and write the reason on that declaration.

Move a registration row to a registry a check reading those paths consumes, and delete a row that stands for files the repository no longer holds.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an authored path no declared check opens
export const shipped = true;

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Declaring a whole directory as unread. That hides every extension under it, present and future
- Excluding the path from the check instead of adding it. The path then sits outside every check again

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `UNCHECKED_AUTHORED_PATH_MESSAGE_ID` | An authored path must not sit outside every check this repository declares. \`{{authoredPath}}\` is opened by none of {{declaredChecks}}. Add it to the paths one of those checks opens, or declare its extension among the paths no check reads and write the reason on that declaration. |
| `BROAD_UNCHECKED_DECLARATION_MESSAGE_ID` | A declaration of paths no check reads must not cover a whole directory. \`{{pattern}}\` names a directory rather than an extension or a single path. Split it into the extensions carried under that directory, or name each path this repository leaves unread. |
| `EXCLUDED_REGISTRATION_MESSAGE_ID` | A registration row must not aim at paths the check that consumes it leaves out. Row \`{{pattern}}\` of {{registry}} matches \`{{matchedPath}}\`, and \`{{check}}\` leaves that path out through {{exclusion}}. Move the row to a registry that a check reading those paths consumes, or take that exclusion out of \`{{check}}\`. |
| `UNOPENED_REGISTRATION_MESSAGE_ID` | A registration row must not aim at paths the check that consumes it never opens. Row \`{{pattern}}\` of {{registry}} matches \`{{matchedPath}}\`, and \`{{check}}\` opens only {{coveredPaths}}. Move the row to a registry that a check reading those paths consumes, or add that path to the paths \`{{check}}\` opens. |
| `DEAD_REGISTRATION_MESSAGE_ID` | A row that allows an exception must not stand for files this repository does not hold. Row \`{{pattern}}\` of {{registry}} matches no authored path, and it states: {{reason}}. Delete the row, or move the pattern to the path that took the exception over. |
| `UNDECLARED_RECEIVER_MESSAGE_ID` | A record must not name a receiver this repository does not declare. {{record}} names \`{{receiver}}\`, and the declared checks are {{declaredChecks}}. Declare that receiver among them, or delete the record and take the duty back. |
| `UNREGISTERED_SCOPE_REACH_MESSAGE_ID` | A file that a registered file reaches must not stay outside the scope registration. \`{{reachingPath}}\` reaches \`{{reachedPath}}\`, and the registration for \`{{scope}}\` leaves it out. Register the reached path in that scope, or delete the coupling that reaches it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
