---
description: "Require every file under a directory named for specs to be a spec or the test data one of those specs owns, so setup carved out of a spec is reported where it sits instead of only where a spec imports it"
---

# require-spec-or-assets-only-in-spec-directory--move-out-or-inline

<!-- BEGIN GENERATED rule-header -->

Require every file under a directory named for specs to be a spec or the test data one of those specs owns, so setup carved out of a spec is reported where it sits instead of only where a spec imports it

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: no
- Source: [`require-spec-or-assets-only-in-spec-directory--move-out-or-inline.ts`](../../src/lint/oxlint/rules/require-spec-or-assets-only-in-spec-directory--move-out-or-inline.ts)

<!-- END GENERATED rule-header -->

## Violation

A file under a directory named for specs that is neither a spec nor test data. `specDirectoryNames`, `specFileSuffixes`, `assetsNameMarkers` and `unscannedDirectories` settle which directories are read and what counts as either kind.

This rule is not in the shipped preset. A consumer names it in `rules` to turn it on.

## Fix

Write what the file holds into the spec that reads it, move its static values into a test data file carrying that spec's stem, or move it out of the directory into the production code that reads it.

Renaming it to claim either kind brings that kind's conditions with it: a spec has to hold a test that runs, and test data has to have a spec of its stem beside it and hold nothing but static values.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a file that is neither a spec nor test data is reported against the workspace holding it
export const held = true;

```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the file as a spec while it holds no test
- Adding its directory to `unscannedDirectories` so the setup keeps its place unread

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `FOREIGN_FILE_IN_SPEC_DIRECTORY_MESSAGE_ID` | A directory named for specs must not hold a file that is neither a spec nor test data. \`{{foreignPath}}\` sits under \`{{specDirectory}}\`, which holds only files named {{specNames}} and files named {{assetsNames}}. Write what this file holds into the spec that reads it, move its static values into a test data file carrying that spec's stem, or move it out of \`{{specDirectory}}\` into the production code that reads it. Renaming it to claim either kind brings that kind's conditions with it: a spec must hold a test that runs, and test data must have a spec of its stem beside it and hold nothing but static values. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
