import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  canonicalValueKey,
  type CanonicalValuesCatalog,
  type CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";
import {
  OWNERSHIP_POLICY_SCHEMA,
  ownershipPolicyOf,
} from "../lib/canonical-values/ownership-policy.ts";
import { isOutOfScopeLintSource } from "../lib/out-of-scope-source.ts";
import {
  createCanonicalLiteralVisitor,
  inspectCanonicalLiteralBinaryExpression,
  inspectCanonicalLiteralTemplateLiteral,
  inspectCanonicalLiteralUnaryExpression,
  type CanonicalLiteralCandidate,
} from "./canonical-literal-candidate.ts";
import { createCanonicalLiteralCatalogAccess } from "./canonical-literal-catalog-access.ts";
import { canonicalLiteralLookupSpellings } from "./canonical-literal-key-spellings.ts";
import { createCanonicalLiteralOwnerExemption } from "./canonical-literal-owner-exemption.ts";
import { isExemptCanonicalLiteralPosition } from "./canonical-literal-position.ts";
import { createCanonicalLiteralStaticExpressionSink } from "./canonical-literal-static-expression.ts";
import { createCanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import { createCanonicalValueBindingVisitor } from "./canonical-value-binding-visitor.ts";
import { createCanonicalValueRuntimeState } from "./canonical-value-invocation.ts";
import { createCanonicalValueOutOfScopeImportSink } from "./canonical-value-out-of-scope-import.ts";
import { withCanonicalValueStaticCallResolver } from "./canonical-value-property-state.ts";
import { createCanonicalValueStaticCallResolver } from "./canonical-value-static-invocation.ts";

import type { Context, Visitor } from "@oxlint/plugins";
import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type { ScopeLookup } from "./scope-resolution.ts";

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

const createCanonicalPropertyAnalysis = (context: Context) => {
  const bindingIndex = createCanonicalValueBindingIndex(context.sourceCode);
  const { invocationState, propertyState: basePropertyState } =
    createCanonicalValueRuntimeState(bindingIndex);
  const propertyState = withCanonicalValueStaticCallResolver(
    basePropertyState,
    createCanonicalValueStaticCallResolver({
      bindingIndex,
      invocationState,
      propertyState: basePropertyState,
    }),
  );
  return { bindingIndex, invocationState, propertyState };
};

const createCanonicalLiteralInspection = (input: {
  readonly catalog: () => CanonicalValuesCatalog;
  readonly context: Context;
  readonly ownershipPolicy: string;
  readonly repositoryRootOf: () => string;
}) => {
  const scopeAt: ScopeLookup = (node) => input.context.sourceCode.getScope(node);
  const isOwnerDeclaration = createCanonicalLiteralOwnerExemption({
    filename: input.context.filename,
    program: input.context.sourceCode.ast,
    repositoryRootOf: input.repositoryRootOf,
    sourceText: input.context.sourceCode.text,
  });
  const pendingReports = new Set<{
    readonly candidate: CanonicalLiteralCandidate;
    readonly concepts: string;
  }>();
  const reportedCandidates = new Set<CanonicalLiteralCandidate>();
  const sameCandidate = (
    left: CanonicalLiteralCandidate,
    right: CanonicalLiteralCandidate,
  ): boolean =>
    left.node.start === right.node.start &&
    left.node.end === right.node.end &&
    canonicalValueKey(left.spelling) === canonicalValueKey(right.spelling);
  const strictlyContains = (
    container: CanonicalLiteralCandidate,
    contained: CanonicalLiteralCandidate,
  ): boolean =>
    container.node.start <= contained.node.start &&
    container.node.end >= contained.node.end &&
    (container.node.start < contained.node.start || container.node.end > contained.node.end);
  const covered = (candidate: CanonicalLiteralCandidate): boolean =>
    [...pendingReports].some(
      (pending) =>
        sameCandidate(pending.candidate, candidate) ||
        strictlyContains(pending.candidate, candidate),
    );
  const inspect = ({ ancestors, node, spelling }: CanonicalLiteralCandidate): void => {
    if (isExemptCanonicalLiteralPosition({ ancestors, node, scopeAt })) return;

    const loaded = input.catalog();
    const matchingSpellings = canonicalLiteralLookupSpellings({
      ancestors,
      node,
      spelling,
    }).filter(
      (candidate) => (loaded.entriesByValue.get(canonicalValueKey(candidate))?.length ?? 0) !== 0,
    );
    const entries = matchingSpellings.flatMap(
      (candidate) => loaded.entriesByValue.get(canonicalValueKey(candidate)) ?? [],
    );
    if (entries.length === 0) return;
    if (
      matchingSpellings.some((candidate) =>
        isOwnerDeclaration({ catalog: loaded, node, spelling: candidate }),
      )
    ) {
      return;
    }
    const candidate = { ancestors, node, spelling };
    if (!covered(candidate)) {
      pendingReports.add({ candidate, concepts: conceptSummary(entries) });
    }
  };
  return {
    covered,
    evaluate: () => {
      [...pendingReports]
        .toSorted(
          (left, right) =>
            right.candidate.node.end -
              right.candidate.node.start -
              (left.candidate.node.end - left.candidate.node.start) ||
            left.candidate.ancestors.length - right.candidate.ancestors.length,
        )
        .forEach(({ candidate, concepts }) => {
          if (
            Array.from(reportedCandidates).some((reported) => strictlyContains(reported, candidate))
          ) {
            return;
          }
          input.context.report({
            node: candidate.node,
            messageId: "canonicalValueLiteral",
            data: {
              value: input.context.sourceCode.getText(candidate.node),
              concepts,
              ownershipPolicy: input.ownershipPolicy,
            },
          });
          reportedCandidates.add(candidate);
        });
    },
    inspect,
  };
};

export const createNoStrictCanonicalLiteralUseRule = ({
  loadCatalog,
}: {
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
          "A value that a declared vocabulary already owns must not be written again as a literal, because the literal and the declaration then change apart and nothing fails when they diverge. Replace {{value}} with the binding its owner publishes: {{concepts}}. Ownership policy: {{ownershipPolicy}}.",
        productionImportsOutOfScopeSource:
          "Production source must not import {{sourcePath}}, because test, Story, fixture, and mock sources are outside the production checks and can otherwise supply canonical values without either canonical rule inspecting their declaration. Move the supplied value into a production owner and import its registered public binding.",
      },
      schema: OWNERSHIP_POLICY_SCHEMA,
    },
    create(context): Visitor {
      const { loadedCatalog, repositoryRootOf } = createCanonicalLiteralCatalogAccess({
        cwd: context.cwd,
        loadCatalog,
      });
      if (isOutOfScopeLintSource(context.filename, repositoryRootOf())) return {};
      const { bindingIndex, invocationState, propertyState } =
        createCanonicalPropertyAnalysis(context);
      const inspection = createCanonicalLiteralInspection({
        catalog: loadedCatalog,
        context,
        ownershipPolicy: ownershipPolicyOf(context.options),
        repositoryRootOf,
      });
      const staticExpressionSink = createCanonicalLiteralStaticExpressionSink({
        covered: inspection.covered,
        inspect: inspection.inspect,
        propertyState,
      });
      const literalVisitor = createCanonicalLiteralVisitor(inspection.inspect, {
        recordStaticExpression: staticExpressionSink.recordExpression,
      });
      const outOfScopeImportSink = createCanonicalValueOutOfScopeImportSink({
        bindingIndex,
        context,
        invocationState,
        propertyState,
        repositoryRootOf,
        report({ node, sourcePath }) {
          context.report({
            node,
            messageId: "productionImportsOutOfScopeSource",
            data: { sourcePath },
          });
        },
      });
      const bindingVisitor = createCanonicalValueBindingVisitor(bindingIndex, {
        afterBinary: (node) => {
          inspectCanonicalLiteralBinaryExpression(node, inspection.inspect);
          staticExpressionSink.recordExpression(node);
        },
        afterCall: (node) => {
          outOfScopeImportSink.recordCall(node);
          staticExpressionSink.recordCall(node);
        },
        afterMember: staticExpressionSink.recordExpression,
        afterNew: outOfScopeImportSink.recordNew,
        afterTemplate: (node) => {
          inspectCanonicalLiteralTemplateLiteral(node, inspection.inspect);
          staticExpressionSink.recordExpression(node);
        },
        afterUnary: (node) => {
          inspectCanonicalLiteralUnaryExpression(node, inspection.inspect);
          staticExpressionSink.recordExpression(node);
        },
        programExit: () => {
          staticExpressionSink.evaluate();
          inspection.evaluate();
          outOfScopeImportSink.evaluate();
        },
      });
      return { ...literalVisitor, ...bindingVisitor, ...outOfScopeImportSink.visitor };
    },
  });
