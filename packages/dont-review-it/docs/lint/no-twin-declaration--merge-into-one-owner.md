---
description: "Disallow a declaration that another declaration in the repository spells with the same name and the same body, so one concept keeps one owner however small the body is"
---

# no-twin-declaration--merge-into-one-owner

<!-- BEGIN GENERATED rule-header -->

Disallow a declaration that another declaration in the repository spells with the same name and the same body, so one concept keeps one owner however small the body is

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Bundle: `single-ownership`
- Source: [`no-twin-declaration--merge-into-one-owner.ts`](../../src/lint/oxlint/rules/single-ownership/no-twin-declaration--merge-into-one-owner.ts)

<!-- END GENERATED rule-header -->

## Violation

A declaration that another declaration in the repository spells with the same name and the same body. No lower bound is placed on the size of the body: with the name matching too, a match is not a coincidence.

Bodies are compared as syntax with positions dropped, and test sources are outside the index. Where the body is large enough, [no-duplicated-body--import-the-existing-declaration](./no-duplicated-body--import-the-existing-declaration.md) reports the same pair, and one owner clears both.

## Fix

Decide which module owns the concept, export it from there, and import it everywhere else.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a declaration the index places past the end of the file is reported on the file
const MANIFEST_FILE_NAME = "package.json";
```

Code this rule accepts.

```ts
// a declaration that shares only its body with another one passes
const PACKAGE_FILE_NAME = "package.json";
```

```ts
// a declaration that shares only its name with another one passes
const MANIFEST_FILE_NAME = "pnpm-workspace.yaml";
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming one side. What is left is two names for one body, which the body-matching rule takes
- Moving one side into a test file. That the index skips tests is not a place to hide duplication

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `twinDeclaration` | A declaration must not carry both the name and the body of another declaration in this repository. The same declaration stands at {{sites}}. Decide which module owns the concept, export it from there, and import it everywhere else. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
