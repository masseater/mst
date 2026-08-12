import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withOwner } from "./canonical-value-rule-test-fixture.ts";

const error = { messageId: "localFiniteValueSetWithOwner" } as const;

describe("canonical value collection invocation results", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a shadowed Object values call is not a standard collection",
        code: "const Object = { values: runtimeValues }; z.enum(Object.values({ first: 'draft', second: 'published' }));",
      },
      {
        name: "a shadowed property enumeration is not a standard collection",
        code: "const Reflect = { ownKeys: runtimeValues }; z.enum(Reflect.ownKeys({ draft: 0, published: 1 }));",
      },
      {
        name: "a shadowed structuredClone call is not a standard collection",
        code: "const structuredClone = runtimeValues; z.enum(structuredClone(['draft', 'published']));",
      },
      {
        name: "Object assign over a nonempty target is not concatenation",
        code: "z.enum(Object.assign(['draft'], ['published']));",
      },
      {
        name: "an array own method is not a standard collection method",
        code: "const values = ['draft']; values.slice = runtimeValues; z.enum(values.slice());",
      },
    ],
    invalid: [
      {
        name: "an Object values alias preserves object values",
        code: "const values = Object.values; z.enum(values({ first: 'draft', second: 'published' }));",
        errors: [error],
      },
      {
        name: "a destructured Object values alias preserves object values",
        code: "const { values } = Object; z.enum(values({ first: 'draft', second: 'published' }));",
        errors: [error],
      },
      {
        name: "Object values through call preserves object values",
        code: "z.enum(Object.values.call(Object, { first: 'draft', second: 'published' }));",
        errors: [error],
      },
      {
        name: "an Array of alias preserves its logical arguments",
        code: "const of = Array.of; z.enum(of('draft', 'published'));",
        errors: [error],
      },
      {
        name: "an Array from alias preserves iterable elements",
        code: "const from = Array.from; z.enum(from(['draft', 'published']));",
        errors: [error],
      },
      {
        name: "String split through an aliased call preserves its parts",
        code: "const split = String.prototype.split; z.enum(split.call('draft,published', ','));",
        errors: [error],
      },
      {
        name: "Array concat through an aliased call preserves its elements",
        code: "const concat = Array.prototype.concat; z.enum(concat.call(['draft'], ['published']));",
        errors: [error],
      },
      {
        name: "Array slice through an aliased call preserves its selected elements",
        code: "const slice = Array.prototype.slice; z.enum(slice.call(['draft', 'published', 'archived'], 0, 2));",
        errors: [error],
      },
      {
        name: "Array toReversed through an aliased call preserves its elements",
        code: "const reverse = Array.prototype.toReversed; z.enum(reverse.call(['published', 'draft']));",
        errors: [error],
      },
      {
        name: "an Object getOwnPropertyNames alias preserves property names",
        code: "const names = Object.getOwnPropertyNames; z.enum(names({ draft: 0, published: 1 }));",
        errors: [error],
      },
      {
        name: "a destructured getOwnPropertyNames alias preserves property names",
        code: "const { getOwnPropertyNames: names } = Object; z.enum(names({ draft: 0, published: 1 }));",
        errors: [error],
      },
      {
        name: "getOwnPropertyNames through call preserves property names",
        code: "z.enum(Object.getOwnPropertyNames.call(Object, { draft: 0, published: 1 }));",
        errors: [error],
      },
      {
        name: "a Reflect ownKeys alias preserves string property names",
        code: "const keys = Reflect.ownKeys; z.enum(keys({ draft: 0, published: 1 }));",
        errors: [error],
      },
      {
        name: "Reflect apply over ownKeys preserves string property names",
        code: "z.enum(Reflect.apply(Reflect.ownKeys, Reflect, [{ draft: 0, published: 1 }]));",
        errors: [error],
      },
      {
        name: "an Object entries alias supplies mapped property names",
        code: "const entries = Object.entries; z.enum(entries({ draft: 0, published: 1 }).map(([key]) => key));",
        errors: [error],
      },
      {
        name: "Object freeze preserves a finite collection",
        code: "z.enum(Object.freeze(['draft', 'published']));",
        errors: [error],
      },
      {
        name: "Object seal preserves a finite collection",
        code: "z.enum(Object.seal(['draft', 'published']));",
        errors: [error],
      },
      {
        name: "Object preventExtensions preserves a finite collection",
        code: "z.enum(Object.preventExtensions(['draft', 'published']));",
        errors: [error],
      },
      {
        name: "structuredClone preserves a finite collection",
        code: "z.enum(structuredClone(['draft', 'published']));",
        errors: [error],
      },
      {
        name: "Object assign into an empty array preserves source elements",
        code: "z.enum(Object.assign([], ['draft', 'published']));",
        errors: [error],
      },
    ],
  });
});
