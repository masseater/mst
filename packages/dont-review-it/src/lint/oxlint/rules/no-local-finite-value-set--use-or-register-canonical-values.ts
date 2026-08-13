import { memoize, uniqBy } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { isInsideAnnotatedDeclaration } from "../lib/canonical-values/annotated-declaration.ts";
import { fingerprintValues, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
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
  staticArrayValues,
  unwrapExpression,
} from "../lib/canonical-values/finite-value-syntax.ts";
import { importRouteStatus } from "../lib/canonical-values/import-route.ts";
import {
  collectFileBindings,
  firstNonSpreadArgument,
  type FileBindings,
} from "../lib/canonical-values/local-bindings.ts";
import {
  OWNERSHIP_POLICY_SCHEMA,
  ownershipPolicyOf,
} from "../lib/canonical-values/ownership-policy.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { describeLibraryOwner } from "../lib/library-vocabulary/owner-description.ts";
import {
  libraryOwnersOf,
  type LibraryVocabularyIndex,
} from "../lib/library-vocabulary/vocabulary-index.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { Context, ESTree } from "@oxlint/plugins";
import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type {
  CanonicalValuesCatalog,
  CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";
import type { LibraryVocabularyLoader } from "../lib/library-vocabulary/vocabulary-loader.ts";
import type { RuleMessage } from "../lib/rule-message.ts";

const describeOwner = (owner: CanonicalValuesEntry): string =>
  `${owner.conceptId} (${owner.exportPath ?? owner.declarationPath})`;

const libraryOwnerReport = (input: {
  readonly libraries: ReturnType<typeof libraryOwnersOf>;
  readonly values: readonly CanonicalValue[];
  readonly ownershipPolicy: string;
}): RuleMessage => {
  const { libraries, values, ownershipPolicy } = input;
  if (libraries.length === 0) {
    return { messageId: "localFiniteValueSetWithoutOwner", data: { ownershipPolicy } };
  }
  const [onlyLibrary] = libraries;
  if (libraries.length === 1 && onlyLibrary !== undefined) {
    return {
      messageId: "localFiniteValueSetOwnedByLibraryType",
      data: { owner: describeLibraryOwner(onlyLibrary, values), ownershipPolicy },
    };
  }
  return {
    messageId: "localFiniteValueSetOwnedByLibraryTypeCandidates",
    data: {
      owners: libraries.map((library) => describeLibraryOwner(library, values)).join(", "),
      ownershipPolicy,
    },
  };
};

const catalogOwnerReport = (input: {
  readonly owners: readonly CanonicalValuesEntry[];
  readonly ownershipPolicy: string;
}): RuleMessage => {
  const { owners, ownershipPolicy } = input;
  const [onlyOwner] = owners;
  if (owners.length === 1 && onlyOwner !== undefined) {
    return {
      messageId: "localFiniteValueSetWithOwner",
      data: { owner: describeOwner(onlyOwner), ownershipPolicy },
    };
  }
  return {
    messageId: "localFiniteValueSetWithOwnerCandidates",
    data: { owners: owners.map(describeOwner).join(", "), ownershipPolicy },
  };
};

type ValuesSources = {
  readonly repositoryRootOf: () => string;
  readonly catalogOf: () => CanonicalValuesCatalog;
  readonly bindingsOf: () => FileBindings;
  readonly libraryVocabularyOf: () => LibraryVocabularyIndex;
  readonly filename: string;
  readonly ownershipPolicy: string;
};

const fileSourcesFor = (input: {
  readonly inspection: {
    readonly cwd: string;
    readonly filename: string;
    readonly options: Context["options"];
    readonly sourceCode: { readonly ast: ESTree.Program; readonly text: string };
  };
  readonly loadCatalog: CanonicalValuesCatalogLoader;
  readonly loadLibraryVocabulary: LibraryVocabularyLoader;
}): ValuesSources => {
  const { inspection, loadCatalog, loadLibraryVocabulary } = input;
  const repositoryRootOf = memoize((): string => findWorkspaceRoot(inspection.cwd));

  return {
    repositoryRootOf,
    catalogOf: memoize(
      (): CanonicalValuesCatalog => loadCatalog({ repositoryRoot: repositoryRootOf() }),
    ),
    bindingsOf: memoize(
      (): FileBindings =>
        collectFileBindings(inspection.sourceCode.ast, inspection.sourceCode.text),
    ),
    libraryVocabularyOf: memoize(
      (): LibraryVocabularyIndex =>
        loadLibraryVocabulary({
          filename: inspection.filename,
          repositoryRoot: repositoryRootOf(),
        }),
    ),
    filename: inspection.filename,
    ownershipPolicy: ownershipPolicyOf(inspection.options),
  };
};

type ValuesPosition =
  | {
      readonly kind: "values";
      readonly values: readonly CanonicalValue[];
      readonly node: ESTree.Span;
    }
  | {
      readonly kind: "unregisteredRoute";
      readonly name: string;
      readonly specifier: string;
      readonly node: ESTree.Span;
    };

type Finding = {
  readonly node: ESTree.Span;
  readonly messageId: string;
  readonly data: Record<string, string>;
};

type VisitedNode =
  | ESTree.TSTypeAliasDeclaration
  | ESTree.CallExpression
  | ESTree.NewExpression
  | ESTree.ObjectExpression
  | ESTree.TSIndexedAccessType;

const positionForName = (
  asked: { readonly name: string; readonly at: ESTree.Span },
  sources: ValuesSources,
): ValuesPosition | null => {
  const arrayLiteral = sources.bindingsOf().arrays.get(asked.name);
  if (arrayLiteral !== undefined) {
    const vocabulary = staticArrayValues(arrayLiteral);
    return vocabulary === null ? null : { kind: "values", values: vocabulary, node: arrayLiteral };
  }

  const specifier = sources.bindingsOf().namedImports.get(asked.name);
  if (specifier === undefined) return null;

  const route = importRouteStatus(
    { specifier, filename: sources.filename, repositoryRoot: sources.repositoryRootOf() },
    sources.catalogOf(),
  );
  if (route !== "unregistered") return null;
  return { kind: "unregisteredRoute", name: asked.name, specifier, node: asked.at };
};

const positionForExpression = (
  node: ESTree.Expression,
  sources: ValuesSources,
): ValuesPosition | null => {
  const expression = unwrapExpression(node);
  if (expression.type === "ArrayExpression") {
    const vocabulary = staticArrayValues(expression);
    return vocabulary === null ? null : { kind: "values", values: vocabulary, node: expression };
  }
  if (expression.type === "Identifier") {
    return positionForName({ name: expression.name, at: expression }, sources);
  }
  return null;
};

const vocabularyFindings = (input: {
  readonly position: { readonly node: ESTree.Span; readonly values: readonly CanonicalValue[] };
  readonly onlyWhenOwned: boolean;
  readonly sources: ValuesSources;
}): readonly Finding[] => {
  const { position, onlyWhenOwned, sources } = input;
  const { ownershipPolicy } = sources;
  const owners =
    sources.catalogOf().entriesByFingerprint.get(fingerprintValues(position.values)) ?? [];
  if (onlyWhenOwned && owners.length === 0) return [];

  const report =
    owners.length === 0
      ? libraryOwnerReport({
          libraries: libraryOwnersOf(sources.libraryVocabularyOf(), position.values),
          values: position.values,
          ownershipPolicy,
        })
      : catalogOwnerReport({ owners, ownershipPolicy });
  return [{ node: position.node, messageId: report.messageId, data: { ...report.data } }];
};

const findingsAt = (input: {
  readonly position: ValuesPosition | null;
  readonly onlyWhenOwned: boolean;
  readonly sources: ValuesSources;
}): readonly Finding[] => {
  const { position, onlyWhenOwned, sources } = input;
  if (position === null) return [];
  if (position.kind === "unregisteredRoute") {
    return onlyWhenOwned
      ? []
      : [
          {
            node: position.node,
            messageId: "unregisteredCanonicalValuesImportRoute",
            data: { name: position.name, specifier: position.specifier },
          },
        ];
  }
  return isFiniteVocabulary(position.values)
    ? vocabularyFindings({ position, onlyWhenOwned, sources })
    : [];
};

const typeAliasFindings = (
  node: ESTree.TSTypeAliasDeclaration,
  sources: ValuesSources,
): readonly Finding[] => {
  const vocabulary = literalUnionValues(node.typeAnnotation);
  return vocabulary === null
    ? []
    : findingsAt({
        position: { kind: "values", values: vocabulary, node: node.typeAnnotation },
        onlyWhenOwned: false,
        sources,
      });
};

const schemaCallFindings = (
  node: ESTree.CallExpression,
  sources: ValuesSources,
): readonly Finding[] => {
  const member = calleeMemberName(node.callee);
  if (member === null) return [];

  if (SCHEMA_ENUM_MEMBERS.has(member)) {
    const argument = firstNonSpreadArgument(node);
    return argument === null
      ? []
      : findingsAt({
          position: positionForExpression(argument, sources),
          onlyWhenOwned: false,
          sources,
        });
  }
  if (member !== SCHEMA_UNION_MEMBER) return [];

  const literals = schemaUnionLiterals(node);
  return literals === null
    ? []
    : findingsAt({
        position: { kind: "values", values: literals.values, node: literals.node },
        onlyWhenOwned: false,
        sources,
      });
};

const setConstructorFindings = (
  node: ESTree.NewExpression,
  sources: ValuesSources,
): readonly Finding[] => {
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "Identifier" || callee.name !== SET_CONSTRUCTOR) return [];

  const argument = firstNonSpreadArgument(node);
  return argument === null
    ? []
    : findingsAt({
        position: positionForExpression(argument, sources),
        onlyWhenOwned: true,
        sources,
      });
};

