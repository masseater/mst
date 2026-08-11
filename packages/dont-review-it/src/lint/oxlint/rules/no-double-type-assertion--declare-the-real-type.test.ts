import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noDoubleTypeAssertion } from "./no-double-type-assertion--declare-the-real-type.ts";

const THROUGH_UNKNOWN = ["as", "unknown"].join(" ");

const THROUGH_ANY = ["as", "any"].join(" ");

describe("dont-review-it/no-double-type-assertion--declare-the-real-type", () => {
  testLintRule(noDoubleTypeAssertion, {
    valid: [
      {
        name: "source without any assertion passes",
        code: "const total: number = 1 + 2;",
      },
      {
        name: "a single assertion is still checked by the type checker",
        code: "const total = input as number;",
      },
      {
        name: "a single angle bracket assertion is still checked by the type checker",
        code: "const total = <number>input;",
      },
      {
        name: "a const assertion narrows a literal and claims nothing about a foreign type",
        code: "const totals = [1, 2] as const;",
      },
      {
        name: "an assertion applied to a satisfies expression keeps the checked step",
        code: "const total = (input satisfies Source) as number;",
      },
      {
        name: "an assertion applied to a non null assertion is one assertion",
        code: "const total = input! as number;",
      },
      {
        name: "two assertions in separate declarations are two single assertions",
        code: `const raw = input ${THROUGH_UNKNOWN};\nconst total = other as number;`,
      },
      {
        name: "an assertion on the argument of a call is one assertion",
        code: "const total = parse(input as string);",
      },
    ],
    invalid: [
      {
        name: "an assertion routed through unknown is reported",
        code: `const total = input ${THROUGH_UNKNOWN} as number;`,
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "an assertion routed through any is the same shape and is reported",
        code: `const total = input ${THROUGH_ANY} as number;`,
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "parentheses between the two steps do not change the shape",
        code: `const total = (input ${THROUGH_UNKNOWN}) as number;`,
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "an angle bracket assertion over an as assertion is reported",
        code: `const total = <number>(input ${THROUGH_UNKNOWN});`,
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "an as assertion over an angle bracket assertion is reported",
        code: "const total = <Source>input as Target;",
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "a const assertion carrying a second assertion is reported",
        code: "const totals = [1, 2] as const as number[];",
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "two assertions between named types are reported the same way",
        code: "const total = input as Source as Target;",
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "three stacked assertions report each step that stands on an assertion",
        code: "const total = input as Loose as Source as Target;",
        errors: [{ messageId: "stackedTypeAssertion" }, { messageId: "stackedTypeAssertion" }],
      },
      {
        name: "a stacked assertion inside a call argument is reported",
        code: "parse(input as Source as string);",
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "a stacked assertion on a returned value is reported",
        code: "const read = () => {\n  return input as Source as number;\n};",
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
      {
        name: "a stacked assertion in a test file carries no exemption",
        code: "const total = input as Source as number;",
        filename: "/repo/packages/repository-checks/src/total.test.ts",
        errors: [{ messageId: "stackedTypeAssertion" }],
      },
    ],
  });
});
