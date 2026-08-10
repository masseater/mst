import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  annotatedDeclarationRanges,
  isInsideAnnotatedDeclaration,
  type AnnotatedDeclarationRange,
} from "../lib/canonical-values/annotated-declaration.ts";
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
  unwrapType,
} from "../lib/canonical-values/finite-value-syntax.ts";
import { importRouteStatus } from "../lib/canonical-values/import-route.ts";
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
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type {
  CanonicalValuesCatalog,
  CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";
import type { LibraryVocabularyLoader } from "../lib/library-vocabulary/vocabulary-loader.ts";
import type { RuleMessage } from "../lib/rule-message.ts";

type FileBindings = {
  readonly arrays: ReadonlyMap<string, ESTree.ArrayExpression>;
  readonly namedImports: ReadonlyMap<string, string>;
  readonly annotatedRanges: readonly AnnotatedDeclarationRange[];
};

const collectArrays = (
  declaration: ESTree.VariableDeclaration,
  arrays: Map<string, ESTree.ArrayExpression>,
): void => {
  for (const declarator of declaration.declarations) {
    if (declarator.id.type !== "Identifier") continue;
    if (declarator.init === null) continue;
    const init = unwrapExpression(declarator.init);
    if (init.type === "ArrayExpression") arrays.set(declarator.id.name, init);
  }
};

const collectNamedImports = (
  statement: ESTree.ImportDeclaration,
  namedImports: Map<string, string>,
): void => {
  for (const specifier of statement.specifiers) {
    if (specifier.type !== "ImportSpecifier") continue;
    namedImports.set(specifier.local.name, statement.source.value);
  }
};

const collectFileBindings = (program: ESTree.Program, sourceText: string): FileBindings => {
  const arrays = new Map<string, ESTree.ArrayExpression>();
  const namedImports = new Map<string, string>();

  for (const statement of program.body) {
    if (statement.type === "ImportDeclaration") collectNamedImports(statement, namedImports);
    else if (statement.type === "VariableDeclaration") collectArrays(statement, arrays);
    else if (
      statement.type === "ExportNamedDeclaration" &&
      statement.declaration?.type === "VariableDeclaration"
    ) {
      collectArrays(statement.declaration, arrays);
    }
  }

  return { arrays, namedImports, annotatedRanges: annotatedDeclarationRanges(program, sourceText) };
};

const describeOwner = (entry: CanonicalValuesEntry): string =>
  `${entry.conceptId} (${entry.exportPath ?? entry.declarationPath})`;

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

const firstNonSpreadArgument = (
  node: ESTree.CallExpression | ESTree.NewExpression,
): ESTree.Expression | null => {
  const [argument] = node.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  return argument;
};

const fileSourcesFor = (input: {
  readonly context: {
    readonly cwd: string;
    readonly filename: string;
    readonly sourceCode: { readonly ast: ESTree.Program; readonly text: string };
  };
  readonly loadCatalog: CanonicalValuesCatalogLoader;
  readonly loadLibraryVocabulary: LibraryVocabularyLoader;
}): {
  readonly repositoryRootOf: () => string;
  readonly catalogOf: () => CanonicalValuesCatalog;
  readonly bindingsOf: () => FileBindings;
  readonly libraryVocabularyOf: () => LibraryVocabularyIndex;
} => {
  const { context, loadCatalog, loadLibraryVocabulary } = input;
  const repositoryRootOf = memoize((): string => findWorkspaceRoot(context.cwd));

  return {
    repositoryRootOf,
    catalogOf: memoize(
      (): CanonicalValuesCatalog => loadCatalog({ repositoryRoot: repositoryRootOf() }),
    ),
    bindingsOf: memoize(
      (): FileBindings => collectFileBindings(context.sourceCode.ast, context.sourceCode.text),
    ),
    libraryVocabularyOf: memoize(
      (): LibraryVocabularyIndex =>
        loadLibraryVocabulary({ filename: context.filename, repositoryRoot: repositoryRootOf() }),
    ),
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
    create(context) {
      if (isOutOfScopeSource(context.filename)) return {};

      const { repositoryRootOf, catalogOf, bindingsOf, libraryVocabularyOf } = fileSourcesFor({
        context,
        loadCatalog,
        loadLibraryVocabulary,
      });

      const reportedSpans = new Set<string>();

      const reportOnce = (report: {
        readonly node: ESTree.Span;
        readonly messageId: string;
        readonly data: Record<string, string>;
      }): void => {
        if (isInsideAnnotatedDeclaration(bindingsOf().annotatedRanges, report.node)) return;
        const span = `${report.node.start}:${report.node.end}`;
        if (reportedSpans.has(span)) return;
        reportedSpans.add(span);
        context.report(report);
      };

      const reportVocabulary = (
        occurrence: { readonly node: ESTree.Span; readonly values: readonly CanonicalValue[] },
        onlyWhenOwned: boolean,
      ): void => {
        const { node } = occurrence;
        const vocabulary = occurrence.values;
        const owners = catalogOf().entriesByFingerprint.get(fingerprintValues(vocabulary)) ?? [];
        if (onlyWhenOwned && owners.length === 0) return;

        const ownershipPolicy = ownershipPolicyOf(context.options);
        const report =
          owners.length === 0
            ? libraryOwnerReport({
                libraries: libraryOwnersOf(libraryVocabularyOf(), vocabulary),
                values: vocabulary,
                ownershipPolicy,
              })
            : catalogOwnerReport({ owners, ownershipPolicy });
        reportOnce({ node, messageId: report.messageId, data: { ...report.data } });
      };

      const resolveName = (name: string, reference: ESTree.Span): ValuesPosition | null => {
        const array = bindingsOf().arrays.get(name);
        if (array !== undefined) {
          const vocabulary = staticArrayValues(array);
          return vocabulary === null ? null : { kind: "values", values: vocabulary, node: array };
        }
        const specifier = bindingsOf().namedImports.get(name);
        if (specifier === undefined) return null;
        const route = importRouteStatus(
          { specifier, filename: context.filename, repositoryRoot: repositoryRootOf() },
          catalogOf(),
        );
        if (route !== "unregistered") return null;
        return { kind: "unregisteredRoute", name, specifier, node: reference };
      };

      const resolveExpression = (node: ESTree.Expression): ValuesPosition | null => {
        const expression = unwrapExpression(node);
        if (expression.type === "ArrayExpression") {
          const vocabulary = staticArrayValues(expression);
          return vocabulary === null
            ? null
            : { kind: "values", values: vocabulary, node: expression };
        }
        if (expression.type === "Identifier") return resolveName(expression.name, expression);
        return null;
      };

      const handle = (position: ValuesPosition | null, onlyWhenOwned: boolean): void => {
        if (position === null) return;
        if (position.kind === "unregisteredRoute") {
          if (onlyWhenOwned) return;
          reportOnce({
            node: position.node,
            messageId: "unregisteredCanonicalValuesImportRoute",
            data: { name: position.name, specifier: position.specifier },
          });
          return;
        }
        if (!isFiniteVocabulary(position.values)) return;
        reportVocabulary(position, onlyWhenOwned);
      };

      return {
        TSTypeAliasDeclaration(node: ESTree.TSTypeAliasDeclaration) {
          const vocabulary = literalUnionValues(node.typeAnnotation);
          if (vocabulary === null || !isFiniteVocabulary(vocabulary)) return;
          reportVocabulary({ node: node.typeAnnotation, values: vocabulary }, false);
        },

        CallExpression(node: ESTree.CallExpression) {
          const member = calleeMemberName(node.callee);
          if (member === null) return;

          if (SCHEMA_ENUM_MEMBERS.has(member)) {
            const argument = firstNonSpreadArgument(node);
            if (argument !== null) handle(resolveExpression(argument), false);
            return;
          }
          if (member !== SCHEMA_UNION_MEMBER) return;

          const literals = schemaUnionLiterals(node);
          if (literals === null || !isFiniteVocabulary(literals.values)) return;
          reportVocabulary(literals, false);
        },

        NewExpression(node: ESTree.NewExpression) {
          const callee = unwrapExpression(node.callee);
          if (callee.type !== "Identifier" || callee.name !== SET_CONSTRUCTOR) return;
          const argument = firstNonSpreadArgument(node);
          if (argument !== null) handle(resolveExpression(argument), true);
        },

        ObjectExpression(node: ESTree.ObjectExpression) {
          for (const property of node.properties) {
            if (property.type !== "Property" || property.computed) continue;
            if (propertyKeyName(property.key) !== JSON_SCHEMA_ENUM_KEY) continue;
            handle(resolveExpression(property.value), false);
          }
        },

        TSIndexedAccessType(node: ESTree.TSIndexedAccessType) {
          if (unwrapType(node.indexType).type !== "TSNumberKeyword") return;
          const objectType = unwrapType(node.objectType);
          if (objectType.type !== "TSTypeQuery") return;
          const { exprName } = objectType;
          if (exprName.type !== "Identifier") return;
          handle(resolveName(exprName.name, exprName), true);
        },
      };
    },
  });
