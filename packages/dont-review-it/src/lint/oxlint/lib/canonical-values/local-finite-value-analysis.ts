import { uniqBy } from "es-toolkit";

import { registeredDeclarationRanges } from "./annotated-declaration.ts";
import { fingerprintValues, type CanonicalValue } from "./fingerprint.ts";
import {
  calleeMemberName,
  isFiniteVocabulary,
  JSON_SCHEMA_ENUM_KEY,
  literalUnionValues,
  propertyKeyName,
  SCHEMA_ENUM_MEMBERS,
  SCHEMA_UNION_MEMBER,
  schemaUnionLiterals,
  SET_CONSTRUCTOR,
  unwrapExpression,
  unwrapType,
} from "./finite-value-syntax.ts";
import { importRouteStatus } from "./import-route.ts";
import {
  firstFiniteValueArgument,
  localFiniteIdentifierPosition,
  localFiniteSchemaPosition,
  localFiniteValueBindings,
  localFiniteValuePosition,
  type LocalFiniteValueBindings,
  type LocalFiniteValuePosition,
} from "./local-finite-value-position.ts";
import { sourceNodes } from "./source-analysis.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";
import type { ScopeLookup } from "../resolved-bindings.ts";
import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";

export type LocalFiniteValueDiagnostic =
  | {
      readonly kind: "unregistered-route";
      readonly name: string;
      readonly node: ESTree.Node;
      readonly specifier: string;
    }
  | {
      readonly kind: "vocabulary";
      readonly node: ESTree.Node;
      readonly owners: readonly CanonicalValuesEntry[];
      readonly values: readonly CanonicalValue[];
    };

type AnalysisInput = {
  readonly bindings: LocalFiniteValueBindings;
  readonly catalog: CanonicalValuesCatalog;
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly scopeAt: ScopeLookup;
};

const vocabularyDiagnostic = (input: {
  readonly canonicalItems: readonly CanonicalValue[];
  readonly catalog: CanonicalValuesCatalog;
  readonly node: ESTree.Node;
  readonly onlyWhenOwned: boolean;
}): readonly LocalFiniteValueDiagnostic[] => {
  if (!isFiniteVocabulary(input.canonicalItems)) return [];
  const owners =
    input.catalog.entriesByFingerprint.get(fingerprintValues(input.canonicalItems)) ?? [];
  return input.onlyWhenOwned && owners.length === 0
    ? []
    : [{ kind: "vocabulary", node: input.node, owners, values: input.canonicalItems }];
};

const routeDiagnostic = (
  input: AnalysisInput,
  position: Extract<LocalFiniteValuePosition, { readonly kind: "import" }>,
): readonly LocalFiniteValueDiagnostic[] => {
  const routeStatus = importRouteStatus(
    {
      filename: input.filename,
      importedName: position.importedName,
      repositoryRoot: input.repositoryRoot,
      specifier: position.specifier,
    },
    input.catalog,
  );
  return routeStatus === "unregistered"
    ? [
        {
          kind: "unregistered-route",
          name: position.name,
          node: position.node,
          specifier: position.specifier,
        },
      ]
    : [];
};

const catalogNamesImport = (
  catalog: CanonicalValuesCatalog,
  position: Extract<LocalFiniteValuePosition, { readonly kind: "import" }>,
): boolean =>
  catalog.entries.some(
    (entry) =>
      entry.binding === position.importedName ||
      entry.importRoutes.map((route) => route.exportName).includes(position.importedName),
  );

const diagnosticsForPosition = (
  input: AnalysisInput,
  candidate: {
    readonly onlyWhenOwned: boolean;
    readonly position: LocalFiniteValuePosition | null;
  },
): readonly LocalFiniteValueDiagnostic[] => {
  if (candidate.position === null) return [];
  if (candidate.position.kind === "import") {
    return candidate.onlyWhenOwned && !catalogNamesImport(input.catalog, candidate.position)
      ? []
      : routeDiagnostic(input, candidate.position);
  }
  if (candidate.position.kind === "unknown-owner-name") {
    return [
      {
        kind: "unregistered-route",
        name: candidate.position.name,
        node: candidate.position.node,
        specifier: "<unresolved binding>",
      },
    ];
  }
  return vocabularyDiagnostic({
    canonicalItems: candidate.position.values,
    catalog: input.catalog,
    node: candidate.position.node,
    onlyWhenOwned: candidate.onlyWhenOwned,
  });
};

const callDiagnostics = (
  input: AnalysisInput,
  node: ESTree.CallExpression,
): readonly LocalFiniteValueDiagnostic[] => {
  const member = calleeMemberName(node.callee);
  if (member !== null && SCHEMA_ENUM_MEMBERS.has(member)) {
    const argument = firstFiniteValueArgument(node);
    return argument === null
      ? []
      : diagnosticsForPosition(input, {
          onlyWhenOwned: false,
          position: localFiniteSchemaPosition(input, argument),
        });
  }
  if (member !== SCHEMA_UNION_MEMBER) return [];
  const literals = schemaUnionLiterals(node);
  return literals === null
    ? []
    : vocabularyDiagnostic({
        canonicalItems: literals.values,
        catalog: input.catalog,
        node: literals.node,
        onlyWhenOwned: false,
      });
};

