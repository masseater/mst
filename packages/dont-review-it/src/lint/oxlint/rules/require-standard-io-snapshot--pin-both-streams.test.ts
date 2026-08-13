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
        name: "the stream bindings standing as the subjects pin both streams",
        code: `${FIXTURE_IMPORT}
const it = standardIoTest.extend("theRun", { auto: true }, () => {
  runTheCli();
});
it("pins stdout", ({ stdout }) => {
  expect(stdout).toMatchInlineSnapshot();
});
it("pins stderr", ({ stderr }) => {
  expect(stderr).toMatchInlineSnapshot();
});`,
      },
      {
        name: "a fixture reading from a stream carries that stream to its own snapshot",
        code: `${FIXTURE_IMPORT}
const it = standardIoTest
  .extend("theStandardOutputOfARun", ({ stdout }) => {
    runTheCli();
    return stdout.text();
  })
  .extend("theStandardErrorOfARun", ({ stderr }) => {
    runTheCli();
    return stderr.text();
  });
it("pins stdout", ({ theStandardOutputOfARun }) => {
  expect(theStandardOutputOfARun).toMatchInlineSnapshot();
});
it("pins stderr", ({ theStandardErrorOfARun }) => {
  expect(theStandardErrorOfARun).toMatchInlineSnapshot();
});`,
      },
      {
        name: "a fixture declared with a value rather than a factory carries no stream with it",
        code: `${FIXTURE_IMPORT}
const it = standardIoTest.extend("seed", 1);
it("pins stdout", ({ stdout }) => {
  expect(stdout).toMatchInlineSnapshot();
});
it("pins stderr", ({ stderr }) => {
  expect(stderr).toMatchInlineSnapshot();
});`,
      },
      {
        name: "a snapshot taken of a call rooted at a stream pins that stream",
        code: `${FIXTURE_IMPORT}
standardIoTest("pins stdout", ({ stdout }) => {
  expect(stdout.text()).toMatchInlineSnapshot();
});
standardIoTest("pins stderr", ({ stderr }) => {
  expect(stderr.text()).toMatchInlineSnapshot();
});`,
      },
      {
        name: "a stream reached through a chain of fixtures still counts as pinned",
        code: `${FIXTURE_IMPORT}
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
});`,
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
        name: "declarations unrelated to the fixture never join the derivation set",
        code: `${FIXTURE_IMPORT}
const LABEL = "check";
let pending;
const { helper } = toolbox;
const wrapped = wrap(LABEL);
standardIoTest("pins stdout", ({ stdout }) => {
  expect(stdout.text).toMatchInlineSnapshot();
});
standardIoTest("pins stderr", ({ stderr }) => {
  expect(stderr.text).toMatchInlineSnapshot();
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
        name: "a binding derived through extend keeps the snapshot duty satisfied",
        code: `${FIXTURE_IMPORT}
const it = standardIoTest.extend("finished", () => runCli(["check"]));
it("pins stdout", ({ stdout }) => {
  expect(stdout.text).toMatchInlineSnapshot();
});
it("pins stderr", ({ stderr }) => {
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
        name: "a binding derived through extend still owes both snapshots",
        code: `${FIXTURE_IMPORT}
const it = standardIoTest.extend("finished", () => runCli(["check"]));
it("asserts content only", ({ stdout }) => {
  expect(stdout.text).toContain("result");
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "a chain of derivations does not shed the duty",
        code: `${FIXTURE_IMPORT}
const scenario = standardIoTest.extend("finished", () => runCli(["check"]));
const it = scenario.extend("report", () => parse());
it("asserts content only", ({ report }) => {
  expect(report).toContain("result");
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "a plain alias of the fixture is followed to its call sites",
        code: `${FIXTURE_IMPORT}
const it = standardIoTest;
it("asserts content only", ({ stdout }) => {
  expect(stdout.text).toContain("result");
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
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
        name: "a snapshot rooted at a binding unrelated to the streams pins neither of them",
        code: `${FIXTURE_IMPORT}
standardIoTest("snapshots an unrelated subject", ({ stdout, stderr }) => {
  expect(buffer.text).toMatchInlineSnapshot();
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
      {
        name: "a snapshot of a subject with no name at its root pins neither stream",
        code: `${FIXTURE_IMPORT}
standardIoTest("snapshots a written out value", ({ stdout, stderr }) => {
  expect("result").toMatchInlineSnapshot();
});`,
        errors: [{ messageId: "missingSnapshot" }, { messageId: "missingSnapshot" }],
      },
    ],
  });
});
