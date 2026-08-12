import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withoutCatalog } from "./canonical-value-rule-test-fixture.ts";

const error = { messageId: "localFiniteValueSetWithoutOwner" } as const;

describe("no-local standard callback execution", () => {
  testLintRule(withoutCatalog, {
    valid: [
      {
        name: "a local replace method does not execute its unused callback",
        code: 'const value = { replace: () => "" }; value.replace("x", () => z.enum(["draft", "published"]));',
      },
      {
        name: "a local forEach method does not execute its unused callback",
        code: 'const value = { forEach: () => undefined }; value.forEach(() => z.enum(["draft", "published"]));',
      },
      {
        name: "an empty Set does not execute its callback",
        code: 'new Set().forEach(() => z.enum(["draft", "published"]));',
      },
      {
        name: "an empty typed array does not execute its callback",
        code: 'new Uint8Array().map(() => z.enum(["draft", "published"]));',
      },
      {
        name: "a nonmatching regular expression does not execute its replacer",
        code: '"draft".replace(/missing/, () => z.enum(["draft", "published"]));',
      },
    ],
    invalid: [
      {
        name: "Object groupBy executes its callback",
        code: 'Object.groupBy([0], () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "Map groupBy executes its callback",
        code: 'Map.groupBy([0], () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "String replace executes its replacer",
        code: '"x".replace("x", () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "String replaceAll executes its replacer",
        code: '"xx".replaceAll("x", () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "String replace executes a matching regular expression replacer",
        code: '"draft".replace(/draft/, () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "JSON parse executes its reviver",
        code: 'JSON.parse("{\\"x\\":1}", () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "JSON stringify executes its replacer",
        code: 'JSON.stringify({ x: 1 }, () => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "Set forEach executes its callback",
        code: 'new Set([0]).forEach(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
      {
        name: "typed array map executes its callback",
        code: 'new Uint8Array([0]).map(() => z.enum(["draft", "published"]));',
        errors: [error],
      },
    ],
  });
});