const constructionDiagnostics = (
  input: AnalysisInput,
  node: ESTree.NewExpression,
): readonly LocalFiniteValueDiagnostic[] => {
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "Identifier" || callee.name !== SET_CONSTRUCTOR) return [];
  const argument = firstFiniteValueArgument(node);
  return argument === null
    ? []
    : diagnosticsForPosition(input, {
        onlyWhenOwned: true,
        position: localFiniteValuePosition(input, argument),
      });
};

const objectDiagnostics = (
  input: AnalysisInput,
  node: ESTree.ObjectExpression,
): readonly LocalFiniteValueDiagnostic[] =>
  node.properties.flatMap((property) => {
    if (property.type !== "Property" || property.computed) return [];
    if (propertyKeyName(property.key) !== JSON_SCHEMA_ENUM_KEY) return [];
    return diagnosticsForPosition(input, {
      onlyWhenOwned: false,
      position: localFiniteValuePosition(input, property.value),
    });
  });

const indexedAccessDiagnostics = (
  input: AnalysisInput,
  node: ESTree.TSIndexedAccessType,
): readonly LocalFiniteValueDiagnostic[] => {
  if (unwrapType(node.indexType).type !== "TSNumberKeyword") return [];
  const objectType = unwrapType(node.objectType);
  if (objectType.type !== "TSTypeQuery" || objectType.exprName.type !== "Identifier") return [];
  return diagnosticsForPosition(input, {
    onlyWhenOwned: true,
    position: localFiniteIdentifierPosition(input, objectType.exprName),
  });
};

const typeAliasDiagnostics = (
  input: AnalysisInput,
  node: ESTree.TSTypeAliasDeclaration,
): readonly LocalFiniteValueDiagnostic[] => {
  const canonicalItems = literalUnionValues(node.typeAnnotation);
  if (canonicalItems !== null) {
    return vocabularyDiagnostic({
      canonicalItems,
      catalog: input.catalog,
      node: node.typeAnnotation,
      onlyWhenOwned: false,
    });
  }
  return keyofDiagnostics(input, node.typeAnnotation);
};

const importTypeName = (qualifier: ESTree.TSImportType["qualifier"]): string | null => {
  if (qualifier === null) return null;
  return qualifier.type === "Identifier" ? qualifier.name : qualifier.right.name;
};

const keyofDiagnostics = (
  input: AnalysisInput,
  type: ESTree.TSType,
): readonly LocalFiniteValueDiagnostic[] => {
  const unwrapped = unwrapType(type);
  if (unwrapped.type !== "TSTypeOperator" || unwrapped.operator !== "keyof") return [];
  const target = unwrapType(unwrapped.typeAnnotation);
  if (target.type === "TSTypeReference" && target.typeName.type === "Identifier") {
    const position = localFiniteIdentifierPosition(input, target.typeName);
    return position?.kind === "values"
      ? []
      : diagnosticsForPosition(input, { onlyWhenOwned: false, position });
  }
  if (target.type !== "TSImportType" || typeof target.source.value !== "string") return [];
  const name = importTypeName(target.qualifier);
  if (name === null) return [];
  return routeDiagnostic(input, {
    importedName: name,
    kind: "import",
    name,
    node: target,
    specifier: target.source.value,
  });
};

const diagnosticsForNode = (
  input: AnalysisInput,
  node: ESTree.Node,
): readonly LocalFiniteValueDiagnostic[] => {
  if (node.type === "CallExpression") return callDiagnostics(input, node);
  if (node.type === "NewExpression") return constructionDiagnostics(input, node);
  if (node.type === "ObjectExpression") return objectDiagnostics(input, node);
  if (node.type === "TSIndexedAccessType") return indexedAccessDiagnostics(input, node);
  if (node.type === "TSTypeAliasDeclaration") return typeAliasDiagnostics(input, node);
  return [];
};

const withinRegisteredDeclaration = (
  ranges: ReturnType<typeof registeredDeclarationRanges>,
  diagnostic: LocalFiniteValueDiagnostic,
): boolean =>
  ranges.some((range) => range.start <= diagnostic.node.start && diagnostic.node.end <= range.end);

export const analyzeLocalFiniteValues = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly sourceCode: SourceCode;
}): readonly LocalFiniteValueDiagnostic[] => {
  const ranges = registeredDeclarationRanges({
    catalog: input.catalog,
    filename: input.filename,
    repositoryRoot: input.repositoryRoot,
    sourceText: input.sourceCode.text,
  });
  const analysisInput = {
    ...input,
    bindings: localFiniteValueBindings(input.sourceCode.ast),
    scopeAt: (node: ESTree.Node) => input.sourceCode.getScope(node),
  };
  const diagnostics = sourceNodes(input.sourceCode).flatMap(({ node }) =>
    diagnosticsForNode(analysisInput, node),
  );
  return uniqBy(
    diagnostics.filter((diagnostic) => !withinRegisteredDeclaration(ranges, diagnostic)),
    (diagnostic) => `${diagnostic.node.start}:${diagnostic.node.end}`,
  );
};
