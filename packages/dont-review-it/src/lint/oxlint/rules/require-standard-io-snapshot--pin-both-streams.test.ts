import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { requireStandardIoSnapshot } from "./require-standard-io-snapshot--pin-both-streams.ts";

const FIXTURE_IMPORT = `import { standardIoTest } from "@mst/dont-review-it/vitest";`;

const STDOUT_SNAPSHOT = `standardIoTest("pins stdout", ({ stdout }) => {
  expect(stdout.text).toMatchInlineSnapshot();
});`;

const STDERR_SNAPSHOT = `standardIoTest("pins stderr", ({ stderr }) => {
  expect(stderr.text).toMatchInlineSnapshot();
});`;

describe("dont-review-it/require-standard-io-snapshot--pin-both-streams", () => {
  testLintRule(requireStandardIoSnapshot, {
    valid: [
      {
        name: "a spec that pins both streams is complete",
        code: `${FIXTURE_IMPORT}
${STDOUT_SNAPSHOT}
${STDERR_SNAPSHOT}`,
      },
      {
        name: "external snapshots pin the streams just as well",
        code: `${FIXTURE_IMPORT}
standardIoTest("pins both", ({ stdout, stderr }) => {
  expect(stdout.text).toMatchSnapshot();
  expect(stderr.text).toMatchSnapshot();
});`,
      },
      {
        name: "a spec that never derives a test from the fixture owes no snapshot",
        code: `test("plain", () => {
  expect(1 + 1).toBe(2);
});`,
      },
      {
        name: "an unrelated import carries no snapshot obligation",
        code: `import { helper } from "./helper.ts";
test("plain", () => {
  expect(helper()).toBe(2);
});`,
      },
      {
        name: "content assertions may sit beside the snapshots",
        code: `${FIXTURE_IMPORT}
standardIoTest("checks content", ({ stdout, stderr }) => {
  expect(stdout.text).toContain("result");
  expect(stdout.text).toMatchInlineSnapshot();
  expect(stderr.text).toMatchInlineSnapshot();
});`,
      },
      {
        name: "a renamed fixture import is followed to its call sites",
        code: `import { standardIoTest as ioTest } from "@mst/dont-review-it/vitest";
ioTest("pins stdout", ({ stdout }) => {
  expect(stdout.text).toMatchInlineSnapshot();
});
ioTest("pins stderr", ({ stderr }) => {
  expect(stderr.text).toMatchInlineSnapshot();
});`,
      },
    ],
    invalid: [
      {
        name: "a spec that pins neither stream is reported once per stream",
        code: `${FIXTURE_IMPORT}
standardIoTest("asserts content only", ({ stdout }) => {
  expect(stdout.text).toContain("result");
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "pinning stdout alone leaves stderr unpinned",
        code: `${FIXTURE_IMPORT}
${STDOUT_SNAPSHOT}`,
        errors: [{ messageId: "missingSnapshot" }],
      },
      {
        name: "pinning stderr alone leaves stdout unpinned",
        code: `${FIXTURE_IMPORT}
${STDERR_SNAPSHOT}`,
        errors: [{ messageId: "missingSnapshot" }],
      },
      {
        name: "a modifier call still derives the test from the fixture",
        code: `${FIXTURE_IMPORT}
standardIoTest.skip("skipped for now", ({ stdout }) => {
  expect(stdout.text).toContain("result");
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "a snapshot chained onto something that is not expect pins nothing",
        code: `${FIXTURE_IMPORT}
standardIoTest("uses a wrapped assertion", ({ stdout, stderr }) => {
  softly(stdout.text).toMatchInlineSnapshot();
  expect.soft(stderr.text).toMatchInlineSnapshot();
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "snapshotting something other than the captured text pins nothing",
        code: `${FIXTURE_IMPORT}
standardIoTest("snapshots the wrong subject", ({ stdout, stderr }) => {
  expect(stdout).toMatchInlineSnapshot();
  expect(stderr).toMatchInlineSnapshot();
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "a snapshot on a plain result object pins neither stream",
        code: `${FIXTURE_IMPORT}
standardIoTest("snapshots a result", ({ stdout }) => {
  const results = collect(stdout.text);
  results.toMatchSnapshot();
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "an expect without a readable subject pins nothing",
        code: `${FIXTURE_IMPORT}
standardIoTest("loses the subjects", ({ stdout, stderr }) => {
  expect().toMatchInlineSnapshot();
  expect(...[stdout, stderr]).toMatchSnapshot();
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "a member other than the captured text is not the stream contract",
        code: `${FIXTURE_IMPORT}
standardIoTest("snapshots the wrong members", ({ stdout, stderr }) => {
  expect(stdout.raw).toMatchInlineSnapshot();
  expect(stderr["text"]).toMatchInlineSnapshot();
  expect(buffer.text).toMatchInlineSnapshot();
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
    ],
  });
});
