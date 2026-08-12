import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: JSON Schema objects", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "an imported plugin rule behind an unknown computed key is not a JSON Schema enum",
        code: 'import { ORDER_STATUSES as rule } from "@mst/order-vocabulary/shadow";\nexport const plugin = { rules: { [rule.name]: rule } };',
      },
      {
        name: "a call returning an imported non-schema value is not a JSON Schema enum",
        code: 'import { ORDER_STATUSES as index } from "@mst/order-vocabulary/shadow";\nfunction buildIndex() { return index; }\nexport const built = buildIndex();',
      },
    ],
    invalid: [
      {
        name: "a statically named JSON Schema enum keeps an unregistered route",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary/shadow";\nexport const schema = { enum: ORDER_STATUSES };',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });
});
