import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("no-local array callback execution", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "an empty reduce receiver does not execute its callback",
        code: '([] as number[]).reduce(() => z.enum(["draft", "published"]), 0);',
      },
      {
        name: "a single item sort does not execute its comparator",
        code: '[0].sort(() => { z.enum(["draft", "published"]); return 0; });',
      },
      {
        name: "an empty Array from source does not execute its mapper",
        code: 'Array.from([] as number[], () => z.enum(["draft", "published"]));',
      },
      {
        name: "a sparse array does not execute its mapper",
        code: '([, ,] as number[]).map(() => z.enum(["draft", "published"]));',
      },
      {
        name: "a zero length constructed array does not execute its mapper",
        code: 'new Array(0).map(() => z.enum(["draft", "published"]));',
      },
      {
        name: "a local map method does not execute its unused callback",
        code: 'const receiver = { map: () => [] }; receiver.map(() => z.enum(["draft", "published"]));',
      },
    ],
    invalid: [
      {
        name: "reduce executes its callback for a nonempty receiver and initial value",
        code: '[0].reduce((accumulator) => { z.enum(["draft", "published"]); return accumulator; }, 0);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "reduce right executes its callback for a nonempty receiver and initial value",
        code: '[0].reduceRight((accumulator) => { z.enum(["draft", "published"]); return accumulator; }, 0);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "sort executes its comparator for a multi item receiver",
        code: '[1, 0].sort(() => { z.enum(["draft", "published"]); return 0; });',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "to sorted executes its comparator for a multi item receiver",
        code: '[1, 0].toSorted(() => { z.enum(["draft", "published"]); return 0; });',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Array from executes its mapper for a nonempty source",
        code: 'Array.from([0], () => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Array map call executes its callback",
        code: '[0].map.call([0], () => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Array map apply executes its callback",
        code: '[0].map.apply([0], [() => z.enum(["draft", "published"])]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Array map Reflect apply executes its callback",
        code: 'Reflect.apply([0].map, [0], [() => z.enum(["draft", "published"])]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a bound Array map executes its callback",
        code: '[0].map.bind([0])(() => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Array prototype map call executes its callback",
        code: 'Array.prototype.map.call([0], () => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});
