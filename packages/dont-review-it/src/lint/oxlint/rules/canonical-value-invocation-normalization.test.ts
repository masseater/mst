import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { invocationStateRule } from "./canonical-value-invocation-test-fixture.ts";
import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("canonical value Reflect construction", () => {
  testLintRule(withOwner, {
    valid: [],
    invalid: [
      {
        name: "Reflect construct cannot hide a schema enum invocation",
        code: 'export const schema = Reflect.construct(z.enum, [["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an aliased Reflect construct cannot hide a schema enum invocation",
        code: 'const construct = Reflect.construct;\nexport const schema = construct(z.enum, [["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a bound Reflect construct cannot hide a schema enum invocation",
        code: 'const construct = Reflect.construct.bind(Reflect, z.enum);\nexport const schema = construct([["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Reflect construct cannot hide a Set vocabulary",
        code: 'export const values = Reflect.construct(Set, [["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an aliased Reflect construct cannot hide a Set vocabulary",
        code: 'const construct = Reflect.construct;\nexport const values = construct(Set, [["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a bound Reflect construct cannot hide a Set vocabulary",
        code: 'const construct = Reflect.construct.bind(Reflect, Set);\nexport const values = construct([["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an aliased Set target through Reflect construct cannot hide a vocabulary",
        code: 'const Collection = Set;\nexport const values = Reflect.construct(Collection, [["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});

describe("canonical value Reflect construction normalization", () => {
  testLintRule(invocationStateRule, {
    valid: [
      {
        name: "String concat retains its receiver and arguments",
        code: 'expectFact("dra".concat("ft"), "closed:\\"dra\\"|property:concat|this:\\"dra\\"|args:direct:\\"ft\\"");',
      },
      {
        name: "Reflect construct normalizes its constructor and argument array",
        code: 'expectInvocation(Reflect.construct(z.enum, [statuses]), "closed:schema:enum:z|property:enum|this:none|args:array:[statuses]");',
      },
      {
        name: "a bound Reflect construct normalizes its constructor and argument array",
        code: 'const construct = Reflect.construct.bind(Reflect, Set);\nexpectInvocation(construct([statuses]), "closed:set-constructor:Set|this:none|args:array:[statuses]");',
      },
    ],
    invalid: [],
  });
});