const schemaObjectFindings = (
  node: ESTree.ObjectExpression,
  sources: ValuesSources,
): readonly Finding[] =>
  node.properties.flatMap((property) => {
    if (property.type !== "Property" || property.computed) return [];
    if (propertyKeyName(property.key) !== JSON_SCHEMA_ENUM_KEY) return [];
    return findingsAt({
      position: positionForExpression(property.value, sources),
      onlyWhenOwned: false,
      sources,
    });
  });

const indexedAccessFindings = (
  node: ESTree.TSIndexedAccessType,
  sources: ValuesSources,
): readonly Finding[] => {
  if (node.indexType.type !== "TSNumberKeyword") return [];

  const objectType = node.objectType;
  if (objectType.type !== "TSTypeQuery") return [];

  const { exprName } = objectType;
  if (exprName.type !== "Identifier") return [];
  return findingsAt({
    position: positionForName({ name: exprName.name, at: exprName }, sources),
    onlyWhenOwned: true,
    sources,
  });
};

const findingsFor = (node: VisitedNode, sources: ValuesSources): readonly Finding[] => {
  if (node.type === "TSTypeAliasDeclaration") return typeAliasFindings(node, sources);
  if (node.type === "CallExpression") return schemaCallFindings(node, sources);
  if (node.type === "NewExpression") return setConstructorFindings(node, sources);
  if (node.type === "ObjectExpression") return schemaObjectFindings(node, sources);
  return indexedAccessFindings(node, sources);
};

