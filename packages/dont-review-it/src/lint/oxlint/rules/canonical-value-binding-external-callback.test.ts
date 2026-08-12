import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withoutCatalog } from "./canonical-value-rule-test-fixture.ts";

const error = { messageId: "localFiniteValueSetWithoutOwner" } as const;

describe("no-local opaque external callback execution", () => {
  testLintRule(withoutCatalog, {
    valid: [
      {
        name: "a local function does not execute its callback",
        code: 'const store = (_callback: () => void) => undefined; store(() => z.enum(["draft", "published"]));',
      },
      {
        name: "an unused callback remains unexecuted",
        code: 'const callback = () => z.enum(["draft", "published"]); void callback;',
      },
    ],
    invalid: [
      {
        name: "an imported function may execute its callback",
        code: 'import { schedule } from "scheduler"; schedule(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "an imported namespace member may execute its callback",
        code: 'import * as scheduler from "scheduler"; scheduler.schedule(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "an alias of an imported function may execute its callback",
        code: 'import { schedule as imported } from "scheduler"; const schedule = imported; schedule(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "an opaque imported function remains conservative",
        code: 'import { store } from "scheduler"; store(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "an imported function call may execute its callback",
        code: 'import { schedule } from "scheduler"; schedule.call(undefined, () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "an imported function apply may execute its callback",
        code: 'import { schedule } from "scheduler"; Reflect.apply(schedule, undefined, [() => z.enum(["draft", "published"])]);',
        errors: [error],
      },
      {
        name: "a bound imported function may execute its callback",
        code: 'import { schedule } from "scheduler"; schedule.bind(undefined)(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
    ],
  });
});
