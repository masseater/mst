---
description: "Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it"
---

# forbid-symbol-prefixed-name--rename-to-alphanumeric-start

<!-- BEGIN GENERATED rule-header -->

Require every directory and file name on the path of a linted file to start with a letter or a digit, so nothing sits where a glob walk never reaches it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts`](../../src/lint/oxlint/rules/forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts)

<!-- END GENERATED rule-header -->

## Violation

A segment of the checked file's path, relative to the working directory the lint started from, whose first character is not `[A-Za-z0-9]`. Directory names and file names are read alike, each offending segment is reported once, and a file outside the working directory is not judged.

The condition is an allowance rather than a list of forbidden openings, so `_`, `.`, `@`, `~` and anything else a glob walk can miss are covered without enumerating them. `allowedNames` holds the names a tool requires as a convention; an entry matches a whole segment, `*` stands for any run of characters, case is significant, and an allowance does not propagate to the names under it.

## Fix

Rename the segment to start with a letter or a digit. Symbols after the first character are fine, so `_internal` becomes `internal` and `@entry.ts` becomes `entry.ts`.

Where the name marked something as internal, express that through the package's `exports` instead. Where a framework genuinely requires the name, add it to `allowedNames` in the configuration owned by whoever owns those files.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a directory name starting with an underscore is reported
// in packages/lint-rule-authoring/_internal/helper.ts
const total = 1;
```

```ts
// an allowed name does not carry the allowance down to the names under it
// in packages/_ui/_legacy/index.ts
const total = 1;
```

Code this rule accepts.

```ts
// every segment of a nested path starts with a letter
// in packages/lint-rule-authoring/src/lint/oxlint/rules/some-rule.ts
const total = 1;
```

```ts
// a name the deployment listed is allowed to start with a symbol
// in .config/tooling/setup.ts
const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming to another symbol-prefixed name. The new name is the same violation
- Adding a name to `allowedNames` for a category you invented. The list is for names a tool requires as a specification
- Suppressing the report. It stands per file, so one line removes it while the directory still slips past every other tool's glob

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `symbolPrefixedSegment` | A directory or file name must not start with anything other than a letter or a digit. The name \`{{segment}}\`, on the path \`{{path}}\`, starts with something else. Rename that one name to start with a letter or a digit. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
