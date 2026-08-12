import { createDontReviewItRule } from "../../../create-rule.ts";
import { analyzeCanonicalLiterals } from "../lib/canonical-values/canonical-literal-analysis.ts";
import {
  OWNERSHIP_POLICY_SCHEMA,
  ownershipPolicyOf,
} from "../lib/canonical-values/ownership-policy.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { isOutOfScopeLintSource } from "../lib/out-of-scope-source.ts";

import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type { CanonicalValuesEntry } from "../lib/canonical-values/catalog.ts";

const conceptSummary = (entries: readonly CanonicalValuesEntry[]): string =>
  entries
    .map((entry) => {
      const routes = entry.importRoutes.map((route) => route.specifier).join(", ");
      return routes === ""
        ? `${entry.conceptId} declared in ${entry.declarationPath}`
        : `${entry.conceptId} exported from ${routes}`;
    })
    .toSorted()
    .join("; ");

export const createNoStrictCanonicalLiteralUseRule = (input: {
  readonly loadCatalog: CanonicalValuesCatalogLoader;
}) =>
  createDontReviewItRule({
    name: "no-strict-canonical-literal-use--use-canonical-import",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow writing a value that a declared vocabulary already owns as a literal, so every use site derives its spelling from the one place that declares it",
        relatedGuidelines: [],
      },
      messages: {
        canonicalValueLiteral:
          "Writing a value that a declared vocabulary already owns as a literal is forbidden. Replace {{value}} with the binding its owner publishes: {{concepts}}. Ownership policy: {{ownershipPolicy}}.",
      },
      schema: OWNERSHIP_POLICY_SCHEMA,
    },
    create(context) {
      const repositoryRoot = findWorkspaceRoot(context.cwd);
      if (isOutOfScopeLintSource(context.filename, repositoryRoot)) return {};
      const diagnostics = analyzeCanonicalLiterals({
        catalog: input.loadCatalog({ repositoryRoot }),
        filename: context.filename,
        repositoryRoot,
        sourceCode: context.sourceCode,
      });
      const ownershipPolicy = ownershipPolicyOf(context.options);
      return {
        Program() {
          for (const diagnostic of diagnostics) {
            context.report({
              node: diagnostic.node,
              messageId: "canonicalValueLiteral",
              data: {
                value: context.sourceCode.getText(diagnostic.node),
                concepts: conceptSummary(diagnostic.entries),
                ownershipPolicy,
              },
            });
          }
        },
      };
    },
  });
