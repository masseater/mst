import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noHandmadeStandardIoDouble } from "./no-handmade-standard-io-double--use-standard-io-test.ts";

describe("dont-review-it/no-handmade-standard-io-double--use-standard-io-test", () => {
  testLintRule(noHandmadeStandardIoDouble, {
    valid: [
      {
        name: "a spec that derives its test from the shared fixture is the intended shape",
        code: `import { standardIoTest } from "@mst/dont-review-it/vitest";
standardIoTest("captures", ({ stdout }) => {
  expect(stdout.text).toBe("");
});`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a spec that imports the fixture may exercise the process streams directly",
        code: `import { standardIoTest } from "@mst/dont-review-it/vitest";
standardIoTest("captures", ({ stdout }) => {
  process.stdout.write("result");
  expect(stdout.text).toBe("result");
});`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a source file assembling the capture is the fixture's own implementation space",
        code: `const spy = vi.spyOn(process.stdout, "write");`,
        filename: "/repo/src/standard-io-test.ts",
      },
      {
        name: "an extend fixture under an unrelated name is not a stream double",
        code: `const scenarioTest = test.extend({ repository: async ({}, use) => { await use("root"); } });`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a builder-form extend under an unrelated name is not a stream double",
        code: `const scenarioTest = test.extend("repository", () => "root");`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a stream-named property holding plain data is not a double",
        code: `const result = { stdout: "captured text", stderr: "" };`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "an import of something else does not stand in for the fixture",
        code: `import { helper } from "./helper.ts";
const doubled = helper(2);`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "an extend call without a fixture object declares nothing",
        code: `const scenarioTest = test.extend(sharedFixtures);`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a computed key is not a static stream name",
        code: `const key = "stdout";
const deps = { [key]: { write: () => true } };`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a spread carries no static stream declaration",
        code: `const deps = { ...doubles };`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a stream-named property whose write is not a function is not a double",
        code: `const report = { stdout: { write: "captured" } };`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a computed member access is not a static stream reach",
        code: `const raw = streams["stdout"];`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "a stream member on something that is not the process global is left alone",
        code: `const stream = runtime.process.stdout;`,
        filename: "/repo/src/cli.test.ts",
      },
      {
        name: "process members outside the two captured streams stay available",
        code: `process.exitCode = 0;
const home = process.env.HOME;`,
        filename: "/repo/src/cli.test.ts",
      },
    ],
    invalid: [
      {
        name: "an extend fixture named stdout is a handmade double",
        code: `const ioTest = test.extend({ stdout: async ({}, use) => { await use([]); } });`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "ownFixture" }],
      },
      {
        name: "an extend fixture named stderr is reported the same way",
        code: `const ioTest = it.extend({ stderr: async ({}, use) => { await use([]); } });`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "ownFixture" }],
      },
      {
        name: "a builder-form extend naming a stream is the same redeclaration",
        code: `const ioTest = test.extend("stdout", () => captureSomehow());`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "ownFixture" }],
      },
      {
        name: "declaring the fixture again while importing the shared one is still a redeclaration",
        code: `import { standardIoTest } from "@mst/dont-review-it/vitest";
const ioTest = standardIoTest.extend({ stdout: async ({}, use) => { await use([]); } });`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "ownFixture" }],
      },
      {
        name: "spying on a process stream without the fixture is a handmade capture",
        code: `const spy = vi.spyOn(process.stdout, "write");`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "directStream" }],
      },
      {
        name: "writing to a process stream without the fixture leaves the output unobserved",
        code: `process.stderr.write("diagnostic");`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "directStream" }],
      },
      {
        name: "a stdout-shaped object with a write method is an assembled double",
        code: `const deps = { stdout: { write: () => true } };`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "streamShapedDouble" }],
      },
      {
        name: "a stream instance handed out under a stream name is an assembled double",
        code: `const deps = { stderr: new PassThrough() };`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "streamShapedDouble" }],
      },
      {
        name: "each handmade stream in one object is reported on its own",
        code: `const deps = { stdout: { write: () => true }, stderr: { write: () => true } };`,
        filename: "/repo/src/cli.test.ts",
        errors: [{ messageId: "streamShapedDouble" }, { messageId: "streamShapedDouble" }],
      },
    ],
  });
});
