---
description: "Require a test file to sit in the directory of the source it tests under that source's name, so the pair is tied together by the path and a test cannot be left behind when its source moves"
---

# no-detached-test-file--move-beside-source

<!-- BEGIN GENERATED rule-header -->

Require a test file to sit in the directory of the source it tests under that source's name, so the pair is tied together by the path and a test cannot be left behind when its source moves

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: yes
- Shipped in the preset: yes
- Source: [`no-detached-test-file--move-beside-source.ts`](../../src/lint/oxlint/rules/no-detached-test-file--move-beside-source.ts)

<!-- END GENERATED rule-header -->

## Violation

Two things are read of every file taken to be a test file.

The main judgment is whether the source file, named by dropping the suffix, exists **in the same directory**. A test parked in an isolation directory and a test whose subject no longer exists are both caught here. To the writer those are two different accidents; on the file system they have the same shape.

The search stays inside the one directory. The repository is not walked to tell "it is in another directory" from "it is nowhere", so the report collapses into one kind, and the message carries the path that was looked for and not found.

The secondary judgment is whether a directory name that marks a test-only tree (`test`, `tests`, `__tests__`, `spec`) appears anywhere on the path. It may sit at any position, not only directly above (`spec/nested/buried.test.ts` counts). The main judgment catches most of it, but placing the source inside the test tree as well makes the stems match and slips past, so the directory name closes that from the other side.

Where the main judgment fires, the secondary is not read. One report is raised per file, covering the whole file (the Program node), because there is no line to point at inside it.

Whether a file is a test file is settled by the suffix in its name. The default vocabulary is `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`, which includes the suffixes the test runner actually picks up, so a detached test written in a vocabulary this repository does not use is not passed over. Where several suffixes match, the longest is taken. A name with no separating dot, such as `contest.ts`, does not qualify.

The source file's name is the suffix dropped and the extension that suffix carries put back. `foo.test.ts` looks for `foo.ts` alone, and `foo.test.tsx` for `foo.tsx` alone. `widget.test.tsx` is reported even with `widget.ts` beside it, because what it is looking for is `widget.tsx`. Extension differences are not absorbed, so the pairing stays one to one.

Whether the subject exists is asked of the file system, and the answer is remembered for as long as the process lives. Asking about the same path twice reaches the file system only the first time, so creating the subject mid-run does not change that process's answer; the next run does.

A test existing is not required. A source file with no test is not reported. Making tests be written belongs to another rule, and folding it in here would leave both violations controllable only through one setting.

### The invariant

The first layer is putting the correspondence outside human memory and tool configuration. With tests in another tree, "does this implementation have a test" is only answerable by solving, in your head, the rule that turns an implementation path into a test path. That rule is written nowhere, and where it is written nothing guarantees it matches the actual layout. Side by side, opening the implementation puts the test in the same directory listing, so confirming its presence takes no translation at all.

The second layer is that the translation rule breaks when an implementation moves, and the break does not turn red. Where the path correspondence exists only as a rule, moving an implementation to another directory severs it, and severing it fails nothing on the spot — fixing the import paths keeps it passing. Tests that go on verifying the old behaviour of an implementation nobody calls, and tests left behind after their subject is gone, accumulate without ever failing.

The third layer is that more vocabulary for placement scatters globs across the configuration files. With tests living in several places, the coverage targets, the build exclusions, the type check targets and the lint targets each write their patterns on a different premise. A configuration updated for only one vocabulary appears, and holes — a file meant to be excluded being measured, a file meant to be targeted not being linted — stay invisible to anyone reading any one configuration on its own. Fixing the location to one removes the room for that scattering.

This is a discipline about directory layout and does not mean a test may reach into an implementation's internals. Sitting side by side and verifying only published behaviour are independent.

### Configuration

- `testFileSuffixes` (optional, a list of strings): the suffixes taken to mark a test file. They are **added** to the defaults (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) rather than replacing them, so the defaults never disappear quietly through a missed copy. Each entry is a literal suffix matched against the end of the file name, and case is significant
- `exemptPaths` (optional, a list of strings): paths held outside the invariant. Each entry is a run of path segments, matching where that run appears consecutively anywhere on the path. Matching is on segment boundaries, so `e2` does not match `e2e`

```jsonc
["error", { "testFileSuffixes": ["-test.ts"], "exemptPaths": ["apps/website/e2e"] }]
```

Forbidding a suffix — keeping the wrong ones from being used — is not carried here. "Do not use this suffix" is a discipline about names, while this one is about placement. This rule takes responsibility for _recognising_ a wrong suffix as a test, and leaves permitting the name to another rule. One rule judging placement and naming together would mean loosening one loosens the other with it.

There is no per-file exclusion list. Since the discipline means something over the whole tree, "exempt this one file" does not stand.

The directory names of the secondary judgment are fixed in the rule and cannot be changed by configuration.

## Fix

Where the subject exists somewhere, move the test file into that implementation's directory and match its name. The imports become relative within one directory, usually getting shorter for it.

Where the subject no longer exists, find out which module now owns the behaviour that test was verifying. Where it moved, fold the test into that module's test. Where the behaviour is gone, delete the test too.

Where the test has no single subject — verifying behaviour across several modules — the problem is not the placement but that the behaviour being verified has no owner. Build one file as the entrance gathering that behaviour and put the test beside it. Where no entrance can be built, the behaviour has not been named as one thing, so design the subject before the test. Where the placement genuinely has to be exempt after all, write it into `exemptPaths`.

Where the secondary judgment reported, the test is not the only thing that moves. The implementation is inside the test tree, so return it beside the modules that use it, taking the test along.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// a test file parked in an isolation directory is reported
export const total = 1;
```

```ts
// a source moved into the test tree to satisfy the pairing is reported on its own message
export const total = 1;
```

Code this rule accepts.

```ts
// a test file whose source sits beside it under the same name passes
export const total = 1;
```

```ts
// a path the deployment exempts is left out of the invariant
export const total = 1;
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Placing an empty file at the expected path to get through. The judgment reads existence alone so it passes, and what is left is a test with no subject and an empty module nobody imports — none of the original problem solved
- Shifting the name out of the rule's reach, by switching to `.spec.ts` or dropping `.test`. Only the detection stops; nothing changes about the test being left behind. If a rename alone got it through, that is a signal the judgment leans too hard on the name: fix the judgment rather than the escape
- Placing a dummy of the same name inside the isolation directory and lining the test up beside it. The directory structure doubles, and the copy does not follow when the real subject moves
- Moving the implementation over to the test to make them cohabit. Side by side is satisfied while the implementation's location is being decided by the test's convenience. What moves is the test, not the implementation. The secondary judgment catches this
- Widening `exemptPaths` until it swallows a whole tree. The classic shape is a pattern written meaning "just the one directory for E2E" that in fact exempts everything under it. Keep an exemption narrow enough to be settled by reading the entry alone
- Silencing that one file with a suppression directive. Placement is a discipline over the whole tree rather than one file's convenience, so an exemption per file is that discipline being voided

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `detachedTestFile` | A test file must not sit apart from the source it tests. Nothing exists at \`{{sourcePath}}\`. Move this file into the directory of the source it tests and name it after that source. |
| `testOnlyDirectory` | A test file must not sit under a directory that exists only to hold tests. This file sits under \`{{directory}}\`. Move the source it tests back among the modules that use it, and move this file with it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads options declared on `meta.schema` in the source linked above.

<!-- END GENERATED runtime -->
