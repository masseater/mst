import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: property and mutation state", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a dead finite member write does not replace a runtime member value",
        code: 'const holder = { statuses: runtimeValues() };\nif (false) holder.statuses = ["draft", "published"] as const;\nexport const schema = z.enum(holder.statuses);',
      },
      {
        name: "the last effective object property controls member resolution",
        code: 'const key = "statuses";\nconst source = { [key]: ["draft", "published"], statuses: getStatuses() };\nexport const schema = z.enum(source.statuses);',
      },
      {
        name: "an unknown trailing object spread prevents scalar vocabulary inference",
        code: 'const source = { draft: "draft", published: "published", ...runtimeValues() };\nexport const schema = z.enum([source.draft, source.published]);',
      },
      {
        name: "a later runtime JSON Schema property overwrites an earlier enum property",
        code: 'export const schema = { enum: ["draft", "published"], enum: runtimeValues() };',
      },
      {
        name: "adding an existing value leaves a registered Set vocabulary unchanged",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nstatuses.add("draft");\nexport { statuses };',
      },
      {
        name: "an unreachable Set addition leaves a registered vocabulary unchanged",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nif (false) statuses.add("archived");\nexport { statuses };',
      },
      {
        name: "an uncalled Set mutation leaves a registered vocabulary unchanged",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nfunction mutate() { statuses.add("archived"); }\nexport { statuses };',
      },
      {
        name: "a shadowed String constructor does not define a computed schema member",
        code: 'const String = runtimeBox;\nconst key = new String("enum");\nexport const schema = z[key](["draft", "published"]);',
      },
      {
        name: "a shadowed Object constructor does not define a computed schema member",
        code: 'const Object = runtimeBox;\nconst key = Object("enum");\nexport const schema = z[key](["draft", "published"]);',
      },
      {
        name: "a shadowed Symbol toPrimitive property is not a conversion method",
        code: 'const Symbol = { toPrimitive: "marker" };\nconst key = { [Symbol.toPrimitive]: () => "enum" };\nexport const schema = z[key](["draft", "published"]);',
      },
      {
        name: "an unknown toString result does not define a computed schema member",
        code: 'const key = { toString: () => runtimeKey() };\nexport const schema = z[key](["draft", "published"]);',
      },
      {
        name: "boxed strings remain objects in a value domain",
        code: 'export const schema = z.enum([new String("draft"), new String("published")]);',
      },
    ],
    invalid: [
      {
        name: "a call argument reaches a JSON Schema enum through a parameter",
        code: 'function schema(values) { return { enum: values }; }\nschema(["draft", "published"] as const);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an uncalled function unknown member write cannot hide an initial local vocabulary",
        code: 'const holder = { statuses: ["draft", "published"] as const };\nfunction mutate() { holder[runtimeKey()] = runtimeValues(); }\nexport const schema = z.enum(holder.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a trailing null spread cannot hide an earlier local object property",
        code: 'const holder = { statuses: ["draft", "published"] as const, ...null };\nexport const schema = z.enum(holder.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "the last statically computed object property controls member resolution",
        code: 'const key = "statuses";\nconst source = { statuses: getStatuses(), [key]: ["draft", "published"] as const };\nexport const schema = z.enum(source.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "object member scalar aliases remain visible to a schema enum",
        code: 'const holder = { draft: "draft", published: "published" };\nexport const schema = z.enum([holder.draft, holder.published]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "object member scalar aliases remain visible to a schema literal union",
        code: 'const holder = { draft: "draft", published: "published" };\nexport const schema = z.union([z.literal(holder.draft), z.literal(holder.published)]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "object member scalar aliases remain visible to a JSON Schema enum",
        code: 'const holder = { draft: "draft", published: "published" };\nexport const schema = { enum: [holder.draft, holder.published] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "object destructured scalar aliases remain visible to a schema enum",
        code: 'const { draft, published } = { draft: "draft", published: "published" };\nexport const schema = z.enum([draft, published]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "object destructured scalar aliases remain visible to a schema literal union",
        code: 'const { draft, published } = { draft: "draft", published: "published" };\nexport const schema = z.union([z.literal(draft), z.literal(published)]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "object destructured scalar aliases remain visible to a JSON Schema enum",
        code: 'const { draft, published } = { draft: "draft", published: "published" };\nexport const schema = { enum: [draft, published] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array destructured scalar aliases remain visible to a schema enum",
        code: 'const [draft, published] = ["draft", "published"];\nexport const schema = z.enum([draft, published]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array destructured scalar aliases remain visible to a schema literal union",
        code: 'const [draft, published] = ["draft", "published"];\nexport const schema = z.union([z.literal(draft), z.literal(published)]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array destructured scalar aliases remain visible to a JSON Schema enum",
        code: 'const [draft, published] = ["draft", "published"];\nexport const schema = { enum: [draft, published] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "computed object scalar aliases remain visible to a schema enum",
        code: 'const holder = { draft: "draft", published: "published" };\nconst draftKey = "draft";\nconst publishedKey = "published";\nexport const schema = z.enum([holder[draftKey], holder[publishedKey]]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "computed object scalar aliases remain visible to a schema literal union",
        code: 'const holder = { draft: "draft", published: "published" };\nconst draftKey = "draft";\nconst publishedKey = "published";\nexport const schema = z.union([z.literal(holder[draftKey]), z.literal(holder[publishedKey])]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "computed object scalar aliases remain visible to a JSON Schema enum",
        code: 'const holder = { draft: "draft", published: "published" };\nconst draftKey = "draft";\nconst publishedKey = "published";\nexport const schema = { enum: [holder[draftKey], holder[publishedKey]] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a dead scalar alias write cannot hide the earlier finite set",
        code: 'let DRAFT = "draft";\nexport const schema = z.union([z.literal(DRAFT), z.literal("published")]);\nDRAFT = runtimeStatus();',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unreachable object member write cannot hide the earlier finite set",
        code: 'const source = { statuses: ["draft", "published"] as const };\nif (false) source.statuses = runtimeStatuses();\nexport const schema = z.enum(source.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an object property assignment introduces a local vocabulary",
        code: 'const source = {};\nsource.statuses = ["draft", "published"] as const;\nexport const schema = z.enum(source.statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "schema literal scalar aliases preserve their vocabulary values",
        code: 'const DRAFT = "draft";\nconst PUBLISHED = "published";\nexport const schema = z.union([z.literal(DRAFT), z.literal(PUBLISHED)]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a numeric object property alias of a schema enum member cannot hide the vocabulary",
        code: 'const methods = { 0: z.enum };\nconst define = methods[0];\nexport const schema = define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a schema enum property assignment cannot hide the vocabulary",
        code: 'const methods = {};\nmethods.define = z.enum;\nexport const schema = methods.define(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a computed JSON Schema enum key declares the same vocabulary",
        code: 'export const schema = { ["enum"]: ["draft", "published"] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a statically named JSON Schema enum key declares the same vocabulary",
        code: 'const key = "enum";\nexport const schema = { [key]: ["draft", "published"] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a conditional computed JSON Schema key remains an enum candidate",
        code: 'const key = enabled ? "enum" : "enum";\nexport const schema = { [key]: ["draft", "published"] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an open conditional key preserves a known local collection candidate",
        code: 'declare const flag: boolean;\ndeclare const dynamicKey: string;\nconst key = flag ? "enum" : dynamicKey;\nconst holder = { [key]: ["draft", "published"] };\nexport const schema = z.enum(holder.enum);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unknown trailing computed property preserves scalar vocabulary candidates",
        code: 'const source = { draft: "draft", published: "published", [runtimeKey()]: runtimeValue() };\nexport const schema = z.enum([source.draft, source.published]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unknown trailing key preserves an earlier local collection candidate",
        code: 'declare const dynamicKey: string;\ndeclare const dynamicValue: unknown;\nconst holder = { enum: ["draft", "published"], [dynamicKey]: dynamicValue };\nexport const schema = z.enum(holder.enum);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Symbol toPrimitive method defines a computed schema member",
        code: 'const key = { [Symbol.toPrimitive]: () => "enum" };\nexport const schema = z[key](["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a toString method defines a computed schema member",
        code: 'const key = { toString: () => "enum" };\nexport const schema = z[key](["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a boxed String defines a computed schema member",
        code: 'const key = new String("enum");\nexport const schema = z[key](["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an Object wrapper defines a computed schema member",
        code: 'const key = Object("enum");\nexport const schema = z[key](["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Symbol toPrimitive method defines a computed JSON Schema member",
        code: 'const key = { [Symbol.toPrimitive]: () => "enum" };\nexport const schema = { [key]: ["draft", "published"] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a toString method defines a computed JSON Schema member",
        code: 'const key = { toString: () => "enum" };\nexport const schema = { [key]: ["draft", "published"] };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a trailing null spread cannot hide an earlier JSON Schema enum property",
        code: 'export const schema = { enum: ["draft", "published"], ...null };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a JSON Schema enum property assignment introduces a local vocabulary",
        code: 'const schema = {};\nschema.enum = ["draft", "published"];\nexport { schema };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a computed JSON Schema enum assignment introduces a local vocabulary",
        code: 'const schema = {};\nconst key = "enum";\nschema[key] = ["draft", "published"];\nexport { schema };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array destructuring into a JSON Schema enum property introduces a local vocabulary",
        code: 'const schema = {};\n[schema.enum] = [["draft", "published"]];\nconsume(schema);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.assign into a JSON Schema enum property introduces a local vocabulary",
        code: 'const schema = {};\nObject.assign(schema, { enum: ["draft", "published"] });\nexport { schema };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Reflect.set into a JSON Schema enum property introduces a local vocabulary",
        code: 'const schema = {};\nReflect.set(schema, "enum", ["draft", "published"]);\nexport { schema };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.defineProperty into a JSON Schema enum property introduces a local vocabulary",
        code: 'const schema = {};\nObject.defineProperty(schema, "enum", { value: ["draft", "published"] });\nexport { schema };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Object.defineProperties into a JSON Schema enum property introduces a local vocabulary",
        code: 'const schema = {};\nObject.defineProperties(schema, { enum: { value: ["draft", "published"] } });\nexport { schema };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Reflect.defineProperty into a JSON Schema enum property introduces a local vocabulary",
        code: 'const schema = {};\nReflect.defineProperty(schema, "enum", { value: ["draft", "published"] });\nexport { schema };',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "adding one value to a registered Set cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nstatuses.add("archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "adding two values to a registered Set cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nstatuses.add("archived");\nstatuses.add("deleted");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "chained Set additions cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nstatuses.add("archived").add("deleted");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an optional Set addition cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nstatuses?.add?.("archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "calling Set.add through call cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nstatuses.add.call(statuses, "archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "calling Set.prototype.add cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nSet.prototype.add.call(statuses, "archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a Set.add function stored in an object cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nconst methods = { append: statuses.add };\nmethods.append.call(statuses, "archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a Set.add function stored in an array cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nconst methods = [statuses.add];\nmethods[0].call(statuses, "archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a destructured Set.add function cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nconst { add } = statuses;\nadd.call(statuses, "archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });
});