const visitedNodesIn = (program: ESTree.Program): readonly VisitedNode[] =>
  [
    ...nodesOfType(program, "TSTypeAliasDeclaration"),
    ...nodesOfType(program, "CallExpression"),
    ...nodesOfType(program, "NewExpression"),
    ...nodesOfType(program, "ObjectExpression"),
    ...nodesOfType(program, "TSIndexedAccessType"),
  ].toSorted((left, right) => left.start - right.start);

const spanOf = (finding: Finding): string => `${finding.node.start}:${finding.node.end}`;

export const createNoLocalFiniteValueSet = ({
  loadCatalog,
  loadLibraryVocabulary,
}: {
  readonly loadCatalog: CanonicalValuesCatalogLoader;
  readonly loadLibraryVocabulary: LibraryVocabularyLoader;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-local-finite-value-set--use-or-register-canonical-values",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow defining a finite value set inside a file that does not own it, so one place declares the vocabulary and every other place derives from it",
        relatedGuidelines: [],
      },
      messages: {
        localFiniteValueSetWithOwner:
          "Defining a finite value set inside a file that does not own it is forbidden. Delete the local values and derive the schema, the type, and the membership check from the public API of {{owner}}. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetWithOwnerCandidates:
          "Defining a finite value set inside a file that does not own it is forbidden. Delete the local values and derive everything from the owner whose concept, reason to change, and boundary match this one, choosing among these candidates yourself rather than by their order: {{owners}}. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetWithoutOwner:
          "Defining a finite value set inside a file that does not own it is forbidden. Read the design records, the sources, and the public types of the packages this one depends on to find the owner of this concept, and register the runtime values in the place that should own it. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetOwnedByLibraryType:
          "Defining a finite value set that a dependency already owns is forbidden. Delete the local values and derive the type from {{owner}}. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetOwnedByLibraryTypeCandidates:
          "Defining a finite value set that a dependency already owns is forbidden. Delete the local values and derive the type from the dependency whose concept, reason to change, and boundary match this one, choosing among these candidates yourself rather than by their order: {{owners}}. Ownership policy: {{ownershipPolicy}}.",
        unregisteredCanonicalValuesImportRoute:
          "Feeding a finite value set from a repository import that the catalog does not resolve is forbidden. `{{name}}` from `{{specifier}}` is neither a registered public export path nor an annotated declaration. Register the owner of this concept and import through the route the catalog resolves.",
      },
      schema: OWNERSHIP_POLICY_SCHEMA,
    },
    create(inspection) {
      if (isOutOfScopeSource(inspection.filename)) return {};

      const sources = fileSourcesFor({ inspection, loadCatalog, loadLibraryVocabulary });

      return {
        "Program:exit"(program: ESTree.Program) {
          const found = visitedNodesIn(program).flatMap((node) => findingsFor(node, sources));
          const outside = found.filter(
            (finding) =>
              !isInsideAnnotatedDeclaration(sources.bindingsOf().annotatedRanges, finding.node),
          );

          for (const finding of uniqBy(outside, spanOf)) inspection.report(finding);
        },
      };
    },
  });
