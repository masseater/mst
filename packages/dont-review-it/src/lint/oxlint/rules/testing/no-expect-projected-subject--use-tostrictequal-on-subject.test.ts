import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noExpectProjectedSubject } from "./no-expect-projected-subject--use-tostrictequal-on-subject.ts";

const SPEC_FILE = "report.test.ts";

const FIXTURE = 'const test = baseTest.extend("report", () => summarise());\n';

describe("dont-review-it/no-expect-projected-subject--use-tostrictequal-on-subject", () => {
  testLintRule(noExpectProjectedSubject, {
    valid: [
      {
        name: "the bare binding a fixture handed back is the subject the rule asks for",
        documented: true,
        filename: SPEC_FILE,
        code: `${FIXTURE}test("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "an awaited binding reaches the assertion as the bare binding",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("carries both fields", async ({ report }) => {\n  expect(await report).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "a parenthesized binding is still the bare binding",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("carries both fields", ({ report }) => {\n  expect((report)).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "a call handed to the assertion is reported by the rule that forbids running code there",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("summarises the entries", ({ entries }) => {\n  expect(summarise(entries)).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "a construction handed to the assertion is reported by that same rule",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("builds a report", ({ entries }) => {\n  expect(new Report(entries)).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "a tagged template handed to the assertion is reported by that same rule",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("renders the heading", ({ report }) => {\n  expect(heading\`\${report}\`).toStrictEqual("a");\n});`,
      },
      {
        name: "an object built inside the assertion is reported by the rule that forbids composed subjects",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("carries both fields", ({ report }) => {\n  expect({ id: report.id }).toStrictEqual({ id: "a" });\n});`,
      },
      {
        name: "a projection standing beside a snapshot of the same fixture under the same describe",
        documented: true,
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole report", ({ report }) => {\n    expect(report).toMatchSnapshot();\n  });\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
      },
      {
        name: "a snapshot reached through a renamed binding pins the same fixture",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole report", ({ report: summary }) => {\n    expect(summary).toMatchSnapshot();\n  });\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
      },
      {
        name: "a snapshot behind a settlement modifier records the same binding",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole report", async ({ report }) => {\n    await expect(report).resolves.toMatchSnapshot();\n  });\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
      },
      {
        name: "blocks standing side by side at the top of the spec are siblings of each other",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("records the whole report", ({ report }) => {\n  expect(report).toMatchSnapshot();\n});\ntest("marks the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});`,
      },
      {
        name: "a block bound through the fixture builder under another name is still a block",
        filename: SPEC_FILE,
        code: `const scenario = test.extend("report", () => summarise());\ndescribe("report", () => {\n  scenario("records the whole report", ({ report }) => {\n    expect(report).toMatchSnapshot();\n  });\n  scenario("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
      },
      {
        name: "a block imported from the runner is read the same way",
        filename: SPEC_FILE,
        code: `import { test } from "vite-plus/test";\n\ntest("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "the matcher the configuration names as a snapshot excuses the projection",
        filename: SPEC_FILE,
        options: [{ snapshotMatchers: ["toMatchStoredReport"] }],
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole report", ({ report }) => {\n    expect(report).toMatchStoredReport();\n  });\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
      },
      {
        name: "an entry call handed nothing names no subject",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("marks the total", () => {\n  expect().toBe(2);\n});`,
      },
      {
        name: "a matcher called on something other than the assertion entry is outside this reading",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("marks the total", ({ report }) => {\n  assertion(report.total).toBe(2);\n});`,
      },
      {
        name: "a matcher named through a computed member records no snapshot",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("records the whole report", ({ report }) => {\n  expect(report)[recorder]();\n});`,
      },
      {
        name: "a chain that stops before the matcher call makes no assertion",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("records the whole report", ({ report }) => {\n  expect(report).toMatchSnapshot;\n});`,
      },
      {
        name: "an entry call that reaches no matcher at all makes no assertion",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("records the whole report", ({ report }) => {\n  expect(report);\n});`,
      },
      {
        name: "a spec suffix the configuration spells out keeps the file in this reading",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: [".test.ts"] }],
        code: `${FIXTURE}test("carries both fields", ({ report }) => {\n  expect(report).toStrictEqual({ id: "a", total: 2 });\n});`,
      },
      {
        name: "a file that is not a spec file is outside this reading",
        filename: "report.ts",
        code: `${FIXTURE}test("marks the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});`,
      },
      {
        name: "a suffix the configuration replaced no longer marks a spec file",
        filename: SPEC_FILE,
        options: [{ specFileSuffixes: ["-spec.ts"] }],
        code: `${FIXTURE}test("marks the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});`,
      },
    ],
    invalid: [
      {
        name: "a field read off the binding leaves every other field of it unpinned",
        documented: true,
        filename: SPEC_FILE,
        code: `${FIXTURE}test("marks the total", ({ report }) => {\n  expect(report.total).toBe(2);\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a field reached through a longer path and a wrapper is read the same way",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("names the source", ({ report }) => {\n  expect(report.meta!.source).toBe("orders");\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a field read off a call has no binding behind it to pin",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("marks the total", ({ entries }) => {\n  expect(summarise(entries).total).toBe(2);\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a field read behind the soft entry is read the same way",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("marks the total", ({ report }) => {\n  expect.soft(report.total).toBe(2);\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a field read behind a negation is read the same way",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("marks the total", ({ report }) => {\n  expect(report.total).not.toBe(3);\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "fields bundled into a list are still fields picked one by one",
        documented: true,
        filename: SPEC_FILE,
        code: `${FIXTURE}test("carries both fields", ({ report }) => {\n  expect([report.id, report.total]).toStrictEqual(["a", 2]);\n});`,
        errors: [{ messageId: "bundledSubject" }],
      },
      {
        name: "an arrow written inside the assertion carries the run of the code under test",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("refuses an empty entry", ({ entries }) => {\n  expect(() => summarise(entries)).toThrow();\n});`,
        errors: [{ messageId: "inlineFunctionSubject" }],
      },
      {
        name: "a function expression written inside the assertion carries the same run",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("refuses an empty entry", ({ entries }) => {\n  expect(function () {\n    return summarise(entries);\n  }).toThrow();\n});`,
        errors: [{ messageId: "inlineFunctionSubject" }],
      },
      {
        name: "a value spelled out in the spec pins nothing the code produced",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("marks the total", () => {\n  expect(2).toBe(2);\n});`,
        errors: [{ messageId: "writtenOutSubject" }],
      },
      {
        name: "a template holding no substitution is a value spelled out as well",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("names the source", () => {\n  expect(\`orders\`).toBe("orders");\n});`,
        errors: [{ messageId: "writtenOutSubject" }],
      },
      {
        name: "a template holding a substitution is built inside the assertion",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("names the source", ({ report }) => {\n  expect(\`\${report.id}!\`).toBe("a!");\n});`,
        errors: [{ messageId: "derivedSubject" }],
      },
      {
        name: "a comparison written inside the assertion hides what the code produced",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("counts more than one entry", ({ report }) => {\n  expect(report.total > 1).toBe(true);\n});`,
        errors: [{ messageId: "derivedSubject" }],
      },
      {
        name: "a spread handed to the assertion names no subject to pin",
        filename: SPEC_FILE,
        code: `${FIXTURE}test("carries both fields", ({ parts }) => {\n  expect(...parts).toStrictEqual(["a", 2]);\n});`,
        errors: [{ messageId: "derivedSubject" }],
      },
      {
        name: "a snapshot inside the same block does not stand as the second assertion",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("marks the total", ({ report }) => {\n    expect(report).toMatchSnapshot();\n    expect(report.total).toBe(2);\n  });\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a snapshot placed in a describe of its own is not a sibling of the projection",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n  describe("as a whole", () => {\n    test("records the whole report", ({ report }) => {\n      expect(report).toMatchSnapshot();\n    });\n  });\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a snapshot placed in the describe above is not a sibling of the projection",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole report", ({ report }) => {\n    expect(report).toMatchSnapshot();\n  });\n  describe("in detail", () => {\n    test("marks the total", ({ report }) => {\n      expect(report.total).toBe(2);\n    });\n  });\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a snapshot of another fixture leaves the projected binding unrecorded",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole invoice", ({ invoice }) => {\n    expect(invoice).toMatchSnapshot();\n  });\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a snapshot of a binding no fixture handed over leaves the projection standing",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole report", () => {\n    expect(report).toMatchSnapshot();\n  });\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a projection whose root the block never bound reaches no fixture",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole report", ({ report }) => {\n    expect(report).toMatchSnapshot();\n  });\n  test("marks the total", ({ invoice }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a block that is not a statement of the describe body has no siblings",
        filename: SPEC_FILE,
        code: `${FIXTURE}describe("report", () =>\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  }),\n);`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "a projection standing outside every block reaches no sibling",
        filename: SPEC_FILE,
        code: `${FIXTURE}expect(report).toMatchSnapshot();\nexpect(report.total).toBe(2);`,
        errors: [{ messageId: "projectedSubject" }],
      },
      {
        name: "the matcher the configuration dropped no longer excuses the projection",
        filename: SPEC_FILE,
        options: [{ snapshotMatchers: ["toMatchStoredReport"] }],
        code: `${FIXTURE}describe("report", () => {\n  test("records the whole report", ({ report }) => {\n    expect(report).toMatchSnapshot();\n  });\n  test("marks the total", ({ report }) => {\n    expect(report.total).toBe(2);\n  });\n});`,
        errors: [{ messageId: "projectedSubject" }],
      },
    ],
  });
});
