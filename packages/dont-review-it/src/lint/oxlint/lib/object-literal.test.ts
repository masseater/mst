import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noPartialCoverageSourceUniverse } from "../rules/no-partial-coverage-source-universe--include-production-files.ts";

const pattern = "src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}";

describe("removeObjectPropertyFix", () => {
  testLintRule(noPartialCoverageSourceUniverse, {
    valid: [],
    invalid: [
      {
        name: "a changed property first in an object is deleted",
        code: `export default { test: { changed: "HEAD", coverage: { include: ["${pattern}"] } } };`,
        filename: "vite.config.ts",
        errors: [{ messageId: "changedCoverageSourceUniverse" }],
        output: `export default { test: { coverage: { include: ["${pattern}"] } } };`,
      },
      {
        name: "a quoted changed property first in an object is deleted",
        code: `export default { test: { "changed": "HEAD", coverage: { include: ["${pattern}"] } } };`,
        filename: "vite.config.ts",
        errors: [{ messageId: "changedCoverageSourceUniverse" }],
        output: `export default { test: { coverage: { include: ["${pattern}"] } } };`,
      },
      {
        name: "a changed property in the middle of an object is deleted",
        code: `export default { test: { pool: "threads", changed: true, coverage: { include: ["${pattern}"] } } };`,
        filename: "vite.config.ts",
        errors: [{ messageId: "changedCoverageSourceUniverse" }],
        output: `export default { test: { pool: "threads", coverage: { include: ["${pattern}"] } } };`,
      },
      {
        name: "a changed property last in an object is deleted",
        code: `export default { test: { coverage: { include: ["${pattern}"] }, changed: "HEAD" } };`,
        filename: "vite.config.ts",
        errors: [{ messageId: "changedCoverageSourceUniverse" }],
        output: `export default { test: { coverage: { include: ["${pattern}"] } } };`,
      },
      {
        name: "a sole changed property is deleted",
        code: `export default { test: { changed: true } };`,
        filename: "vite.config.ts",
        errors: [
          { messageId: "missingProductionSourcePattern" },
          { messageId: "changedCoverageSourceUniverse" },
        ],
        output: `export default { test: { } };`,
      },
      {
        name: "a final changed property and its trailing comma are deleted",
        code: `export default { test: { coverage: { include: ["${pattern}"] }, changed: true, } };`,
        filename: "vite.config.ts",
        errors: [{ messageId: "changedCoverageSourceUniverse" }],
        output: `export default { test: { coverage: { include: ["${pattern}"] } } };`,
      },
      {
        name: "a sole changed property with a trailing comma is deleted",
        code: `export default { test: { changed: true, } };`,
        filename: "vite.config.ts",
        errors: [
          { messageId: "missingProductionSourcePattern" },
          { messageId: "changedCoverageSourceUniverse" },
        ],
        output: `export default { test: { } };`,
      },
      {
        name: "a computed coverage property is not mistaken for a static key",
        code: `const key = "changed";\nexport default { test: { coverage: { include: ["${pattern}"], [key]: true } } };`,
        filename: "vite.config.ts",
        errors: [{ messageId: "dynamicCoverageConfiguration" }],
        output: null,
      },
    ],
  });
});
