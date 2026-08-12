import { memoize } from "es-toolkit";

import {
  registeredDeclarationRanges,
  type AnnotatedDeclarationRange,
} from "../lib/canonical-values/annotated-declaration.ts";
import { canonicalValueKey, type CanonicalValuesCatalog } from "../lib/canonical-values/catalog.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueOwnerInitializer,
  canonicalValueOwnerResultExpressions,
} from "./canonical-value-owner-initializer.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";

type OwnerInitializerDomain = {
  readonly initializer: ESTree.Expression;
  readonly valueKeys: ReadonlySet<string>;
};

const transparentExpressionOf = (expression: ESTree.Node): ESTree.Node | null => {
  switch (expression.type) {
    case "ChainExpression":
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return expression.expression;
    default:
      return null;
  }
};

const resultExpressionContains = ({
  expression,
  node,
}: {
  readonly expression: ESTree.Node;
  readonly node: ESTree.Node;
}): boolean => {
  if (expression === node) return true;
  const transparentExpression = transparentExpressionOf(expression);
  if (transparentExpression !== null) {
    return resultExpressionContains({ expression: transparentExpression, node });
  }
  if (expression.type === "ConditionalExpression") {
    return (
      resultExpressionContains({ expression: expression.consequent, node }) ||
      resultExpressionContains({ expression: expression.alternate, node })
    );
  }
  if (expression.type !== "SequenceExpression") return false;
  const sequenceValue = expression.expressions.at(-1);
  return sequenceValue === undefined
    ? false
    : resultExpressionContains({ expression: sequenceValue, node });
};

const arrayOwnerContains = ({
  array,
  node,
}: {
  readonly array: ESTree.ArrayExpression;
  readonly node: ESTree.Node;
}): boolean =>
  array.elements.some((element) => {
    if (element === null) return false;
    if (element.type !== "SpreadElement") {
      return resultExpressionContains({ expression: element, node });
    }
    const spread = unwrapExpression(element.argument);
    return spread.type === "ArrayExpression" && arrayOwnerContains({ array: spread, node });
  });

const objectOwnerContains = ({
  node,
  object,
}: {
  readonly node: ESTree.Node;
  readonly object: ESTree.ObjectExpression;
}): boolean =>
  object.properties.some((property) => {
    if (property.type !== "SpreadElement") {
      return resultExpressionContains({ expression: property.key, node });
    }
    const spread = unwrapExpression(property.argument);
    return spread.type === "ObjectExpression" && objectOwnerContains({ node, object: spread });
  });

const ownerInitializerContains = ({
  initializer,
  node,
}: {
  readonly initializer: ESTree.Expression;
  readonly node: ESTree.Node;
}): boolean => {
  return canonicalValueOwnerResultExpressions(initializer).some((result) => {
    if (result.type === "ArrayExpression") return arrayOwnerContains({ array: result, node });
    return result.type === "ObjectExpression" && objectOwnerContains({ node, object: result });
  });
};

const initializerDomainFor = ({
  program,
  range,
}: {
  readonly program: ESTree.Program;
  readonly range: AnnotatedDeclarationRange;
}): OwnerInitializerDomain | null => {
  const initializer = canonicalValueOwnerInitializer({ program, range });
  if (initializer === null) return null;
  return {
    initializer,
    valueKeys: new Set(range.values.map(canonicalValueKey)),
  };
};

const createCanonicalLiteralOwnerExemption = ({
  filename,
  program,
  repositoryRootOf,
  sourceText,
}: {
  readonly filename: string;
  readonly program: ESTree.Program;
  readonly repositoryRootOf: () => string;
  readonly sourceText: string;
}): ((input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly node: ESTree.Node;
  readonly spelling: CanonicalValue;
}) => boolean) => {
  const registeredRangesOf = memoize(
    (catalog: CanonicalValuesCatalog): readonly AnnotatedDeclarationRange[] =>
      registeredDeclarationRanges({
        catalog,
        filename,
        repositoryRoot: repositoryRootOf(),
        sourceText,
      }),
  );
  const ownerDomainsOf = memoize(
    (catalog: CanonicalValuesCatalog): readonly OwnerInitializerDomain[] =>
      registeredRangesOf(catalog).flatMap((range) => {
        const domain = initializerDomainFor({ program, range });
        return domain === null ? [] : [domain];
      }),
  );
  return ({ catalog, node, spelling }): boolean => {
    const valueKey = canonicalValueKey(spelling);
    return ownerDomainsOf(catalog).some(
      (domain) =>
        domain.valueKeys.has(valueKey) &&
        ownerInitializerContains({ initializer: domain.initializer, node }),
    );
  };
};

export { createCanonicalLiteralOwnerExemption };
