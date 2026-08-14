---
description: "Require a spec that derives tests from `standardIoTest` to pin both captured streams with a snapshot, so every change to what the command prints surfaces as a diff"
---

# require-standard-io-snapshot--pin-both-streams

<!-- BEGIN GENERATED rule-header -->

Require a spec that derives tests from `standardIoTest` to pin both captured streams with a snapshot, so every change to what the command prints surfaces as a diff

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`require-standard-io-snapshot--pin-both-streams.ts`](../../src/lint/oxlint/rules/require-standard-io-snapshot--pin-both-streams.ts)

<!-- END GENERATED rule-header -->

## Violation

A file deriving its tests from `standardIoTest` that is missing a snapshot of either captured stream. The demand is one snapshot assertion, for stdout and for stderr each, whose subject is a value that reaches that stream, and either `toMatchInlineSnapshot` or `toMatchSnapshot` satisfies it.

Whether a value reaches a stream is settled from the identifier at the root of the snapshot's subject. A root that is the stream binding itself (`stdout`, `stderr`) reaches that stream. A root that is a fixture declared in this file is followed through the names that fixture took as dependencies, to see whether a stream is arrived at. The chain of dependencies has no depth limit, and arriving is enough to count.

The judgment is not made on the spelling. Accepting only a particular member read (a shape such as `expect(stdout.text)`) would collide with the neighbouring rule that forbids projecting the value a fixture hands over, leaving a spec that can satisfy neither demand.

Derivation is settled from calls to the imported `standardIoTest`, renamed imports included, and a modified call such as `standardIoTest.skip` counts as derivation too. A form derived into a binding, as `const it = standardIoTest.extend(...)`, is tracked through calls on that binding as well, and so is a chain of derivations — a binding that `extend`s a binding that was itself derived. One report is raised per missing stream, at the position of the first derivation call.

A file that does not use the fixture is asked for nothing.

### The invariant

A CLI's stdout and stderr are a contract with the user. Even with `standardIoTest` capturing them, with the captured text pinned nowhere the output can change into anything while every assertion keeps passing. What is left is the appearance of verification because something is being captured.

A content assertion such as `toContain` guards only the fragment the writer had in mind. One snapshot of the whole stream makes the changes the writer did not have in mind — a progress display leaking in, warnings appearing or disappearing, a trailing newline moving — show up as a snapshot diff. Both streams are demanded because what tends to fall outside anyone's attention is usually the other stream.

### What is not a violation

- Content assertions standing beside the snapshots. The division where the snapshot guards the whole and the content assertion guards the intent is welcome
- A file that neither imports nor uses `standardIoTest`
- Tests using only one of the streams being mixed in. The demand is per file, not per test

Where the machine reaches and where the discipline reaches are not the same. Detection is the floor under the invariant, not the ceiling.

### Configuration

None.

## Fix

Add a test pinning each stream. Keep the run inside the fixture and let the `it` take the stream binding itself as the subject.

```ts
import { standardIoTest } from "@mst/dont-review-it/vitest";

const it = standardIoTest.extend("theRunOfTheCommand", { auto: true }, () => {
  runTheCommand(["--help"]);
});

it("pins what the run put on standard output", ({ stdout }) => {
  expect(stdout).toMatchInlineSnapshot();
});

it("pins what the run put on standard error", ({ stderr }) => {
  expect(stderr).toMatchInlineSnapshot();
});
```

The stream binding can stand as the subject because it carries only the chunks that were written, as an enumerable surface. What appears in the snapshot is what was written; the folding into text and the intake for writes do not.

To pin it in text form, fold it inside the fixture and make that binding the subject.

```ts
const it = standardIoTest.extend("theStandardOutputOfTheRun", ({ stdout }) => {
  runTheCommand(["--help"]);
  return stdout.text();
});

it("pins what the run put on standard output", ({ theStandardOutputOfTheRun }) => {
  expect(theStandardOutputOfTheRun).toMatchInlineSnapshot();
});
```

Where the output mixes in values that change per run, such as a temporary path, and cannot be snapshotted, snapshot an invariant route those values do not reach — a deterministic violation message, say — and cover the varying route with content assertions.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// pinning stdout alone leaves stderr unpinned
import { standardIoTest } from "@mst/dont-review-it/vitest";
standardIoTest("pins stdout", ({ stdout }) => {
  expect(stdout.text).toMatchInlineSnapshot();
});
```

```ts
// a snapshot rooted at a binding unrelated to the streams pins neither of them
import { standardIoTest } from "@mst/dont-review-it/vitest";
standardIoTest("snapshots an unrelated subject", ({ stdout, stderr }) => {
  expect(buffer.text).toMatchInlineSnapshot();
});
```

Code this rule accepts.

```ts
// the stream bindings standing as the subjects pin both streams
import { standardIoTest } from "@mst/dont-review-it/vitest";
const it = standardIoTest.extend("theRun", { auto: true }, () => {
  runTheCli();
});
it("pins stdout", ({ stdout }) => {
  expect(stdout).toMatchInlineSnapshot();
});
it("pins stderr", ({ stderr }) => {
  expect(stderr).toMatchInlineSnapshot();
});
```

```ts
// a stream reached through a chain of fixtures still counts as pinned
import { standardIoTest } from "@mst/dont-review-it/vitest";
const it = standardIoTest
  .extend("theRun", ({ stdout }) => runTheCli(stdout))
  .extend("theOutcomeOfTheRun", ({ theRun }) => theRun.settle())
  .extend("theStandardErrorOfARun", ({ stderr }) => {
    runTheCli();
    return stderr.text();
  });
it("pins stdout through the chain", ({ theOutcomeOfTheRun }) => {
  expect(theOutcomeOfTheRun).toMatchInlineSnapshot();
});
it("pins stderr", ({ theStandardErrorOfARun }) => {
  expect(theStandardErrorOfARun).toMatchInlineSnapshot();
});
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Renaming the fixture binding (`({ stdout: out })`) to escape the static judgment of the subject. Nothing changes about it not being pinned
- Snapshotting a value that reaches no stream to satisfy the count. The root of the subject is followed, so a value whose chain of dependencies never arrives at a stream does not satisfy it
- Placing a snapshot in an empty test to meet the demand without going through the real run. What gets pinned is an empty record, and the contract is unguarded

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `missingSnapshot` | A spec that derives tests from \`standardIoTest\` must not leave \`{{name}}\` unpinned. Add a test taking \`{{name}}\` as its subject and pinning it with \`toMatchInlineSnapshot()\`, or pin a fixture that reads from it. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
