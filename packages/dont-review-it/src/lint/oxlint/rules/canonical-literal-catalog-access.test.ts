import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { EMPTY_CANONICAL_VALUES_CATALOG } from "../lib/canonical-values/catalog.ts";
import { STRICT_CATALOG, STRICT_SOURCE } from "./canonical-literal-rule-test-fixture.ts";
import { createNoStrictCanonicalLiteralUseRule } from "./no-strict-canonical-literal-use--use-canonical-import.ts";

describe("canonical literal catalog access", () => {
  testLintRule(
    createNoStrictCanonicalLiteralUseRule({
      loadCatalog: () => {
        throw new Error("the catalog must not be built before a candidate literal appears");
      },
    }),
    {
      valid: [
        {
          name: "an out of scope source never reaches the catalog",
          code: 'const status = "draft";',
          filename: "/repo/packages/order/src/status.test.ts",
        },
        {
          name: "a source without any literal never reaches the catalog",
          code: "export const noop = () => {};",
          filename: STRICT_SOURCE,
        },
        {
          name: "a literal ruled out by its position never reaches the catalog",
          code: 'import { load } from "draft";\nexport const loader = load;',
          filename: STRICT_SOURCE,
        },
      ],
      invalid: [],
    },
  );

  testLintRule(
    createNoStrictCanonicalLiteralUseRule({
      loadCatalog: ({ repositoryRoot }) =>
        repositoryRoot === "/repo" ? STRICT_CATALOG : EMPTY_CANONICAL_VALUES_CATALOG,
    }),
    {
      valid: [
        {
          name: "a working directory outside the repository resolves no vocabulary",
          code: 'const status = "published";',
          filename: STRICT_SOURCE,
          cwd: "/elsewhere",
        },
      ],
      invalid: [
        {
          name: "the loader receives the workspace root found from the linter working directory",
          code: 'const status = "published";',
          filename: STRICT_SOURCE,
          cwd: "/repo",
          errors: [{ messageId: "canonicalValueLiteral" }],
        },
      ],
    },
  );
});
