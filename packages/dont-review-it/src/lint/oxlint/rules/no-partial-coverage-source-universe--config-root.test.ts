import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noPartialCoverageSourceUniverse } from "./no-partial-coverage-source-universe--include-production-files.ts";

describe("coverage config root", () => {
  testLintRule(noPartialCoverageSourceUniverse, {
    valid: [],
    invalid: [
      {
        name: "a literal top-level root cannot move discovery outside the package",
        code: `export default { root: "../other-package", test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
        filename: "vite.config.ts",
        errors: [{ messageId: "testRootMovesSourceUniverse" }],
        output: `export default { test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
      },
      {
        name: "a computed top-level root is reported without deleting its evaluation",
        code: `const configuredRoot = () => "../other-package";\nexport default { root: configuredRoot(), test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
        filename: "vitest.config.ts",
        errors: [{ messageId: "testRootMovesSourceUniverse" }],
        output: null,
      },
      {
        name: "duplicate roots are reported without exposing an earlier effective value",
        code: `const configuredRoot = () => "../other-package";\nexport default { root: configuredRoot(), root: ".", test: { coverage: { include: ["src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"] } } };`,
        filename: "vite.config.ts",
        errors: [{ messageId: "testRootMovesSourceUniverse" }],
        output: null,
      },
    ],
  });
});
