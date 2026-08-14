---
description: "Disallow a spec that assembles its own stdout or stderr test double, so stream capture is solved once by the shared `standardIoTest` fixture"
---

# no-handmade-standard-io-double--use-standard-io-test

<!-- BEGIN GENERATED rule-header -->

Disallow a spec that assembles its own stdout or stderr test double, so stream capture is solved once by the shared `standardIoTest` fixture

- Tool: `oxlint`
- Fixable: no
- Suggestions: no
- Options: no
- Shipped in the preset: yes
- Source: [`no-handmade-standard-io-double--use-standard-io-test.ts`](../../src/lint/oxlint/rules/no-handmade-standard-io-double--use-standard-io-test.ts)

<!-- END GENERATED rule-header -->

## Violation

A test file (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`) assembling a test double for stdout or stderr of its own. Three families are reported.

1. A fixture definition `*.extend({ ... })` declaring a name of `stdout` or `stderr`. The builder form handing the name over as a string in the first argument (`*.extend("stdout", ...)`) counts as the same redeclaration. A file importing the shared fixture is reported all the same once it declares one again
2. A direct reach for `process.stdout` or `process.stderr`, whether to spy on it or to write to it. A file that has imported `standardIoTest` is exempt: with the capture settled in one shared fixture, letting the code under test write to the stream is exactly what should happen
3. A property named `stdout` or `stderr` handed an object literal carrying a `write` method, or a stream instance such as `new PassThrough()`. That is the shape of injecting a hand-built fake stream into the code under test

Nothing is reported outside test files. The implementation of the shared fixture is where capturing a stream is assembled, and it is out of this rule's reach.

### The invariant

A test double for a standard stream always drags along the same incidental work: swapping the capture in, decoding the chunks, restoring the stream afterwards. Assembled per spec, that incidental work becomes as many implementations as there are specs, each with quirks of its own — a missed restore, a different encoding, interference under parallel runs. A fix found in one spec does not reach the others.

That work is the kind of problem to be solved once, and the solution is the `standardIoTest` fixture in `@mst/dont-review-it/vitest`. What is left to the spec is running the test and checking the captured text.

### What is not a violation

- A spec that imported `standardIoTest` writing to `process.stdout` or `process.stderr` through the code under test
- An `extend` fixture under a name unrelated to streams, such as `repository`
- A property named `stdout` holding something that is not a write target, such as a string. Handing the captured result around is not the same shape
- `process` members other than the two captured streams, such as `process.exitCode` and `process.env`

Where the machine reaches and where the discipline reaches are not the same. Detection is the floor under the invariant, not the ceiling.

## Fix

Import `standardIoTest` and derive the test from it. The captured text is read from the fixture's `text`.

```ts
import { standardIoTest } from "@mst/dont-review-it/vitest";

standardIoTest("hands the subject everything written to stdout", ({ stdout }) => {
  process.stdout.write("progress line\n");

  expect(stdout.text).toBe("progress line\n");
});
```

Where a stream was being injected into the code under test, stop injecting it: let the code write to `process.stdout` or `process.stderr` and let the fixture capture it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an extend fixture named stdout is a handmade double
// in /repo/src/cli.test.ts
const ioTest = test.extend({
  stdout: async ({}, use) => {
    await use([]);
  },
});
```

```ts
// a stdout-shaped object with a write method is an assembled double
// in /repo/src/cli.test.ts
const deps = { stdout: { write: () => true } };
```

Code this rule accepts.

```ts
// a spec that imports the fixture may exercise the process streams directly
// in /repo/src/cli.test.ts
import { standardIoTest } from "@mst/dont-review-it/vitest";
standardIoTest("captures", ({ stdout }) => {
  process.stdout.write("result");
  expect(stdout.text).toBe("result");
});
```

```ts
// a stream-named property holding plain data is not a double
// in /repo/src/cli.test.ts
const result = { stdout: "captured text", stderr: "" };
```

<!-- END GENERATED examples -->

### Forbidden bypasses (do not do this)

- Binding the fake stream to a variable first and handing that to the property, to escape the judgment made on the shape of the value. What is being assembled has not changed
- Writing a module of your own named `standardIoTest` and importing it to satisfy the exemption alone. The exemption rests on trusting the shared fixture's implementation, not on the name
- Assembling a test double for stdin. The fixture provides stdout and stderr today, so the machine does not detect it, and it is a violation of the same kind. When capturing stdin is needed, add it to the shared fixture rather than assembling it in a spec

## Messages

<!-- BEGIN GENERATED messages -->

| messageId | Text |
| --- | --- |
| `ownFixture` | A spec must not declare a \`{{name}}\` fixture of its own. Import \`standardIoTest\` from \`@mst/dont-review-it/vitest\` and derive the test from it. |
| `directStream` | A spec must not reach \`process.{{name}}\` by hand. Import \`standardIoTest\` from \`@mst/dont-review-it/vitest\`; its \`{{name}}\` fixture hands the captured stream to the test. |
| `streamShapedDouble` | A spec must not assemble a \`{{name}}\`-shaped write double. Import \`standardIoTest\` from \`@mst/dont-review-it/vitest\` and assert on its \`{{name}}\` fixture instead. |

<!-- END GENERATED messages -->

## Runtime Selection

<!-- BEGIN GENERATED runtime -->

This rule runs as an oxlint JS plugin, in the same pass as every other rule the workspace ships. It reads no options. A consumer turns it on or off as a whole.

<!-- END GENERATED runtime -->
