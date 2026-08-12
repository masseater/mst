import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { invocationStateRule } from "./canonical-value-invocation-test-fixture.ts";
import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: schema invocation resolution", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a false conditional does not select a schema enum callee",
        code: 'export const schema = (false ? z.enum : runtimeSchema)(["draft", "published"]);',
      },
      {
        name: "a non-nullish local function short-circuits before a schema enum callee",
        code: 'function consume(values) { return values; }\nexport const schema = (consume ?? z.enum)(["draft", "published"]);',
      },
      {
        name: "creating a bound schema function does not invoke it",
        code: "const define = z.enum.bind(z);\nconsume(define);",
      },
    ],
    invalid: [
      {
        name: "a static array handed straight to a schema enum defines the vocabulary here",
        code: 'export const schema = z.enum(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unreachable flag write cannot select a non-schema callee",
        code: 'let enabled = true;\nif (false) enabled = false;\nexport const schema = (enabled ? z.enum : consume)(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a dead schema union array alias write cannot hide the earlier finite set",
        code: 'let alternatives = [z.literal("draft"), z.literal("published")];\nexport const schema = z.union(alternatives);\nalternatives = runtimeAlternatives();',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a spread call argument keeps its local array value",
        code: 'export const schema = z.enum(...[["draft", "published"] as const]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a nested spread call argument keeps its local array value",
        code: 'const args = [["draft", "published"] as const] as const;\nexport const schema = z.enum(...[...args]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a destructuring assignment target member cannot hide a schema enum function",
        code: 'const methods = {};\n({ enum: methods.define } = z);\nexport const schema = methods.define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a schema union of literals is the same vocabulary in another syntax",
        code: 'export const schema = z.union([z.literal("draft"), z.literal("published")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a schema union literal array cannot hide behind a local binding",
        code: 'const alternatives = [z.literal("draft"), z.literal("published")];\nexport const schema = z.union(alternatives);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a schema union literal array cannot hide behind a spread argument",
        code: 'export const schema = z.union(...[[z.literal("draft"), z.literal("published")]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a schema union literal array cannot hide behind an object member",
        code: 'const source = { alternatives: [z.literal("draft"), z.literal("published")] };\nexport const schema = z.union(source.alternatives);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a schema union literal array cannot hide behind object destructuring",
        code: 'const { alternatives } = { alternatives: [z.literal("draft"), z.literal("published")] };\nexport const schema = z.union(alternatives);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a computed schema enum member cannot hide the vocabulary",
        code: 'export const schema = z["enum"](["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a statically named schema enum member cannot hide the vocabulary",
        code: 'const member = "enum";\nexport const schema = z[member](["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an optional schema enum member cannot hide the vocabulary",
        code: 'export const schema = z?.["enum"]?.(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an alias of a schema enum member cannot hide the vocabulary",
        code: 'const define = z.enum;\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a bound schema enum member cannot hide the vocabulary",
        code: 'const define = z.enum.bind(z);\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "calling a schema enum member through call cannot hide the vocabulary",
        code: 'export const schema = z.enum.call(z, ["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "calling Function call through call cannot hide the vocabulary",
        code: 'export const schema = Function.prototype.call.call(z.enum, null, ["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "calling Function apply through call cannot hide the vocabulary",
        code: 'export const schema = Function.prototype.apply.call(z.enum, null, [["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "calling Reflect apply through Reflect apply cannot hide the vocabulary",
        code: 'export const schema = Reflect.apply(Reflect.apply, null, [z.enum, null, [["draft", "published"]]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "calling Reflect apply through call cannot hide the vocabulary",
        code: 'export const schema = Reflect.apply.call(null, z.enum, null, [["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Function call bound to a schema enum cannot hide the vocabulary",
        code: 'const invoke = Function.prototype.call.bind(z.enum, null);\nexport const schema = invoke(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Function apply bound to a schema enum cannot hide the vocabulary",
        code: 'const invoke = Function.prototype.apply.bind(z.enum, null);\nexport const schema = invoke([["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an array property alias of a schema enum member cannot hide the vocabulary",
        code: 'const methods = [z.enum] as const;\nconst define = methods[0];\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a schema enum destructuring assignment cannot hide the vocabulary",
        code: 'let define;\n({ enum: define } = z);\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a pre-bound schema enum call route cannot hide the vocabulary",
        code: 'const define = z.enum.call.bind(z.enum, z);\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a pre-bound schema enum apply route cannot hide the vocabulary",
        code: 'const define = z.enum.apply.bind(z.enum, z);\nexport const schema = define([["draft", "published"]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "pre-bound schema union and literal bind routes cannot hide the vocabulary",
        code: 'const union = z.union.bind(z);\nconst literal = z.literal.bind(z);\nexport const schema = union([literal("draft"), literal("published")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "pre-bound schema union and literal call routes cannot hide the vocabulary",
        code: 'const union = z.union.call.bind(z.union, z);\nconst literal = z.literal.call.bind(z.literal, z);\nexport const schema = union([literal("draft"), literal("published")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "pre-bound schema union and literal apply routes cannot hide the vocabulary",
        code: 'const union = z.union.apply.bind(z.union, z);\nconst literal = z.literal.apply.bind(z.literal, z);\nexport const schema = union([[literal(["draft"]), literal(["published"])]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "destructuring a schema enum member cannot hide the vocabulary",
        code: 'const { enum: define } = z;\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a schema function in an object cannot hide the vocabulary",
        code: 'const methods = { define: z.enum };\nexport const schema = methods.define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an alias of a schema function in an object cannot hide the vocabulary",
        code: 'const methods = { define: z.enum };\nconst define = methods.define;\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a destructured schema function in an object cannot hide the vocabulary",
        code: 'const methods = { define: z.enum };\nconst { define } = methods;\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "conditional schema enum functions cannot hide the vocabulary",
        code: 'const define = choose ? z.enum : z.picklist;\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "nullish schema enum functions cannot hide the vocabulary",
        code: 'const define = z.enum ?? z.picklist;\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an imported schema enum alias cannot hide the vocabulary",
        code: 'import { enum as define } from "schema-library";\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "computed schema union and literal members cannot hide the vocabulary",
        code: 'export const schema = z["union"]([z["literal"]("draft"), z["literal"]("published")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "aliases of schema union and literal members cannot hide the vocabulary",
        code: 'const union = z.union;\nconst literal = z.literal;\nexport const schema = union([literal("draft"), literal("published")]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an options schema of a lint rule declares an enum",
        code: 'export const schema = [{ type: "object", properties: { status: { enum: ["draft", "published"] } } }];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a self-assigned schema method keeps its finite invocation",
        code: 'const methods = { define: z.enum };\nmethods.define = methods.define;\nexport const schema = methods.define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "partially bound schema literals keep their vocabulary values",
        code: 'const methods = { draft: z.literal.bind(z, "draft"), published: z.literal.bind(z, "published") };\nexport const schema = z.union([methods.draft(), methods.published()]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unknown conditional union member write cannot hide a local vocabulary",
        code: 'const holder = { alternatives: [z.literal("draft"), z.literal("published")] };\nif (runtimeFlag) holder.alternatives = runtimeAlternatives();\nz.union(holder.alternatives);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});

describe("canonical value invocation normalization", () => {
  testLintRule(invocationStateRule, {
    valid: [
      {
        name: "a require member argument preserves its module property origin",
        code: 'expectArgumentOrigin(z.enum(require("@mst/order-vocabulary").ORDER_STATUSES), "closed:require(\\"@mst/order-vocabulary\\")|property:ORDER_STATUSES");',
      },
      {
        name: "a require call is not a schema invocation",
        code: 'expectInvocation(require("@mst/order-vocabulary"), "open:");',
      },
      {
        name: "a direct schema member preserves its receiver and arguments",
        code: 'expectInvocation(z.enum(statuses), "closed:schema:enum:z|property:enum|this:z|args:direct:statuses");',
      },
      {
        name: "call normalizes its explicit receiver",
        code: 'expectInvocation(z.enum.call(z, statuses), "closed:schema:enum:z|property:enum|this:z|args:direct:statuses");',
      },
      {
        name: "array fill call keeps its target receiver and arguments",
        code: 'const statuses = [];\nexpectFact(statuses.fill.call(statuses, "archived"), \'closed:[]|property:fill|this:statuses|args:direct:"archived"\');',
      },
      {
        name: "array fill apply keeps its target receiver and argument array",
        code: 'const statuses = [];\nconst args = ["archived"];\nexpectFact(statuses.fill.apply(statuses, args), "closed:[]|property:fill|this:statuses|args:array:args");',
      },
      {
        name: "apply preserves its argument array",
        code: 'expectInvocation(z.enum.apply(z, args), "closed:schema:enum:z|property:enum|this:z|args:array:args");',
      },
      {
        name: "Reflect apply preserves target provenance",
        code: 'expectInvocation(Reflect.apply(z.union, z, alternatives), "closed:schema:union:z|property:union|this:z|args:array:alternatives");',
      },
      {
        name: "Function call through call recursively normalizes its target",
        code: 'expectInvocation(Function.prototype.call.call(z.enum, null, statuses), "closed:schema:enum:z|property:enum|this:null|args:direct:statuses");',
      },
      {
        name: "Function apply through call recursively normalizes its target",
        code: 'expectInvocation(Function.prototype.apply.call(z.enum, null, [statuses]), "closed:schema:enum:z|property:enum|this:null|args:array:[statuses]");',
      },
      {
        name: "Reflect apply through Reflect apply recursively normalizes its target",
        code: 'expectInvocation(Reflect.apply(Reflect.apply, null, [z.enum, z, [statuses]]), "closed:schema:enum:z|property:enum|this:z|args:array:[statuses]");',
      },
      {
        name: "Reflect apply through call recursively normalizes its target",
        code: 'expectInvocation(Reflect.apply.call(null, z.enum, z, [statuses]), "closed:schema:enum:z|property:enum|this:z|args:array:[statuses]");',
      },
      {
        name: "a bound Function call recursively normalizes its target",
        code: 'const invoke = Function.prototype.call.bind(z.enum, null);\nexpectInvocation(invoke(statuses), "closed:schema:enum:z|property:enum|this:null|args:direct:statuses");',
      },
      {
        name: "a bound Function apply recursively normalizes its target",
        code: 'const invoke = Function.prototype.apply.bind(z.enum, null);\nexpectInvocation(invoke([statuses]), "closed:schema:enum:z|property:enum|this:null|args:array:[statuses]");',
      },
      {
        name: "a partial bind prepends its arguments",
        code: `const define = z.literal.bind(z, "draft");
expectInvocation(define(), 'closed:schema:literal:z|property:literal|this:z|args:direct:"draft"');`,
      },
      {
        name: "bind creation has no invocation fact",
        code: 'expectFact(z.enum.bind(z), "closed:");',
      },
      {
        name: "a pre-bound call route is normalized once",
        code: 'const define = z.enum.call.bind(z.enum, z);\nexpectInvocation(define(statuses), "closed:schema:enum:z|property:enum|this:z|args:direct:statuses");',
      },
      {
        name: "object aliases preserve the original schema expression",
        code: 'const methods = { define: z.picklist };\nexpectInvocation(methods.define(statuses), "closed:schema:picklist:z|property:picklist|this:methods|args:direct:statuses");',
      },
      {
        name: "a named schema import remains an expression origin",
        code: 'import { enum as define } from "schema-library";\nexpectInvocation(define(statuses), "closed:schema:enum:define|this:none|args:direct:statuses");',
      },
      {
        name: "unknown schema branches retain every target",
        code: 'expectInvocation((enabled ? z.enum : z.picklist)(statuses), "closed:schema:enum:z|property:enum|this:none|args:direct:statuses;schema:picklist:z|property:picklist|this:none|args:direct:statuses");',
      },
      {
        name: "a statically rejected schema branch leaves an open empty target set",
        code: 'expectInvocation((false ? z.enum : runtimeSchema)(statuses), "open:");',
      },
      {
        name: "an uncalled write cannot replace an outer schema alias",
        code: 'let define = z.enum;\nfunction mutate() { define = runtimeSchema; }\nexpectInvocation(define(statuses), "closed:schema:enum:z|property:enum|this:none|args:direct:statuses");',
      },
      {
        name: "the built-in Set survives an alias",
        code: 'const Collection = Set;\nexpectInvocation(new Collection(statuses), "closed:set-constructor:Set|this:none|args:direct:statuses");',
      },
      {
        name: "a reassigned Set alias becomes unknown",
        code: 'let Collection = Set;\nCollection = Fake;\nexpectInvocation(new Collection(statuses), "open:");',
      },
      {
        name: "Set add through call preserves the mutated receiver",
        code: `const statuses = new Set(initial);
expectInvocation(statuses.add.call(statuses, "archived"), 'closed:set-add:new Set(initial)|property:add|receiver:new Set(initial)|this:statuses|args:direct:"archived"');`,
      },
      {
        name: "direct Set add preserves its implicit receiver",
        code: 'const statuses = new Set(initial);\nexpectInvocation(statuses.add(archived), "closed:set-add:new Set(initial)|property:add|receiver:new Set(initial)|this:statuses|args:direct:archived");',
      },
      {
        name: "Set delete through call preserves the mutated receiver",
        code: `const statuses = new Set(initial);
expectInvocation(statuses.delete.call(statuses, "archived"), 'closed:set-delete:new Set(initial)|property:delete|receiver:new Set(initial)|this:statuses|args:direct:"archived"');`,
      },
      {
        name: "Set clear through apply preserves the mutated receiver",
        code: `const statuses = new Set(initial);
expectInvocation(statuses.clear.apply(statuses, []), "closed:set-clear:new Set(initial)|property:clear|receiver:new Set(initial)|this:statuses|args:array:[]");`,
      },
      {
        name: "Set prototype add is recognized by global identity",
        code: `expectInvocation(Set.prototype.add.call(statuses, "archived"), 'closed:set-add:Set|property:prototype.add|receiver:Set|property:prototype|this:statuses|args:direct:"archived"');`,
      },
      {
        name: "a destructured Set add alias keeps the Set receiver",
        code: `const statuses = new Set(initial);
const { append } = { append: statuses.add };
expectInvocation(append.call(statuses, "archived"), 'closed:set-add:new Set(initial)|property:add|receiver:new Set(initial)|this:statuses|args:direct:"archived"');`,
      },
      {
        name: "an array alias preserves the schema target",
        code: 'const methods = [z.enum] as const;\nexpectInvocation(methods[0](statuses), "closed:schema:enum:z|property:enum|this:methods|args:direct:statuses");',
      },
      {
        name: "object destructuring preserves the schema target",
        code: 'const { define } = { define: z.union };\nexpectInvocation(define(alternatives), "closed:schema:union:z|property:union|this:none|args:direct:alternatives");',
      },
      {
        name: "a cyclic alias remains open",
        code: 'let define = define;\nexpectInvocation(define(statuses), "open:");',
      },
    ],
    invalid: [],
  });
});
