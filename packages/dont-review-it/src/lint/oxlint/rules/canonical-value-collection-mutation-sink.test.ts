import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import {
  withNumericOwner,
  withOwner,
  withThreeValueOwner,
} from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: collection mutation sink", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "adding an existing value through a Set alias does not enlarge the vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nconst alias = statuses;\nalias.add("draft");\nexport { statuses };',
      },
      {
        name: "a statically dead array mutation does not enlarge the vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nif (false) statuses.push("archived");\nexport const schema = z.enum(statuses);',
      },
      {
        name: "an uncalled array mutation does not enlarge the vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nfunction mutate() { statuses.push("archived"); }\nexport { statuses };',
      },
      {
        name: "filling an array with an existing value does not enlarge the vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.fill("draft");\nexport const schema = z.enum(statuses);',
      },
      {
        name: "a statically dead fill does not enlarge the vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nif (false) statuses.fill("archived");\nexport const schema = z.enum(statuses);',
      },
      {
        name: "helper mutations are folded in actual call occurrence order",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nfunction removeAdded() { statuses.splice(2, 1); }\nfunction addArchived() { statuses.push("archived"); }\naddArchived();\nremoveAdded();\nexport const schema = z.enum(statuses);',
      },
      {
        name: "assigning zero length clears earlier array mutations",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.push("archived");\nstatuses.length = 0;\nexport const schema = z.enum(statuses);',
      },
      {
        name: "a mutation after the only schema sink does not change that sink",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nz.enum(statuses);\nstatuses.push("archived");',
      },
    ],
    invalid: [
      {
        name: "Set aliases share one effective mutation vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nconst alias = statuses;\nstatuses.add("archived");\nalias.add("deleted");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "array aliases share one effective mutation vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nconst alias = statuses;\nalias.push("archived", "deleted");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a called helper contributes its Set mutation",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nfunction mutate() { statuses.add("archived"); }\nmutate();\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a called helper parameter contributes its Set mutation",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = new Set(ORDER_STATUSES);\nfunction addStatus(value) { statuses.add(value); }\naddStatus("archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an incomplete scalar candidate cannot hide an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nconst statuses = new Set();\nstatuses.add(enabled ? ORDER_STATUSES : runtimeValue());\nexport { statuses };',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "array index writes through aliases replace one effective vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nconst alias = statuses;\nstatuses[0] = "archived";\nalias[1] = "deleted";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "array fill ranges replace one effective vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.fill("archived", 0, 1);\nstatuses.fill("deleted", 1, 2);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "array fill call replaces one effective vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.fill.call(statuses, "archived", 0, 1);\nstatuses.fill.call(statuses, "deleted", 1, 2);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "array fill apply replaces one effective vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.fill.apply(statuses, ["archived", 0, 1]);\nstatuses.fill.apply(statuses, ["deleted", 1, 2]);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "array fill call routes combine into one effective vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.fill.call(statuses, "archived", 0, 1);\nstatuses.fill.apply(statuses, ["deleted", 1, 2]);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "reversing helper call occurrences retains the added vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nfunction removeAdded() { statuses.splice(2, 1); }\nfunction addArchived() { statuses.push("archived"); }\nremoveAdded();\naddArchived();\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an insertion after assigning zero length contributes a new vocabulary",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nstatuses.length = 0;\nstatuses.push("archived", "deleted");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a later schema sink observes a mutation after an earlier sink",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst statuses = [...ORDER_STATUSES];\nz.enum(statuses);\nstatuses.push("archived");\nz.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });

  testLintRule(withThreeValueOwner, {
    valid: [
      {
        name: "a statically dead destructive array mutation does not change the vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nif (false) statuses.pop();\nexport const schema = z.enum(statuses);',
      },
      {
        name: "an uncalled destructive Set helper does not change the vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = new Set(WORKFLOW_STATUSES);\nfunction removeArchived() { statuses.delete("archived"); }\nexport { statuses };',
      },
      {
        name: "a destructive mutation after the schema sink does not change that sink",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nz.enum(statuses);\nstatuses.length = 2;',
      },
    ],
    invalid: [
      {
        name: "array pop removes the final canonical value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.pop();\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an Array from copy reports one owner-aware mutated vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = Array.from(WORKFLOW_STATUSES);\nstatuses.pop();\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array shift removes the first canonical value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.shift();\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "splice without deleteCount removes the canonical tail",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.splice(2);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "finite array length truncation removes canonical values",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.length = 2;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "copyWithin replaces the effective canonical vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.copyWithin(0, 1);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "deleting an array index preserves the remaining canonical vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\ndelete statuses[2];\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Set delete removes one canonical value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = new Set(WORKFLOW_STATUSES);\nstatuses.delete("archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Set clear followed by additions builds one effective vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = new Set(WORKFLOW_STATUSES);\nstatuses.clear();\nstatuses.add("draft");\nstatuses.add("published");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "array pop call removes the final canonical value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.pop.call(statuses);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "array shift apply removes the first canonical value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.shift.apply(statuses, []);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an array mutation method alias preserves its receiver",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nconst remove = statuses.pop;\nremove.call(statuses);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a called helper executes copyWithin",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nfunction overwrite() { statuses.copyWithin(0, 1); }\noverwrite();\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Set delete call removes one canonical value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = new Set(WORKFLOW_STATUSES);\nstatuses.delete.call(statuses, "archived");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Set clear apply resets the effective vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = new Set(WORKFLOW_STATUSES);\nstatuses.clear.apply(statuses, []);\nstatuses.add("draft");\nstatuses.add("published");\nexport { statuses };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "postfix length decrement truncates the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.length--;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "prefix length decrement truncates the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\n--statuses.length;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "compound length subtraction truncates the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.length -= 1;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "derived length assignment truncates the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.length = statuses.length - 1;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Object defineProperty length writes truncate the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nObject.defineProperty(statuses, "length", { value: 2 });\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Reflect set length writes truncate the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nReflect.set(statuses, "length", 2);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Object assign length writes truncate the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nObject.assign(statuses, { length: 2 });\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Object assign numeric writes append an effective array value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nObject.assign(statuses, { 3: "pending" });\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Object assign numeric writes replace an effective array value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nObject.assign(statuses, { 1: "pending" });\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Object defineProperties length descriptors truncate the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nObject.defineProperties(statuses, { length: { value: 2 } });\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Object defineProperties value descriptors replace an effective array value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nObject.defineProperties(statuses, { 1: { value: "pending" } });\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Reflect defineProperty length descriptors truncate the effective array vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nReflect.defineProperty(statuses, "length", { value: 2 });\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Reflect deleteProperty removes an effective array value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nReflect.deleteProperty(statuses, 2);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an accessor descriptor keeps an opaque effective array mutation",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nObject.defineProperty(statuses, 1, { get() { return "pending"; } });\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "string array length coercion truncates the effective vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.length = "2";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "boolean array length coercion retains a changed owner-derived singleton",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.length = true;\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "compound string length coercion truncates the effective vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.length -= "1";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "derived string length coercion truncates the effective vocabulary",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.length = statuses.length - "1";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "splice coerces string indexes and delete counts",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.splice("1", "1");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "fill coerces a string start index",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.fill("draft", "1");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "copyWithin coerces string indexes",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.copyWithin("0", "2");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "push expands a static spread argument",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.push(...["pending"]);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "splice expands static spread arguments",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses.splice(...[1, 1]);\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "an appended numeric index contributes a canonical value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses[3] = "pending";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a sparse numeric index contributes a canonical value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses[5] = "pending";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "logical or assignment writes an absent array index",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses[3] ||= "pending";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "nullish assignment writes an absent array index",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses[3] ??= "pending";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "logical and assignment replaces a truthy array value",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\nstatuses[1] &&= "pending";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "array destructuring assignment replaces indexed values in order",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst statuses = [...WORKFLOW_STATUSES];\n[statuses[0], statuses[1]] = ["pending", "archived"];\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });

  testLintRule(withNumericOwner, {
    valid: [],
    invalid: [
      {
        name: "postfix array index updates replace the effective numeric vocabulary",
        code: 'import { VALUES } from "@mst/retry-vocabulary";\nconst values = [...VALUES];\nvalues[1]++;\nexport { values };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "prefix array index updates replace the effective numeric vocabulary",
        code: 'import { VALUES } from "@mst/retry-vocabulary";\nconst values = [...VALUES];\n++values[1];\nexport { values };',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });
});
