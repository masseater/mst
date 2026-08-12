import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: canonical import route origin", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "an enum fed from an external package is not a repository vocabulary",
        code: 'import { STATUSES } from "order-statuses";\nexport const schema = z.enum(STATUSES);',
      },
      {
        name: "an indexed access over a registered export path stays derived",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport type OrderStatus = (typeof ORDER_STATUSES)[number];',
      },
      {
        name: "a namespace member on a registered export path stays derived",
        code: 'import * as vocabulary from "@mst/order-vocabulary";\nexport const schema = z.enum(vocabulary.ORDER_STATUSES);',
      },
      {
        name: "a static computed namespace member on a registered export path stays derived",
        code: 'import * as vocabulary from "@mst/order-vocabulary";\nexport const schema = z.enum(vocabulary["ORDER_STATUSES"]);',
      },
      {
        name: "a computed namespace member with a const key keeps the registered route",
        code: 'import * as vocabulary from "@mst/order-vocabulary";\nconst key = "ORDER_STATUSES";\nexport const schema = z.enum(vocabulary[key]);',
      },
      {
        name: "spreading only the registered owner stays derived",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport const schema = z.enum([...ORDER_STATUSES]);',
      },
      {
        name: "one local alias of a registered import stays derived",
        code: 'import { ORDER_STATUSES as importedStatuses } from "@mst/order-vocabulary";\nconst statuses = importedStatuses;\nexport const schema = z.enum(statuses);',
      },
      {
        name: "a direct require member keeps its registered route",
        code: 'export const schema = z.enum(require("@mst/order-vocabulary").ORDER_STATUSES);',
      },
      {
        name: "a require namespace alias keeps its registered route",
        code: 'const vocabulary = require("@mst/order-vocabulary");\nexport const schema = z.enum(vocabulary.ORDER_STATUSES);',
      },
      {
        name: "a direct dynamic import member keeps its registered route",
        code: 'export const schema = z.enum((await import("@mst/order-vocabulary")).ORDER_STATUSES);',
      },
      {
        name: "a dynamic import namespace alias keeps its registered route",
        code: 'const vocabulary = await import("@mst/order-vocabulary");\nexport const schema = z.enum(vocabulary.ORDER_STATUSES);',
      },
      {
        name: "a straight-line registered overwrite replaces an earlier local vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nlet statuses = ["archived", "deleted"] as const;\nstatuses = ORDER_STATUSES;\nexport const schema = z.enum(statuses);',
      },
      {
        name: "a relative import that resolves to the annotated declaration stays derived",
        code: 'import { ORDER_STATUSES } from "./order-status.ts";\nexport const schema = z.enum(ORDER_STATUSES);',
        filename: "/repo/packages/order-vocabulary/src/schema.ts",
        cwd: "/repo",
      },
      {
        name: "an absolute import that resolves to the annotated declaration stays derived",
        code: 'import { ORDER_STATUSES } from "/repo/packages/order-vocabulary/src/order-status.ts";\nexport const schema = z.enum(ORDER_STATUSES);',
        filename: "/repo/packages/order/src/schema.ts",
        cwd: "/repo",
      },
      {
        name: "a set filled from an external import declares no vocabulary here",
        code: 'import { HTTP_METHOD_HINTS } from "http-method-hints";\nconst known = new Set(HTTP_METHOD_HINTS);\nexport const has = (hint) => known.has(hint);',
        filename: "packages/order/src/known.ts",
      },
      {
        name: "an indexed access over an external import declares no vocabulary here",
        code: 'import { HTTP_METHOD_HINTS } from "http-method-hints";\nexport type Hint = (typeof HTTP_METHOD_HINTS)[number];',
        filename: "packages/order/src/hint.ts",
      },
    ],
    invalid: [
      {
        name: "a local binding that shadows a registered import remains local",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport function schema() {\n  const ORDER_STATUSES = ["draft", "published"] as const;\n  return z.enum(ORDER_STATUSES);\n}',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a direct require member cannot hide an unregistered route",
        code: 'export const schema = z.enum(require("@mst/order-vocabulary/shadow").ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a require namespace alias cannot hide an unregistered route",
        code: 'const shadow = require("@mst/order-vocabulary/shadow");\nexport const schema = z.enum(shadow.ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a direct dynamic import member cannot hide an unregistered route",
        code: 'export const schema = z.enum((await import("@mst/order-vocabulary/shadow")).ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a dynamic import namespace alias cannot hide an unregistered route",
        code: 'const shadow = await import("@mst/order-vocabulary/shadow");\nexport const schema = z.enum(shadow.ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an import-equals module value cannot hide an unregistered route",
        code: 'import shadow = require("@mst/order-vocabulary/shadow");\nexport const schema = z.enum(shadow);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a direct require module value cannot hide an unregistered route",
        code: 'export const schema = z.enum(require("@mst/order-vocabulary/shadow"));',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a dynamic import module value cannot hide an unregistered route",
        code: 'const shadow = await import("@mst/order-vocabulary/shadow");\nexport const schema = z.enum(shadow);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a default parameter that shadows a registered import remains local",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport function schema(ORDER_STATUSES = ["draft", "published"] as const) {\n  return z.enum(ORDER_STATUSES);\n}',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a destructuring assignment target member cannot hide an unregistered route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst target = {};\n({ ORDER_STATUSES: target.values } = shadow);\nexport const schema = z.enum(target.values);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a JSON Schema enum property assignment cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst schema = {};\nschema.enum = ORDER_STATUSES;\nexport { schema };',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a computed JSON Schema enum assignment cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst schema = {};\nconst key = "enum";\nschema[key] = ORDER_STATUSES;\nexport { schema };',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a registered spread cannot hide locally added values",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport const schema = z.enum([...ORDER_STATUSES, "archived", "deleted"]);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "pushing two values onto a registered array cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.push("archived", "deleted");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "unshifting two values onto a registered array cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.unshift("archived", "deleted");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "splicing two values into a registered array cannot hide the enlarged vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.splice(0, 0, "archived", "deleted");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "index writes cannot hide values replacing a registered array",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses[0] = "archived";\nstatuses[1] = "deleted";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a Set cannot hide values added to a registered spread",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport const statuses = new Set([...ORDER_STATUSES, "archived", "deleted"]);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an indexed access cannot hide values added to a registered spread",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst STATUSES = [...ORDER_STATUSES, "archived", "deleted"] as const;\nexport type Status = (typeof STATUSES)[number];',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "scalar aliases cannot hide values added to a registered schema spread",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst ARCHIVED = "archived";\nconst DELETED = "deleted";\nexport const schema = z.enum([...ORDER_STATUSES, ARCHIVED, DELETED]);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "scalar aliases cannot hide values added to a registered Set spread",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst ARCHIVED = "archived";\nconst DELETED = "deleted";\nexport const statuses = new Set([...ORDER_STATUSES, ARCHIVED, DELETED]);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "scalar aliases cannot hide values added to a registered indexed access spread",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst ARCHIVED = "archived";\nconst DELETED = "deleted";\nconst STATUSES = [...ORDER_STATUSES, ARCHIVED, DELETED] as const;\nexport type Status = (typeof STATUSES)[number];',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an object member alias of the built-in Set constructor cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst constructors = { Collection: Set };\nexport const statuses = new constructors.Collection(ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a destructured alias of the built-in Set constructor cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst { Set: Collection } = globalThis;\nexport const statuses = new Collection(ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an array member alias of the built-in Set constructor cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst constructors = [Set];\nexport const statuses = new constructors[0](ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a bound alias of the built-in Set constructor cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst Collection = Set.bind(null);\nexport const statuses = new Collection(ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a relative import the catalog does not resolve is an unregistered route",
        code: 'import { STATUSES } from "./statuses.ts";\nexport const schema = z.enum(STATUSES);',
        filename: "/repo/packages/order/src/schema.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a repository import cannot hide behind a Set candidate",
        code: 'import { HTTP_METHOD_HINTS } from "./probe-plain.ts";\nconst known = new Set(HTTP_METHOD_HINTS);\nexport const has = (hint) => known.has(hint);',
        filename: "/repo/packages/order/src/known.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a repository import cannot hide behind an indexed access candidate",
        code: 'import { HTTP_METHOD_HINTS } from "./probe-plain.ts";\nexport type Hint = (typeof HTTP_METHOD_HINTS)[number];',
        filename: "/repo/packages/order/src/hint.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a namespace import from a shadow subpath is unregistered",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nexport const schema = z.enum(shadow.ORDER_STATUSES);',
        filename: "/repo/packages/order/src/schema.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an array string index cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst holder = [ORDER_STATUSES];\nexport const schema = z.enum(holder["0"]);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an array spread cannot hide an unregistered route at an index greater than zero",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst holder = [null, ...[ORDER_STATUSES]];\nexport const schema = z.enum(holder[1]);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "array destructuring cannot hide an unregistered spread route after index zero",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst [, values] = [null, ...[ORDER_STATUSES]];\nexport const schema = z.enum(values);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a TypeScript bracket indexed namespace alias cannot hide an unregistered route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst holder = shadow;\nexport type Status = (typeof holder["ORDER_STATUSES"])[number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an intermediate TypeScript values alias cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\ntype Values = typeof ORDER_STATUSES;\nexport type Status = Values[number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a generic identity TypeScript alias cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\ntype Box<T> = T;\nexport type Status = Box<typeof ORDER_STATUSES>[number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a bracket wrapper TypeScript values alias cannot hide an unregistered route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\ntype Values = typeof shadow["ORDER_STATUSES"];\nexport type Status = Values[number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a conditional namespace receiver cannot hide an unregistered route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nexport const schema = z.enum((enabled ? shadow : shadow).ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a sequence namespace receiver cannot hide an unregistered route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nexport const schema = z.enum((0, shadow).ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a nested object rest cannot hide an unregistered namespace route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst { holder: { ...rest } } = { holder: shadow };\nexport const schema = z.enum(rest.ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an object destructuring assignment cannot hide an unregistered namespace route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nlet statuses;\n({ ORDER_STATUSES: statuses } = shadow);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an array destructuring assignment cannot hide an unregistered named route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nlet statuses;\n[statuses] = [ORDER_STATUSES];\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a member property write cannot leave a registered route exempt",
        code: 'import * as vocabulary from "@mst/order-vocabulary";\nvocabulary.ORDER_STATUSES = ["archived", "deleted"] as const;\nexport const schema = z.enum(vocabulary.ORDER_STATUSES);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an object spread cannot hide an unregistered namespace import",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst alias = { ...shadow };\nexport const schema = z.enum(alias.ORDER_STATUSES);',
        filename: "/repo/packages/order/src/schema.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "nested destructuring cannot hide an unregistered namespace import",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst { holder: { ORDER_STATUSES } } = { holder: shadow };\nexport const schema = z.enum(ORDER_STATUSES);',
        filename: "/repo/packages/order/src/schema.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a computed namespace member cannot impersonate a registered binding",
        code: 'import * as vocabulary from "@mst/order-vocabulary";\nconst ORDER_STATUSES = "SHADOW_STATUSES";\nexport const schema = z.enum(vocabulary[ORDER_STATUSES]);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a namespace member in an indexed access keeps its route identity",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nexport type Status = (typeof shadow.ORDER_STATUSES)[number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a namespace string index in an indexed access keeps its route identity",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nexport type Status = (typeof shadow)["ORDER_STATUSES"][number];',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an absolute repository path cannot hide an unregistered binding",
        code: 'import { ORDER_STATUSES } from "/repo/packages/order-vocabulary/src/shadow.ts";\nexport const schema = z.enum(ORDER_STATUSES);',
        filename: "/repo/packages/order/src/schema.ts",
        cwd: "/repo",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a non-null assertion cannot hide an unregistered import",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nexport const schema = z.enum(ORDER_STATUSES!);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "one local alias cannot hide an unregistered named import",
        code: 'import { ORDER_STATUSES as importedStatuses } from "@mst/order-vocabulary/shadow";\nconst statuses = importedStatuses;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an alias chain cannot hide an unregistered named import",
        code: 'import { ORDER_STATUSES as importedStatuses } from "@mst/order-vocabulary/shadow";\nconst first = importedStatuses;\nconst second = first;\nexport const schema = z.enum(second);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "one local alias cannot hide an unregistered namespace member",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst statuses = shadow.ORDER_STATUSES;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "namespace destructuring cannot hide an unregistered import",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst { ORDER_STATUSES: statuses } = shadow;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "dynamic namespace destructuring cannot impersonate a registered binding",
        code: 'import * as vocabulary from "@mst/order-vocabulary";\nconst ORDER_STATUSES = "SHADOW_STATUSES";\nconst { [ORDER_STATUSES]: statuses } = vocabulary;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a namespace alias before destructuring cannot hide an unregistered import",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst alias = shadow;\nconst { ORDER_STATUSES: statuses } = alias;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an array spread cannot hide an unregistered import",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst statuses = [...ORDER_STATUSES];\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "array destructuring into a JSON Schema enum property keeps an unregistered route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst schema = {};\n[schema.enum] = [shadow.ORDER_STATUSES];\nconsume(schema);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a template-computed namespace destructure cannot hide an unregistered route",
        code: 'import * as shadow from "@mst/order-vocabulary/shadow";\nconst suffix = "STATUSES";\nconst { [`ORDER_${suffix}`]: statuses } = shadow;\nz.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a TypeScript import-equals namespace keeps its unregistered route",
        code: 'import shadow = require("@mst/order-vocabulary/shadow");\nexport const schema = z.enum(shadow.ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "destructuring a TypeScript import-equals namespace keeps its unregistered route",
        code: 'import shadow = require("@mst/order-vocabulary/shadow");\nconst { ORDER_STATUSES } = shadow;\nexport const schema = z.enum(ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });
});
