import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withOwner } from "./canonical-value-rule-test-fixture.ts";

describe("dont-review-it/no-local-finite-value-set--use-or-register-canonical-values: module import identity", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "an import-equals module value keeps its registered export-equals route",
        code: 'import statuses = require("@mst/order-vocabulary/module");\nexport const schema = z.enum(statuses);',
      },
      {
        name: "a direct require module value keeps its registered export-equals route",
        code: 'export const schema = z.enum(require("@mst/order-vocabulary/module"));',
      },
    ],
    invalid: [
      {
        name: "an ESM namespace object does not match an export-equals module value route",
        code: 'import * as statuses from "@mst/order-vocabulary/module";\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a dynamic import object does not match an export-equals module value route",
        code: 'const statuses = await import("@mst/order-vocabulary/module");\nexport const schema = z.enum(statuses);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });
});
