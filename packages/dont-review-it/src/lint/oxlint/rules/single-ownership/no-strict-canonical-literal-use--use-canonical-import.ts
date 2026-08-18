import { createDontReviewItRule } from "../../../../create-rule.ts";
import { analyzeCanonicalLiterals } from "../../lib/canonical-values/canonical-literal-analysis.ts";
import {
  OWNERSHIP_POLICY_SCHEMA,
  ownershipPolicyOf,
} from "../../lib/canonical-values/ownership-policy.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { isOutOfScopeLintSource } from "../../lib/out-of-scope-source.ts";

import type { CanonicalValuesCatalogLoader } from "../../lib/canonical-values/catalog-loader.ts";
import type { CanonicalValuesEntry } from "../../lib/canonical-values/catalog.ts";

const conceptSummary = (canonicalOwners: readonly CanonicalValuesEntry[]): string =>
  canonicalOwners
    .map((canonicalOwner) => {
      const routes = canonicalOwner.importRoutes.map((route) => route.specifier).join(", ");
      return routes === ""
        ? `${canonicalOwner.conceptId} declared in ${canonicalOwner.declarationPath}`
        : `${canonicalOwner.conceptId} exported from ${routes}`;
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
        relatedGuidelines: ["docs/guidelines/writing-code.md"],
      },
      messages: {
        canonicalValueLiteral:
          "Writing a value that a declared vocabulary already owns as a literal is forbidden. Replace {{value}} with the binding its owner publishes: {{concepts}}. Ownership policy: {{ownershipPolicy}}.",
      },
      schema: OWNERSHIP_POLICY_SCHEMA,
    },
    create(ruleContext) {
      const repositoryRoot = findWorkspaceRoot(ruleContext.cwd);
      if (isOutOfScopeLintSource(ruleContext.filename, repositoryRoot)) return {};
      const diagnostics = analyzeCanonicalLiterals({
        catalog: input.loadCatalog({ repositoryRoot }),
        filename: ruleContext.filename,
        repositoryRoot,
        sourceCode: ruleContext.sourceCode,
      });
      const ownershipPolicy = ownershipPolicyOf(ruleContext.options);
      return {
        Program() {
          for (const diagnostic of diagnostics) {
            ruleContext.report({
              node: diagnostic.node,
              messageId: "canonicalValueLiteral",
              data: {
                value: ruleContext.sourceCode.getText(diagnostic.node),
                concepts: conceptSummary(diagnostic.entries),
                ownershipPolicy,
              },
            });
          }
        },
      };
    },
  });
