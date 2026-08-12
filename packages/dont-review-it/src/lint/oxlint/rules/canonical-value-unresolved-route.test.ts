import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { writeCanonicalValuesTestFiles } from "../lib/canonical-values/canonical-values-test-fixture.ts";
import { type CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";
import { ownedCatalog, withOwner } from "./canonical-value-rule-test-fixture.ts";
import { canonicalValueUnregisteredRouteFromUnresolvedOrigin } from "./canonical-value-unresolved-route.ts";

import type { ESTree } from "@oxlint/plugins";

const identifierFrom = (source: string): ESTree.IdentifierReference => {
  const parsed = parseSync("source.ts", source);
  const [statement] = parsed.program.body;
  if (
    parsed.errors.length !== 0 ||
    statement?.type !== "ExpressionStatement" ||
    statement.expression.type !== "Identifier"
  ) {
    throw new Error(`Expected one identifier expression: ${source}`);
  }
  return statement.expression as ESTree.IdentifierReference;
};

const unresolvedBindingIndex = { definitionsOf: () => [], resolveIdentifier: () => null };
const ambientRepositoryRoot = mkdtempSync(join(tmpdir(), "canonical-route-source-identity-"));
writeCanonicalValuesTestFiles({
  repositoryRoot: ambientRepositoryRoot,
  files: {
    "package.json": JSON.stringify({ private: true, workspaces: [] }),
    "src/globals.d.ts": 'declare const ORDER_STATUSES: readonly ["shadow", "values"];\n',
  },
});
process.once("exit", () => {
  rmSync(ambientRepositoryRoot, { force: true, recursive: true });
});

describe("unresolved canonical value route", () => {
  test("a catalog owner spelling without source identity is unregistered", () => {
    const origin: CanonicalValueExpressionOrigin = {
      expression: identifierFrom("ORDER_STATUSES;"),
      kind: "expression",
      projections: [],
    };

    expect(
      canonicalValueUnregisteredRouteFromUnresolvedOrigin({
        bindingIndex: unresolvedBindingIndex,
        catalog: ownedCatalog,
        origin,
      }),
    ).toStrictEqual({
      importedName: "ORDER_STATUSES",
      kind: "unregistered",
      node: origin.expression,
      specifier: "@mst/order-vocabulary",
      valueProjections: [],
    });
  });

  test("an unrelated unresolved spelling remains local", () => {
    expect(
      canonicalValueUnregisteredRouteFromUnresolvedOrigin({
        bindingIndex: unresolvedBindingIndex,
        catalog: ownedCatalog,
        origin: {
          expression: identifierFrom("EXTERNAL_STATUSES;"),
          kind: "expression",
          projections: [],
        },
      }),
    ).toBeNull();
  });

  testLintRule(withOwner, {
    valid: [
      {
        name: "a registered import retains its source identity",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nexport const schema = z.enum(ORDER_STATUSES);',
      },
    ],
    invalid: [
      {
        name: "an ambient tuple cannot impersonate a catalog owner",
        code: 'declare const ORDER_STATUSES: readonly ["shadow", "values"];\nexport const schema = z.enum(ORDER_STATUSES);',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an ambient open array cannot impersonate a catalog owner",
        code: "declare const ORDER_STATUSES: readonly string[];\nexport const schema = z.enum(ORDER_STATUSES);",
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "an ambient global from another declaration file cannot impersonate a catalog owner",
        code: "export const schema = z.enum(ORDER_STATUSES);",
        cwd: ambientRepositoryRoot,
        filename: join(ambientRepositoryRoot, "src/schema.ts"),
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });
});
