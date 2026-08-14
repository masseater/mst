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

A file under a directory named for specs that is neither a spec nor test data.

Only file names and directory names settle the targets. The repository tree is walked once, and each file's path is read from the front to see whether any directory separator matches a spec directory name (by default `test`, `tests`, `__tests__`, `spec`, `specs`, `__specs__`). The outermost match is the spec directory that file belongs to. The file name is then read for a spec suffix (by default `.test.ts`, `.test.tsx`) or a test data marker (by default the segment one before the extension being `assets`, with a stem remaining in front of it), and anything that is neither is reported.

**The contents are not read.** What the file exports, and whether anybody imports it, do not enter the judgment. What is watched is a third kind of file existing inside a spec directory at all.

Nested directories are covered. `test/support/clock.ts` is treated as belonging to `test`, and the spec directory named in the report is `test`. Directories themselves are not reported: only the files placed inside them are read, so a directory holding no files causes nothing.

Because the judgment runs on the file name alone, something like `assets.ts` — carrying the marker with no stem in front — is a third kind. A file matching neither convention, such as `.gitkeep`, is reported the same way. That follows straight from the invariant that a spec directory holds two kinds and no more; carving an exception brings back a third category of "files that match no convention but may be placed anyway".

The input to the walk is the repository tree itself, so which files fall inside the analysed glob does not affect the result. The only things left out of the walk are the names declared as unscanned directories (by default the places build output lands, such as `node_modules` and `dist`).

A report carries no position inside a file. A third-kind file that is found is tied to the workspace holding it — the directory of the nearest `package.json`, or the repository root if there is none — and reported against every file checked in that workspace. Since the address is not the offending file itself, a suppression comment placed inside that file does not clear the report, and suppressing it in another file of the same workspace leaves the rest still reporting.

In exchange, a report only appears once at least one file of that workspace has been visited by the linter. With the whole workspace outside the analysed set, no report appears. That follows from the oxlint JS plugin confining a report to a node inside the file currently being checked, while the walk itself is independent of the target selection, the per-file cache and incremental runs.

In a repository with no spec directory convention, this rule has no targets. It is a mechanism for detecting things earlier, not a premise the rest of this bundle stands on.

### The invariant

The first layer is that closing the import edge does not stop files from being created. Forbidding a spec from carving setup into another module and importing it still leaves the carved file placeable, and what can be placed gets placed — and eventually gets used together with the edges of coupling (multi-step re-exports, dynamic imports assembling their specifier, renamed bindings). Closing the edges while permitting the existence invites a hunt for the way around.

The second layer is that every discipline about test data rides on the file name. Test data needs an owning spec, may not be read by anyone but its owner, and holds static values alone. All of those target "a file whose name is judged to be test data". Allowing a third kind in a spec directory means dropping the marker from the name lifts all three demands at once. Fixing the placeable kinds at two removes the route of renaming out of the guidelines.

The third layer is that somebody opening the directory can tell what to read. This bundle keeps one spec file as a contract readable from that file alone. Holding the same shape at directory granularity says "what is here is the contracts and the data the contracts read", and removes the work of telling which files are the subject and which are the tools.

### Configuration

- `specDirectoryNames` (optional, a list of strings): the directory names treated as spec directories. Defaults to `["__specs__", "__tests__", "spec", "specs", "test", "tests"]`, and naming it **replaces** the default rather than adding to it. Each path separator is matched exactly. Handing over an empty list falls back to the default
- `specFileSuffixes` (optional, a list of strings): the suffixes recognised as a spec. Defaults to `[".test.ts", ".test.tsx"]`, and naming it replaces the default. Same name and meaning as in the other rules of this bundle, on the premise that one spelling holds across the repository
- `assetsNameMarkers` (optional, a list of strings): the words treated as the test data marker. Defaults to `["assets"]`, and naming it replaces the default. Matched exactly against the segment one before the extension
- `unscannedDirectories` (optional, a list of strings): directory names left out of the walk. Defaults to the places build output and history land, and naming it replaces the default. Same name and meaning as in the other rules that walk the repository tree

```jsonc
["error", { "specDirectoryNames": ["__tests__"], "specFileSuffixes": [".test.ts"] }]
```

There is no exemption list. "This one file may be a third kind" means a spec directory holds three kinds, which contradicts the invariant itself.

### Why it is not shipped by default

This rule only bites in a repository that carves its tests into spec directories. Where tests sit in the same directory as the source they test, there is no spec directory and no target. mst is in exactly that state: tests sit beside their subject as `<source name>.test.ts` ([AGENTS.md](../../../../AGENTS.md)).

Shipping a rule with no targets in the preset would leave it enabled while reporting nothing, and a rule that is enabled but watching nothing cannot be told, from the configuration alone, from a rule left out because the structure does not match. Leaving it out is the choice made here, and this document names the reason. A repository that does carve tests into spec directories turns it on by naming it in `rules`.

## Fix

Write the file's contents into the spec that uses it. Where the file exists because setup was carved out, this is the shape it should have had. Where several specs need the same contents, write it into each of them: in this bundle, being readable on its own outranks avoiding duplication.

Where the file holds static data alone, move it to a test data file carrying the same stem as the spec that reads it. The owning spec has to exist in the same directory.

Where the value is read by production code, move it out of the spec directory. That is where it belongs.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a file that is neither a spec nor test data is reported against the workspace holding it
export const held = true;

```

<!-- END GENERATED examples -->

The subject of this rule is what a spec directory holds rather than the source in front of you, so the code above is the file the report stands on, and what settles the judgment is which of the two kinds the file placed there is.

### Forbidden bypasses (do not do this)

- Faking the kind by matching the spec or test data convention in the name or extension. Claiming to be a spec brings a demand for a test that runs; claiming to be test data brings a demand for an owning spec of the same stem and for static contents. The conditions of whatever you claim come with it
- Moving it out of the spec directory and changing nothing but the location. The moment a spec couples to it, the rule closing the import of carved setup reports it
- Silencing it with a suppression comment. The report has no position inside the offending file, and the same report appears on every file of the workspace
- Taking that directory out of the analysed glob. The input to the walk is the repository tree, not the glob
- Removing that directory's name from `specDirectoryNames`. It stops being a spec directory at that moment, so the data its specs read leaves the owner convention and the carved setup is reported at the import edge
- Adding a directory that is not build output to the unscanned declaration. That declaration is for writing down where build output lands

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
