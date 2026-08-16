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
- Bundle: `testing`
- Source: [`no-handmade-standard-io-double--use-standard-io-test.ts`](../../src/lint/oxlint/rules/testing/no-handmade-standard-io-double--use-standard-io-test.ts)

<!-- END GENERATED rule-header -->

## Violation

A test file assembling its own stdout or stderr double, in three shapes.

- An `extend` call declaring a fixture named `stdout` or `stderr`, whether the name comes as a string argument or as a property key. A file that imports the shared fixture is reported all the same once it declares one again
- A direct reach for `process.stdout` or `process.stderr`. A file that imports `standardIoTest` is exempt: letting the code under test write to the stream is the point
- A property named `stdout` or `stderr` holding an object with a `write` method, or a stream instance such as `new PassThrough()`

Only `*.test.ts`, `*.test.tsx`, `*.spec.ts` and `*.spec.tsx` are read.

## Fix

Import `standardIoTest` from `@mst/dont-review-it/vitest`, derive the test from it, and read the captured text off the fixture.

```ts
standardIoTest("hands back what was written", ({ stdout }) => {
  process.stdout.write("progress\n");

  expect(stdout.text).toBe("progress\n");
});
```

Where a stream was being injected into the code under test, stop injecting it.

<!-- BEGIN GENERATED examples -->

Code this rule rejects.

```ts
// an extend fixture named stdout is a handmade double
// in /repo/src/cli.test.ts
const ioTest = test.extend({ stdout: async ({}, use) => { await use([]); } });
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

- Binding the fake stream to a variable and handing that to the property. What is assembled has not changed
- Writing a module of your own named `standardIoTest` to satisfy the exemption. The exemption rests on the shared fixture, not on the name
- Assembling a double for stdin. The machine does not reach it, and it is the same violation

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
