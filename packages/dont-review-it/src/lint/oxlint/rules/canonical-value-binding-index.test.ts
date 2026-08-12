import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { ORDER_OWNER_CODE, withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: binding and index resolution", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a Set alias reassigned to a fake constructor is not the built-in collection",
        code: 'let Collection = Set;\nCollection = Fake;\nexport const statuses = new Collection(["draft", "published"]);',
      },
      {
        name: "a write in an uncalled function does not reach a program sink",
        code: 'let VALUES = ["other"] as const;\nfunction mutate() { VALUES = ["draft", "published"] as const; }\nexport const schema = z.enum(VALUES);',
      },
      {
        name: "an uncalled parameterized schema contributes no argument value",
        code: "export function schema(values) { return z.enum(values); }",
      },
    ],
    invalid: [
      {
        name: "a called function write reaches a program sink",
        code: 'let VALUES = ["other"] as const;\nfunction mutate() { VALUES = ["draft", "published"] as const; }\nmutate();\nexport const schema = z.enum(VALUES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "every parent context write remains possible in a child sink",
        code: 'let VALUES = ["draft", "published"] as const;\nVALUES = ["other"] as const;\nexport function schema() { return z.enum(VALUES); }',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a parameter default reaches its function sink",
        code: 'export function schema(VALUES = ["draft", "published"] as const) { return z.enum(VALUES); }',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a direct call argument reaches a plain parameter",
        code: 'function schema(values) { return z.enum(values); }\nschema(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an immediate call argument reaches an arrow parameter",
        code: '((values) => z.enum(values))(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a call argument reaches an object destructured parameter",
        code: 'function schema({ values }) { return z.enum(values); }\nschema({ values: ["draft", "published"] as const });',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a supplied call argument takes precedence through a default parameter",
        code: 'function schema(values = runtimeValues()) { return z.enum(values); }\nschema(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "multiple calls retain every possible parameter value",
        code: 'function schema(values) { return z.enum(values); }\nschema(runtimeValues());\nschema(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a for of candidate reaches its loop sink",
        code: 'for (const status of ["draft"] as const) { z.enum([status, "published"]); }',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "one hop through a local const does not move the definition",
        code: 'const STATUSES = ["draft", "published"] as const;\nexport const schema = z.enum(STATUSES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an alias chain does not move a local definition",
        code: 'const RAW = ["draft", "published"] as const;\nconst FIRST = RAW;\nconst STATUSES = FIRST;\nexport const schema = z.enum(STATUSES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a nested lexical binding is resolved at its use site",
        code: 'export function schema() {\n  const STATUSES = ["draft", "published"] as const;\n  return z.enum(STATUSES);\n}',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an object destructuring binding resolves its local array value",
        code: 'const { statuses: VALUES } = { statuses: ["draft", "published"] as const };\nexport const schema = z.enum(VALUES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an object alias before destructuring keeps its local array value",
        code: 'const source = { statuses: ["draft", "published"] as const };\nconst { statuses: VALUES } = source;\nexport const schema = z.enum(VALUES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a computed object key before destructuring keeps its local array value",
        code: 'const key = "statuses";\nconst source = { [key]: ["draft", "published"] as const };\nconst { [key]: VALUES } = source;\nexport const schema = z.enum(VALUES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a local object member keeps its local array value",
        code: 'const source = { statuses: ["draft", "published"] as const };\nexport const schema = z.enum(source.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a numeric object key read through holder zero keeps its local array value",
        code: 'const holder = { 0: ["draft", "published"] as const };\nexport const schema = z.enum(holder[0]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a numeric object key read through holder string zero keeps its local array value",
        code: 'const holder = { "0": ["draft", "published"] as const };\nexport const schema = z.enum(holder["0"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an array string index keeps its local array value",
        code: 'const holder = [["draft", "published"] as const];\nexport const schema = z.enum(holder["0"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an array spread supplies a local value at an index greater than zero",
        code: 'const holder = [null, ...[["draft", "published"] as const]];\nexport const schema = z.enum(holder[1]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array destructuring resolves a local value supplied by a spread after index zero",
        code: 'const [, values] = [null, ...[["draft", "published"] as const]];\nexport const schema = z.enum(values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a TypeScript bracket indexed local object member keeps its array value",
        code: 'const holder = { statuses: ["draft", "published"] as const };\nexport type Status = (typeof holder["statuses"])[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an intermediate TypeScript values alias keeps its local array value",
        code: 'const VALUES = ["draft", "published"] as const;\ntype Values = typeof VALUES;\nexport type Status = Values[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a generic identity TypeScript alias keeps its local array value",
        code: 'const VALUES = ["draft", "published"] as const;\ntype Box<T> = T;\nexport type Status = Box<typeof VALUES>[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a bracket wrapper TypeScript values alias keeps its local array value",
        code: 'const holder = { values: ["draft", "published"] as const };\ntype Values = typeof holder["values"];\nexport type Status = Values[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a nested local object member keeps its local array value",
        code: 'const source = { nested: { statuses: ["draft", "published"] as const } };\nexport const schema = z.enum(source.nested.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an optional nested local object member keeps its local array value",
        code: 'const source = { nested: { statuses: ["draft", "published"] as const } };\nexport const schema = z.enum(source?.nested?.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an array destructuring binding resolves its local array value",
        code: 'const [VALUES] = [["draft", "published"] as const];\nexport const schema = z.enum(VALUES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a nested destructuring binding resolves its local array value",
        code: 'const { nested: { statuses: VALUES } } = { nested: { statuses: ["draft", "published"] as const } };\nexport const schema = z.enum(VALUES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an object rest binding keeps the properties copied into it",
        code: 'const { ...source } = { statuses: ["draft", "published"] as const };\nexport const schema = z.enum(source.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a later assignment keeps its local array value",
        code: 'let VALUES;\nVALUES = ["draft", "published"] as const;\nexport const schema = z.enum(VALUES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a dead object alias write cannot hide the earlier finite set",
        code: 'let source = { statuses: ["draft", "published"] as const };\nexport const schema = z.enum(source.statuses);\nsource = runtimeSource();',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an array rest binding keeps its local array value",
        code: 'const [...VALUES] = ["draft", "published"] as const;\nexport const schema = z.enum(VALUES);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a nested object rest binding keeps its local object member value",
        code: 'const { nested: { ...source } } = { nested: { statuses: ["draft", "published"] as const } };\nexport const schema = z.enum(source.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a destructuring assignment target member receives a local vocabulary",
        code: 'const target = {};\n({ statuses: target.values } = { statuses: ["draft", "published"] as const });\nexport const schema = z.enum(target.values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an owner binding name cannot exempt a different lexical binding",
        code: `${ORDER_OWNER_CODE}\nexport function schema() {\n  const ORDER_STATUSES = ["draft", "published"] as const;\n  return z.enum(ORDER_STATUSES);\n}`,
        filename: "/repo/packages/order-vocabulary/src/order-status.ts",
        cwd: "/repo",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a different binding at the registered declaration range is not exempt",
        code: '/** @canonical-values order-status */\nexport const OTHER_STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof OTHER_STATUSES)[number];',
        filename: "/repo/packages/order-vocabulary/src/order-status.ts",
        cwd: "/repo",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a self-assigned array member keeps its local vocabulary",
        code: 'const holder = { values: ["draft", "published"] as const };\nholder.values = holder.values;\nexport const schema = z.enum(holder.values);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a self-assigned scalar member keeps its local vocabulary",
        code: 'const holder = { first: "draft", second: "published" };\nholder.first = holder.first;\nexport const schema = z.enum([holder.first, holder.second]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});
