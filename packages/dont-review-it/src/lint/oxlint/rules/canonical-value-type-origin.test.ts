import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: type and collection origin", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a locally shadowed Set constructor is not the built-in collection",
        code: 'class Set { constructor(values) { this.values = values; } }\nexport const statuses = new Set(["draft", "published"]);',
      },
      {
        name: "a false conditional does not select the built-in Set constructor",
        code: 'export const statuses = new (false ? Set : Fake)(["draft", "published"]);',
      },
      {
        name: "a truthy local constructor short-circuits before the built-in Set constructor",
        code: 'class LocalSet {}\nexport const statuses = new (LocalSet || Set)(["draft", "published"]);',
      },
      {
        name: "an indexed access array whose values no concept owns is not a candidate",
        code: 'const SIZES = ["small", "large"] as const;\nexport type Size = (typeof SIZES)[number];',
      },
    ],
    invalid: [
      {
        name: "a local object member in a type indexed access keeps its array value",
        code: 'const source = { statuses: ["draft", "published"] as const };\nexport type Status = (typeof source.statuses)[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a scalar literal type alias declares a vocabulary",
        code: 'export type OrderStatus = "draft" | "published";',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "template literals spell the same vocabulary as quoted literals",
        code: "export type OrderStatus = `draft` | `published`;",
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a static array behind an indexed access matches a registered value set",
        code: 'const STATUSES = ["draft", "published"] as const;\nexport type OrderStatus = (typeof STATUSES)[number];',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a static set initializer matches a registered value set",
        code: 'const STATUSES = new Set(["draft", "published"]);\nexport const has = (status) => STATUSES.has(status);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an alias of the built-in Set constructor cannot hide a value set",
        code: 'const Collection = Set;\nexport const statuses = new Collection(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an assigned alias of the built-in Set constructor cannot hide a value set",
        code: 'let Collection;\nCollection = Set;\nexport const statuses = new Collection(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a conditional built-in Set constructor cannot hide a value set",
        code: 'export const statuses = new (enabled ? Set : Set)(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a logical built-in Set constructor cannot hide a value set",
        code: 'export const statuses = new (Set || Set)(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a sequence ending in the built-in Set constructor cannot hide a value set",
        code: 'export const statuses = new (0, Set)(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an assignment of the built-in Set constructor cannot hide a value set",
        code: 'let Collection;\nexport const statuses = new (Collection = Set)(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an object member alias of the built-in Set constructor keeps a local value set",
        code: 'const constructors = { Collection: Set };\nexport const statuses = new constructors.Collection(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a destructured alias of the built-in Set constructor keeps a local value set",
        code: 'const { Set: Collection } = globalThis;\nexport const statuses = new Collection(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an array member alias of the built-in Set constructor keeps a local value set",
        code: 'const constructors = [Set];\nexport const statuses = new constructors[0](["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a bound alias of the built-in Set constructor keeps a local value set",
        code: 'const Collection = Set.bind(null);\nexport const statuses = new Collection(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "the global Set constructor cannot hide behind member access",
        code: 'export const statuses = new globalThis["Set"](["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a self-assigned Set constructor keeps its finite collection",
        code: 'const constructors = { Collection: Set };\nconstructors.Collection = constructors.Collection;\nexport const statuses = new constructors.Collection(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an unknown conditional constructor write cannot hide the built-in Set",
        code: 'class LocalSet<T> { constructor(_values: readonly T[]) {} }\nlet Make: typeof Set | typeof LocalSet = Set;\nif (runtimeFlag) Make = LocalSet;\nnew Make(["draft", "published"]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Readonly cannot hide an unregistered type origin",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\ntype Values = Readonly<typeof ORDER_STATUSES>;\nexport type Status = Values[number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a tuple spread cannot hide an unregistered type origin",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\ntype Values = [...typeof ORDER_STATUSES];\nexport type Status = Values[number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });
});
