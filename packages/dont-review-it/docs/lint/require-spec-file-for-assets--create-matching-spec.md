---
description: "Require every test data file to sit beside a spec of the same stem, so the data has one owner that reads it and leaves the repository with the test that gave it a reason to exist"
---

# require-spec-file-for-assets--create-matching-spec

<!-- BEGIN GENERATED rule-header -->

Require every test data file to sit beside a spec of the same stem, so the data has one owner that reads it and leaves the repository with the test that gave it a reason to exist

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`require-spec-file-for-assets--create-matching-spec.ts`](../../src/lint/oxlint/rules/require-spec-file-for-assets--create-matching-spec.ts)

<!-- END GENERATED rule-header -->

## Violation

A file of test data with no spec of its own standing beside it in the same directory.

Whether a file is test data is settled from its name alone. Split the name on dots: the segment one before the extension has to be a marker word (`assets` by default) and a stem has to remain in front of it. `order.assets.ts` qualifies. `assets.ts` does not, because the stem is empty — that is a module named `assets`, not test data. `order.assets.test.ts` does not either: what stands before the extension is `test`, not the marker, so the name is read as a spec.

What extension follows the marker is left out of the judgment. `order.assets.mts` and `order.assets.json` are both treated as test data, so that swapping the extension is not a way to step out of the guideline. A report, however, only comes out for files the linter visited to parse. `.mts` is visited and reported; `.json` is not visited, so the judgment applies while no report appears.

The owner is exactly one file: a spec of the same stem in the same directory. The stem is everything in front of the marker, so the stem of `vite.config.assets.ts` is `vite.config`. Every name formed by adding a spec suffix to the stem is looked for, and one of them existing as a file is enough for an owner to exist. Finding a directory under that name does not count, so that placing a directory of the same name cannot stand in as the owner.

**Only existence is read; the contents are not.** An owner that is empty passes this rule. Whether the contents hold a test that runs belongs to `require-test-block-for-spec-file--add-test-or-delete-file`, and folding that in here would leave "no owner" and "the owner is empty" controllable only through one setting. Placing an empty spec whose name merely matches is closed off only once both rules stand.

The report covers the whole file (the Program node), because there is no line inside it to point at.

The judgment runs **per visited file**. Taking a file out of the analysed set therefore keeps this rule from firing, and test data in a format the linter does not parse, such as JSON, goes unreported for the same reason. Moving an existence check onto a walk of the repository tree, independent of which files are targeted, cannot be done by a rule alone, because the oxlint JS plugin confines a report to a node inside the file currently being checked. The ownership judgment itself is written as a pure function of the visited file's path and the file system, so it can be called as it stands once an entry point that walks the tree is added.

### The invariant

The first layer is that nobody can fix data that has no owner. Whether test data may be rewritten follows from what the test reading it expects. With exactly one reader, that one file settles it. With no reader, it is not that the grounds are missing — there is no reason to decide at all. The file stays in the repository with no way anywhere to confirm whether its values are right.

The second layer is that an owner existing is what the "one reader" discipline stands on. Keeping test data from being read by anyone but its owner only means something once the owner exists. A file with no owner looks, from that discipline's angle, like something nobody owns and therefore anyone may read. With both the existence requirement and the single-reader requirement carried by machines, the same one spec is the owner from either angle.

The third layer is that data outlives the tests. Deleting a test and forgetting to delete the separate file it read turns nothing red. A few rounds of that and the directory fills with files that cannot answer when they were written, what they were confirming, or whether they are still right. With existence required by a machine, the moment a test is deleted the data surfaces as an orphan.

### Configuration

- `assetsNameMarkers` (optional, a list of strings): the words treated as the test data marker. Defaults to `["assets"]`, and naming it **replaces** the default rather than adding to it. Each entry is matched exactly against the segment one before the extension. Handing over an empty list falls back to the default
- `specFileSuffixes` (optional, a list of strings): the suffixes recognised as an owning spec. Defaults to `[".test.ts", ".test.tsx"]`, and naming it replaces the default. It carries the same name and meaning as in the other rules of this bundle, on the premise that one spelling holds across the repository

```jsonc
["error", { "assetsNameMarkers": ["assets"], "specFileSuffixes": [".test.ts"] }]
```

There is no exemption list. "This one file may go without an owner" means data without an owner is acceptable, which contradicts the discipline itself. The same goes for a suppression directive: a report disappearing has nothing to do with an owner appearing.

## Fix

Write a spec that reads the data and confirms something with it, and name the file after the data's stem. Where the data really is used in a verification, this is the shape it should have had.

If you cannot write one, the data is not used in any verification. Where a spec does read the values, write them into that spec and delete the data file. Where no spec reads them, delete the file.

If the file was split out because the data is too large to stay readable inside the spec, keep it split and write the owner. Size is a reason to split a file; wanting to share it across several specs is not.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// test data with no spec of its stem anywhere
export const orderTotals = [1, 2];
```

```ts
// a spec of the same stem in another directory does not own this data
export const orderTotals = [1, 2];
```

Code this rule accepts.

```ts
// test data owned by the spec of the same stem beside it
export const orderTotals = [1, 2];
```

```ts
// a module named after the marker alone names no stem to own it
export const orderTotals = [1, 2];
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Placing an empty spec whose name merely matches. The existence check passes and the rule that requires a test which runs reports it. Ownership means somebody actually confirms something with the data, not that files of the same stem stand side by side
- Having a spec of another stem read it and calling that "used". Being read and being owned are different. A form where somebody other than the owner reads it is reported by the rule that narrows test data to one reader
- Placing a spec of the same stem in another directory and claiming ownership. Ownership is judged on the directory and the stem together. A same-named spec elsewhere owns its own data and knows nothing about this one
- Changing the extension to step out of the guideline. What follows the marker is left out of the judgment, so turning `.ts` into `.mts` does not clear the report
- Dropping the marker from the name to look like an ordinary module. It leaves this rule's reach and becomes a module read only from a spec, which the rule closing off carved-out setup receives
- Adding one more segment behind the marker to push the marker away from the extension. The judgment shifts, and the name is then either a spec suffix or a third kind belonging to neither guideline. The first is required to hold a test that runs; the second is reported as a wrong kind inside a spec directory
- Emptying `assetsNameMarkers` to remove the targets. An empty list falls back to the default, so nothing is removed. Naming a word that never occurs empties the targets, but that is the same as turning the rule off, not exempting one file while it stays on

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `unownedAssets` | A test data file must not sit in a directory that holds no spec of its own stem. Nothing named {{ownerNames}} sits beside it. Write the spec that reads this file and name it after the stem this file already carries, or move these values into the spec that reads them and delete this file. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
