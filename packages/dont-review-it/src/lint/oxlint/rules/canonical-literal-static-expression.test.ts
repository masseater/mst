import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { STRICT_RULE, STRICT_SOURCE } from "./canonical-literal-rule-test-fixture.ts";

const error = { messageId: "canonicalValueLiteral" } as const;

describe("canonical literal static expressions", () => {
  testLintRule(STRICT_RULE, {
    valid: [
      {
        name: "a dynamic binary result stays unknown",
        code: 'consume(runtimeValue() + "ft");',
        filename: STRICT_SOURCE,
      },
      {
        name: "a shadowed String constructor is not a static producer",
        code: "const String = { fromCharCode: () => runtimeValue() }; consume(String.fromCharCode(100));",
        filename: STRICT_SOURCE,
      },
      {
        name: "an object method named join is not Array join",
        code: 'const parts = { join: () => runtimeValue() }; consume(parts.join(""));',
        filename: STRICT_SOURCE,
      },
      {
        name: "an invalid code point stays unknown",
        code: "consume(String.fromCodePoint(1_114_112));",
        filename: STRICT_SOURCE,
      },
      {
        name: "a shadowed String slice method is not a static producer",
        code: 'const value = { slice: () => runtimeValue() }; consume(value.slice("unlisted"));',
        filename: STRICT_SOURCE,
      },
    ],
    invalid: [
      {
        name: "binary concatenation resolves scalar aliases",
        code: 'const first = "dra"; const last = "ft"; consume(first + last);',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "template interpolation resolves a scalar alias",
        code: 'const last = "ft"; consume(`dra${last}`);',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "binary concatenation resolves object properties",
        code: 'const parts = { first: "dra", last: "ft" } as const; consume(parts.first + parts.last);',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "binary concatenation resolves destructured aliases",
        code: 'const [first, last] = ["dra", "ft"] as const; consume(first + last);',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "binary concatenation resolves a prior assignment",
        code: 'let first = "other"; first = "dra"; consume(first + "ft");',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "binary concatenation retains a known conditional outcome",
        code: 'declare const enabled: boolean; const last = enabled ? "ft" : "w"; consume("dra" + last);',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "binary concatenation resolves a called parameter",
        code: 'function consumePart(first: string) { consume(first + "ft"); } consumePart("dra");',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Array join constructs a static spelling",
        code: 'consume(["dra", "ft"].join(""));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String concat constructs a static spelling",
        code: 'consume("dra".concat("ft"));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String fromCharCode constructs a static spelling",
        code: "consume(String.fromCharCode(100, 114, 97, 102, 116));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String fromCodePoint constructs a static spelling",
        code: "consume(String.fromCodePoint(100, 114, 97, 102, 116));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "an aliased String producer keeps its global identity",
        code: "const encode = String.fromCharCode; consume(encode(100, 114, 97, 102, 116));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String producer arguments may come from a static spread",
        code: "consume(String.fromCodePoint(...[100, 114, 97, 102, 116]));",
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Array join resolves an aliased receiver",
        code: 'const parts = ["dra", "ft"]; consume(parts.join(""));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "Array prototype join resolves its call receiver",
        code: 'const parts = ["dra", "ft"]; consume(Array.prototype.join.call(parts, ""));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String slice preserves a static spelling",
        code: 'consume("draft-extra".slice(0, 5));',
        errors: [error],
        filename: STRICT_SOURCE,
      },
      {
        name: "String raw tag preserves a static spelling",
        code: "consume(String.raw`draft`);",
        errors: [error],
        filename: STRICT_SOURCE,
      },
    ],
  });
});
