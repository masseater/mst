import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withoutCatalog } from "./canonical-value-rule-test-fixture.ts";

const error = { messageId: "localFiniteValueSetWithoutOwner" } as const;

describe("no-local scheduled callback execution", () => {
  testLintRule(withoutCatalog, {
    valid: [
      {
        name: "a local timer function does not execute its callback",
        code: 'const setTimeout = (_callback: () => void) => 0; setTimeout(() => z.enum(["draft", "published"]));',
      },
      {
        name: "an unused callback remains unexecuted",
        code: 'const callback = () => z.enum(["draft", "published"]); void callback;',
      },
    ],
    invalid: [
      {
        name: "setTimeout executes its callback",
        code: 'setTimeout(() => z.enum(["draft", "published"]), 0);',
        errors: [error],
      },
      {
        name: "setInterval executes its callback",
        code: 'setInterval(() => z.enum(["draft", "published"]), 0);',
        errors: [error],
      },
      {
        name: "setImmediate executes its callback",
        code: 'setImmediate(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "an aliased queueMicrotask executes its callback",
        code: 'const schedule = queueMicrotask; schedule(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "queueMicrotask call executes its callback",
        code: 'queueMicrotask.call(globalThis, () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "queueMicrotask Reflect apply executes its callback",
        code: 'Reflect.apply(queueMicrotask, globalThis, [() => z.enum(["draft", "published"])]);',
        errors: [error],
      },
      {
        name: "a bound queueMicrotask executes its callback",
        code: 'queueMicrotask.bind(globalThis)(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "an imported timer alias executes its callback",
        code: 'import { setTimeout as schedule } from "node:timers"; schedule(() => z.enum(["draft", "published"]), 0);',
        errors: [error],
      },
      {
        name: "process nextTick executes its callback",
        code: 'process.nextTick(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "an aliased process nextTick executes its callback",
        code: 'const schedule = process.nextTick; schedule(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
    ],
  });
});
