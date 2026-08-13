import { testLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { forbidTestAdjacentFile } from "./forbid-test-adjacent-file--inline-its-setup-into-the-test.ts";

describe("dont-review-it/forbid-test-adjacent-file--inline-its-setup-into-the-test", () => {
  testLintRule(forbidTestAdjacentFile, {
    valid: [
      {
        name: "the test spelling the runner picks up passes",
        code: "export const total = 1;",
        filename: "/repository/src/order.test.ts",
      },
      {
        name: "the spec spelling the runner picks up passes",
        code: "export const total = 1;",
        filename: "/repository/specs/order.spec.ts",
      },
      {
        name: "a tsx test passes on the same spelling",
        code: "export const total = 1;",
        filename: "/repository/src/order.test.tsx",
      },
      {
        name: "a production source carries no test marker",
        code: "export const total = 1;",
        filename: "/repository/src/order.ts",
      },
      {
        name: "a name that merely ends in the marker without the separating dot passes",
        code: "export const total = 1;",
        filename: "/repository/src/contest.ts",
      },
      {
        name: "a directory named after tests leaves the file name alone",
        code: "export const total = 1;",
        filename: "/repository/fixtures/order.ts",
      },
    ],
    invalid: [
      {
        name: "a test marker carrying a further suffix is reported",
        code: "export const total = 1;",
        filename: "/repository/src/order.test-fixture.ts",
        errors: [{ messageId: "testAdjacentFile", data: { fileName: "order.test-fixture.ts" } }],
      },
      {
        name: "a fixture spelling is reported",
        code: "export const total = 1;",
        filename: "/repository/src/order.fixture.ts",
        errors: [{ messageId: "testAdjacentFile", data: { fileName: "order.fixture.ts" } }],
      },
      {
        name: "a mock spelling is reported",
        code: "export const total = 1;",
        filename: "/repository/src/order.mock.ts",
        errors: [{ messageId: "testAdjacentFile", data: { fileName: "order.mock.ts" } }],
      },
      {
        name: "a story spelling is reported",
        code: "export const total = 1;",
        filename: "/repository/src/order.stories.tsx",
        errors: [{ messageId: "testAdjacentFile", data: { fileName: "order.stories.tsx" } }],
      },
      {
        name: "a spec marker carrying a further suffix is reported",
        code: "export const total = 1;",
        filename: "/repository/src/order.spec-helper.ts",
        errors: [{ messageId: "testAdjacentFile", data: { fileName: "order.spec-helper.ts" } }],
      },
    ],
  });

  test("the rule takes no options, so no deployment can widen the accepted spellings", () => {
    expect(forbidTestAdjacentFile.meta.schema).toStrictEqual([]);
  });
});
