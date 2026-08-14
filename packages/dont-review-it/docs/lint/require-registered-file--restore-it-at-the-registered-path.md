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
- Shipped in the preset: yes
- Source: [`require-registered-file--restore-it-at-the-registered-path.ts`](../../src/lint/oxlint/rules/require-registered-file--restore-it-at-the-registered-path.ts)

<!-- END GENERATED rule-header -->

## Violation

A row of the required-file table that has fallen into any of these is reported.

- Not one file matches the registered path
- Files match, but every one of them is empty
- The row names an owner, and not one workspace answers to that name

The first two are two appearances of the single state "the registration is unmet"; the third is a separate diagnosis, that the row itself is stale. Report the third as an absence and the reader is sent to the wrong repair of creating a file.

The input to the judgment is the result of walking the working tree. A pattern written in a row is read relative to the repository root, and on a row carrying an owner it is read relative to the directory of each workspace answering to that owner. Where one matching file carries contents, the row is met. Where only empty files matched, each matched path is reported.

Emptiness is settled by whether the contents read are whitespace alone. A file holding a single newline counts as empty. What the contents are is not read.

### Where the report stands

The report goes to the workspace the file under check belongs to. A row carrying an owner goes to that workspace; a row carrying none goes to the workspace at the repository root. Where the file under check is governed by no manifest, nothing comes out: with no workspace to belong to, there is no settled recipient either.

This rule reads no syntax, so the report stands at the head of the file.

There are two states with no recipient. A row carrying no owner has no recipient settled unless a manifest governs the repository root. Where every file of a workspace falls off the checking route, not one row aimed at that workspace comes out. Both look exactly like "no violation" in the output, and are invisible from this rule's side. Paths off the checking route, and registered rows no route reaches, are taken by [no-unchecked-authored-path--include-it-in-every-declared-check](./no-unchecked-authored-path--include-it-in-every-declared-check.md).

### Deliberately not widened

| Shape | Why it is left out |
| --- | --- |
| Whether the registered file's contents meet a requirement | The judgment differs per subject. The row names the check, and that check takes it |
| The absence of an unregistered path | This table guesses at no "absence that looks risky" |
| Thin contents in a file that is not empty | The non-empty check passes. Unless the row names a check, nobody looks past that |
| A directory inside the walk's exclusions | The decision not to walk where build output and dependencies live is held in one place, by the walk |

### The invariant

What is held is that a file decided to have to be there by the structure of the repository is there, at the registered path.

The first layer is that an absence carries no input. A file that must not exist gives the check its input by the very fact of being placed. An absence is the reverse: nobody goes to look at a place where there is nothing. The less often a file is used, the later its disappearance is noticed.

The second layer is that the route by which it disappears is built into the deletion decision itself. A file referenced from a configuration file or an external tool turns up no use sites when the source is searched. Since finding no use site is what grounds the deletion, "delete carefully" does not stop it. There is no way other than putting the demand for existence on the machinery's side.

The third layer is not to leave whoever reads the table thinking only prohibitions can be written. A prohibition of existence and a demand for one are written as rows of the same shape. Leaving a registration with the direction reversed without a recipient distorts how the table is used at all.

### Configuration

`requiredFiles` is the required-file table. Not handed over, and when empty, this rule reports nothing. What is required is held by the configuration; the rule holds the detection alone.

A row carries four items.

- `pattern`: the path to register. A glob may be written. Required
- `reason`: why that file is needed. It is set into the report. Required. Let the place for the reason drift away from the row and the demand stays while the reason goes stale
- `owner`: the workspace directory answering as owner. A glob may be written. A row omitting it becomes one demand against the repository root
- `contentChecks`: the names of the checks reading that file's contents. From a row omitting it, the table reads that existence and non-emptiness are all that is guaranteed

```json
{
  "requiredFiles": [
    {
      "pattern": "docs/lint/*.md",
      "owner": "packages/*",
      "reason": "it is where the document a report points at is reached",
      "contentChecks": []
    }
  ]
}
```

`unscannedDirectories` is the directory names the walk does not enter, defaulting to where dependencies, build output, caches and coverage output live. That default is held by the working-tree walk, and every check using the walk reads the same source. Give each walk its own exclusions and where a check is looking changes from check to check.

## Fix

Create the file at the registered path and write what the row asks for.

Where it is judged no longer needed, delete the row rather than create the file. Which was chosen, and why, stays in the commit log. The report carries the row's reason as written so that this decision can be made without opening the table.

Where it is reported that no workspace answers to the owner, delete the row, or rewrite the owner to point at the workspace that took the demand over.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a registered path with nothing at it is reported against the repository root
export const shipped = true;

```

<!-- END GENERATED examples -->

The subject of this rule is the paths the working tree holds rather than the source in front of you, so the code above is the file the report stands on, and what settles the judgment is what stands at the registered path.

### Forbidden bypasses (do not do this)

- Placing an empty file only to pass the check. Empty is reported as a violation
- Placing meaningless contents only to pass the check. The non-empty check passes, so this bypass is not stopped by this rule. To stop it, name in the row a check that reads the contents, and let that check take it
- Turning a row off for the time being. A row turned off is exactly the state of "registered, and not one report comes out"
- Silencing it with a suppression directive. [no-silent-suppression--fix-or-justify-inline](./no-silent-suppression--fix-or-justify-inline.md) takes that

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
