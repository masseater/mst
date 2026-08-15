---
description: "Disallow splitting a file into siblings distinguished only by a number, so every file name states the responsibility that file owns"
---

# forbid-numbered-sibling-file--name-what-each-file-owns

<!-- BEGIN GENERATED rule-header -->

Disallow splitting a file into siblings distinguished only by a number, so every file name states the responsibility that file owns

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`forbid-numbered-sibling-file--name-what-each-file-owns.ts`](../../src/lint/oxlint/rules/forbid-numbered-sibling-file--name-what-each-file-owns.ts)

<!-- END GENERATED rule-header -->

## Violation

A file whose base name ends in a separator and a number (`parse-1.ts`, `parse_2.ts`) while the same directory holds either another file under the same prefix and a different number, or the file the prefix names without one. The report carries the sibling it found.

## Fix

List what each file owns and rename each after what it owns. Where the split had no responsibility behind it, fold the files back into one.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// two files that differ only by an ordinal are one responsibility in two places
export const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Moving one of the siblings into another directory. The numbers still stand in for names nobody chose
- Replacing the number with a word that carries no responsibility (`parse-extra.ts`). Detection stops, the split does not

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `numberedSiblingFile` | Splitting a file into siblings that differ only by a number is forbidden. \`{{sibling}}\` sits in this directory under the same name with a different number. List what each file owns and rename each file after what it owns. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
