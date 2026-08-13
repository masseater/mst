import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noDuplicatedTest } from "./no-duplicated-test--delete-the-copy.ts";

const SUBJECT_FILE = "/repository/packages/dont-review-it/src/subject.test.ts";

describe("dont-review-it/no-duplicated-test--delete-the-copy", () => {
  testLintRule(noDuplicatedTest, {
    valid: [
      {
        name: "two tests that share neither title nor body pass",
        code: `test("counts one", () => {
  expect(total).toBe(1);
});
test("counts two", () => {
  expect(total).toBe(2);
});`,
        filename: SUBJECT_FILE,
      },
      {
        name: "two tests that share only their body pass",
        code: `test("counts one", () => {
  expect(total).toBe(1);
});
it("counts the same total", () => {
  expect(total).toBe(1);
});`,
        filename: SUBJECT_FILE,
      },
      {
        name: "two tests that share only their title pass",
        code: `test("counts one", () => {
  expect(total).toBe(1);
});
test("counts one", () => {
  expect(other).toBe(1);
});`,
        filename: SUBJECT_FILE,
      },
      {
        name: "a fixture declared through the builder is not a test",
        code: `const it = test
  .extend("cleanRun", () => run())
  .extend("dryRun", () => run());`,
        filename: SUBJECT_FILE,
      },
      {
        name: "a call that is not a runner is left alone",
        code: `describe("suite", () => {});
describe("suite", () => {});`,
        filename: SUBJECT_FILE,
      },
      {
        name: "a runner whose title is not spelled out is left alone",
        code: `test(title, () => {
  expect(total).toBe(1);
});
test(title, () => {
  expect(total).toBe(1);
});`,
        filename: SUBJECT_FILE,
      },
      {
        name: "a runner without a body is left alone",
        code: `test("counts one");
test("counts one");`,
        filename: SUBJECT_FILE,
      },
      {
        name: "a runner reached through a computed callee is left alone",
        code: `runners[0]("counts one", () => {
  expect(total).toBe(1);
});
runners[0]("counts one", () => {
  expect(total).toBe(1);
});`,
        filename: SUBJECT_FILE,
      },
    ],
    invalid: [
      {
        name: "two tests that share both title and body are both reported",
        code: `test("counts one", () => {
  expect(total).toBe(1);
});
test("counts one", () => {
  expect(total).toBe(1);
});`,
        filename: SUBJECT_FILE,
        errors: [
          { messageId: "duplicatedTest", data: { title: "counts one" } },
          { messageId: "duplicatedTest", data: { title: "counts one" } },
        ],
      },
      {
        name: "the two runner spellings are compared against each other",
        code: `describe("suite", () => {
  test("counts one", () => {
    expect(total).toBe(1);
  });
  it("counts one", () => {
    expect(total).toBe(1);
  });
});`,
        filename: SUBJECT_FILE,
        errors: [
          { messageId: "duplicatedTest", data: { title: "counts one" } },
          { messageId: "duplicatedTest", data: { title: "counts one" } },
        ],
      },
      {
        name: "a runner reached through a modifier is compared with the plain one",
        code: `test("counts one", () => {
  expect(total).toBe(1);
});
test.only("counts one", () => {
  expect(total).toBe(1);
});`,
        filename: SUBJECT_FILE,
        errors: [
          { messageId: "duplicatedTest", data: { title: "counts one" } },
          { messageId: "duplicatedTest", data: { title: "counts one" } },
        ],
      },
    ],
  });
});
