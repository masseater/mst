import { dirname, relative, resolve } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  annotatedDeclarationRanges,
  isInsideAnnotatedDeclaration,
} from "../lib/canonical-values/annotated-declaration.ts";
import { canonicalValueKey, fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import {
  OWNERSHIP_POLICY_SCHEMA,
  ownershipPolicyOf,
} from "../lib/canonical-values/ownership-policy.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { describeLibraryOwner } from "../lib/library-vocabulary/owner-description.ts";
import { libraryOwnersOf } from "../lib/library-vocabulary/vocabulary-index.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree } from "@oxlint/plugins";
import type { AnnotatedDeclarationRange } from "../lib/canonical-values/annotated-declaration.ts";
import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type {
  CanonicalValuesCatalog,
  CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import type { LibraryVocabularyIndex } from "../lib/library-vocabulary/vocabulary-index.ts";
import type { LibraryVocabularyLoader } from "../lib/library-vocabulary/vocabulary-loader.ts";

const MIN_VOCABULARY_SIZE = 2;

const SCHEMA_ENUM_MEMBERS: ReadonlySet<string> = new Set(["enum", "picklist"]);
const SCHEMA_UNION_MEMBER = "union";
const SCHEMA_LITERAL_MEMBER = "literal";
const JSON_SCHEMA_ENUM_KEY = "enum";
const SET_CONSTRUCTOR = "Set";

const unwrapExpression = (node: ESTree.Expression): ESTree.Expression => {
  if (node.type === "TSAsExpression") return unwrapExpression(node.expression);
  if (node.type === "TSSatisfiesExpression") return unwrapExpression(node.expression);
  if (node.type === "TSTypeAssertion") return unwrapExpression(node.expression);
  if (node.type === "ParenthesizedExpression") return unwrapExpression(node.expression);
  return node;
};

const unwrapType = (node: ESTree.TSType): ESTree.TSType =>
  node.type === "TSParenthesizedType" ? unwrapType(node.typeAnnotation) : node;

const templateSpelling = (
  quasis: readonly ESTree.TemplateElement[],
  substitutions: readonly unknown[],
): CanonicalValue | null =>
  substitutions.length === 0 && quasis.length === 1 ? quasis[0].value.cooked : null;

const scalarLiteralValue = (node: ESTree.Expression): CanonicalValue | null => {
  const expression = unwrapExpression(node);
  if (expression.type === "Literal") {
    const { value } = expression;
    if (typeof value === "string") return value;
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  if (expression.type === "TemplateLiteral") {
    return templateSpelling(expression.quasis, expression.expressions);
  }
  if (expression.type === "UnaryExpression" && expression.operator === "-") {
    const argument = scalarLiteralValue(expression.argument);
    return typeof argument === "number" ? -argument : null;
  }
  return null;
};

const staticArrayValues = (node: ESTree.ArrayExpression): readonly CanonicalValue[] | null => {
  const vocabulary: CanonicalValue[] = [];
  for (const element of node.elements) {
    if (element === null || element.type === "SpreadElement") return null;
    const spelling = scalarLiteralValue(element);
    if (spelling === null) return null;
    vocabulary.push(spelling);
  }
  return vocabulary;
};

const isFiniteVocabulary = (values: readonly CanonicalValue[]): boolean => {
  const distinct = new Set(values.map(canonicalValueKey));
  if (distinct.size < MIN_VOCABULARY_SIZE) return false;
  return !values.every((value) => typeof value === "boolean");
};

const literalTypeValue = (node: ESTree.TSType): CanonicalValue | null => {
  const type = unwrapType(node);
  if (type.type === "TSLiteralType") return scalarLiteralValue(type.literal);
  if (type.type === "TSTemplateLiteralType") return templateSpelling(type.quasis, type.types);
  return null;
};

const literalUnionValues = (node: ESTree.TSType): readonly CanonicalValue[] | null => {
  const type = unwrapType(node);
  if (type.type !== "TSUnionType") return null;
  const vocabulary: CanonicalValue[] = [];
  for (const member of type.types) {
    const unwrapped = unwrapType(member);
    if (unwrapped.type === "TSNullKeyword") continue;
    if (unwrapped.type === "TSUndefinedKeyword") continue;
    const spelling = literalTypeValue(unwrapped);
    if (spelling === null) return null;
    vocabulary.push(spelling);
  }
  return vocabulary;
};

const calleeMemberName = (node: ESTree.Expression): string | null => {
  const callee = unwrapExpression(node);
  if (callee.type !== "MemberExpression") return null;
  if (callee.computed) return null;
  return callee.property.type === "Identifier" ? callee.property.name : null;
};

const propertyKeyName = (key: ESTree.ObjectProperty["key"]): string | null => {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
};

type SchemaUnionLiterals = {
  readonly values: readonly CanonicalValue[];
  readonly node: ESTree.ArrayExpression;
};

const schemaUnionLiterals = (node: ESTree.CallExpression): SchemaUnionLiterals | null => {
  const [argument] = node.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  const array = unwrapExpression(argument);
  if (array.type !== "ArrayExpression") return null;

  const vocabulary: CanonicalValue[] = [];
  for (const element of array.elements) {
    if (element === null || element.type === "SpreadElement") return null;
    const call = unwrapExpression(element);
    if (call.type !== "CallExpression") return null;
    if (calleeMemberName(call.callee) !== SCHEMA_LITERAL_MEMBER) return null;
    const [literal] = call.arguments;
    if (literal === undefined || literal.type === "SpreadElement") return null;
    const spelling = scalarLiteralValue(literal);
    if (spelling === null) return null;
    vocabulary.push(spelling);
  }
  return { values: vocabulary, node: array };
};

type FileBindings = {
  readonly arrays: ReadonlyMap<string, ESTree.ArrayExpression>;
  readonly namedImports: ReadonlyMap<string, string>;
  readonly annotatedRanges: readonly AnnotatedDeclarationRange[];
};

const EMPTY_FILE_BINDINGS: FileBindings = {
  arrays: new Map(),
  namedImports: new Map(),
  annotatedRanges: [],
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

const collectFileBindings = (program: ESTree.Program, sourceText: string): FileBindings => {
  const arrays = new Map<string, ESTree.ArrayExpression>();
  const namedImports = new Map<string, string>();

  for (const statement of program.body) {
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers) {
        if (specifier.type !== "ImportSpecifier") continue;
        namedImports.set(specifier.local.name, statement.source.value);
      }
      continue;
    }
    if (statement.type === "VariableDeclaration") {
      collectArrays(statement, arrays);
      continue;
    }
    if (statement.type !== "ExportNamedDeclaration") continue;
    if (statement.declaration?.type === "VariableDeclaration") {
      collectArrays(statement.declaration, arrays);
    }
  }

  return { arrays, namedImports, annotatedRanges: annotatedDeclarationRanges(program, sourceText) };
};

const isRelativeSpecifier = (specifier: string): boolean =>
  specifier.startsWith("./") || specifier.startsWith("../");

const matchesExportPath = (specifier: string, entry: CanonicalValuesEntry): boolean =>
  entry.exportPath !== null &&
  (specifier === entry.exportPath || specifier.startsWith(`${entry.exportPath}/`));

const MODULE_FILE_SUFFIX = /\.[cm]?[jt]sx?$/u;

const INDEX_MODULE_SUFFIX = /\/index$/u;

const toPosixPath = (path: string): string => path.split(/[\\/]/u).join("/");

const withoutModuleSuffix = (path: string): string =>
  toPosixPath(path).replace(MODULE_FILE_SUFFIX, "").replace(INDEX_MODULE_SUFFIX, "");

const matchesDeclarationPath = (
  resolvedPath: string,
  repositoryRoot: string,
  entry: CanonicalValuesEntry,
): boolean => {
  const declaration = withoutModuleSuffix(entry.declarationPath);
  return (
    withoutModuleSuffix(relative(repositoryRoot, resolvedPath)) === declaration ||
    withoutModuleSuffix(resolvedPath).endsWith(`/${declaration}`)
  );
};

const importRouteStatus = (
  specifier: string,
  filename: string,
  repositoryRoot: string,
  catalog: CanonicalValuesCatalog,
): "registered" | "unregistered" | "external" => {
  if (catalog.entries.some((entry) => matchesExportPath(specifier, entry))) return "registered";
  if (isRelativeSpecifier(specifier)) {
    const resolved = resolve(dirname(filename), specifier);
    return catalog.entries.some((entry) => matchesDeclarationPath(resolved, repositoryRoot, entry))
      ? "registered"
      : "unregistered";
  }
  if (specifier.startsWith("#")) return "unregistered";
  return "external";
};

const describeOwner = (entry: CanonicalValuesEntry): string =>
  `${entry.conceptId} (${entry.exportPath ?? entry.declarationPath})`;

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
          "Defining a finite value set inside a file that does not own it is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Delete the local values and derive the schema, the type, and the membership check from the public API of {{owner}}. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetWithOwnerCandidates:
          "Defining a finite value set inside a file that does not own it is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Delete the local values and derive everything from the owner whose concept, reason to change, and boundary match this one, choosing among these candidates yourself rather than by their order: {{owners}}. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetWithoutOwner:
          "Defining a finite value set inside a file that does not own it is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Read the design records and the sources to find the owner of this concept. Read the public types of the packages this one depends on as well, because a dependency that already owns this vocabulary is the owner, and the type is derived from it rather than declared again. Register the runtime values in the place that should own it only once you know nothing owns it yet. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetOwnedByLibraryType:
          "Defining a finite value set that a dependency already owns is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Delete the local values and derive the type from {{owner}}, so the declaration stops compiling when the dependency changes the vocabulary. Ownership policy: {{ownershipPolicy}}.",
        localFiniteValueSetOwnedByLibraryTypeCandidates:
          "Defining a finite value set that a dependency already owns is forbidden, because the same vocabulary then lives in two places and nothing fails when they disagree. Delete the local values and derive the type from the dependency whose concept, reason to change, and boundary match this one, choosing among these candidates yourself rather than by their order: {{owners}}. Ownership policy: {{ownershipPolicy}}.",
        unregisteredCanonicalValuesImportRoute:
          "Feeding a finite value set from a repository import that the catalog does not resolve is forbidden, because the route looks like it goes through an owner while no owner is declared. `{{name}}` from `{{specifier}}` is neither a registered public export path nor an annotated declaration. Register the owner of this concept and import through the route the catalog resolves.",
      },
      schema: OWNERSHIP_POLICY_SCHEMA,
    },
    create(context) {
      if (isOutOfScopeSource(context.filename)) return {};

      let repositoryRoot: string | null = null;
      const repositoryRootOf = (): string => (repositoryRoot ??= findWorkspaceRoot(context.cwd));

      let loaded: CanonicalValuesCatalog | null = null;
      const catalogOf = (): CanonicalValuesCatalog =>
        (loaded ??= loadCatalog({ repositoryRoot: repositoryRootOf() }));

      let harvested: LibraryVocabularyIndex | null = null;
      const libraryVocabularyOf = (): LibraryVocabularyIndex =>
        (harvested ??= loadLibraryVocabulary({
          filename: context.filename,
          repositoryRoot: repositoryRootOf(),
        }));

      let bindings = EMPTY_FILE_BINDINGS;
      const reportedSpans = new Set<string>();

      const reportOnce = (
        node: ESTree.Span,
        messageId: string,
        data: Record<string, string>,
      ): void => {
        if (isInsideAnnotatedDeclaration(bindings.annotatedRanges, node)) return;
        const span = `${node.start}:${node.end}`;
        if (reportedSpans.has(span)) return;
        reportedSpans.add(span);
        context.report({ node, messageId, data });
      };

      const reportVocabulary = (
        node: ESTree.Span,
        values: readonly CanonicalValue[],
        onlyWhenOwned: boolean,
      ): void => {
        const owners = catalogOf().entriesByFingerprint.get(fingerprintValues(values)) ?? [];
        if (onlyWhenOwned && owners.length === 0) return;

        const ownershipPolicy = ownershipPolicyOf(context.options);
        if (owners.length === 0) {
          const libraries = libraryOwnersOf(libraryVocabularyOf(), values);
          if (libraries.length === 0) {
            reportOnce(node, "localFiniteValueSetWithoutOwner", { ownershipPolicy });
            return;
          }
          if (libraries.length === 1) {
            reportOnce(node, "localFiniteValueSetOwnedByLibraryType", {
              owner: describeLibraryOwner(libraries[0], values),
              ownershipPolicy,
            });
            return;
          }
          reportOnce(node, "localFiniteValueSetOwnedByLibraryTypeCandidates", {
            owners: libraries.map((library) => describeLibraryOwner(library, values)).join(", "),
            ownershipPolicy,
          });
          return;
        }
        if (owners.length === 1) {
          reportOnce(node, "localFiniteValueSetWithOwner", {
            owner: describeOwner(owners[0]),
            ownershipPolicy,
          });
          return;
        }
        reportOnce(node, "localFiniteValueSetWithOwnerCandidates", {
          owners: owners.map(describeOwner).join(", "),
          ownershipPolicy,
        });
      };

      const resolveName = (name: string, reference: ESTree.Span): ValuesPosition | null => {
        const array = bindings.arrays.get(name);
        if (array !== undefined) {
          const vocabulary = staticArrayValues(array);
          return vocabulary === null ? null : { kind: "values", values: vocabulary, node: array };
        }
        const specifier = bindings.namedImports.get(name);
        if (specifier === undefined) return null;
        const route = importRouteStatus(
          specifier,
          context.filename,
          repositoryRootOf(),
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
          reportOnce(position.node, "unregisteredCanonicalValuesImportRoute", {
            name: position.name,
            specifier: position.specifier,
          });
          return;
        }
        if (!isFiniteVocabulary(position.values)) return;
        reportVocabulary(position.node, position.values, onlyWhenOwned);
      };

      const argumentOf = (node: ESTree.CallExpression | ESTree.NewExpression) => {
        const [argument] = node.arguments;
        if (argument === undefined || argument.type === "SpreadElement") return null;
        return argument;
      };

      return {
        Program(node: ESTree.Program) {
          bindings = collectFileBindings(node, context.sourceCode.text);
        },

        TSTypeAliasDeclaration(node: ESTree.TSTypeAliasDeclaration) {
          const vocabulary = literalUnionValues(node.typeAnnotation);
          if (vocabulary === null || !isFiniteVocabulary(vocabulary)) return;
          reportVocabulary(node.typeAnnotation, vocabulary, false);
        },

        CallExpression(node: ESTree.CallExpression) {
          const member = calleeMemberName(node.callee);
          if (member === null) return;

          if (SCHEMA_ENUM_MEMBERS.has(member)) {
            const argument = argumentOf(node);
            if (argument !== null) handle(resolveExpression(argument), false);
            return;
          }
          if (member !== SCHEMA_UNION_MEMBER) return;

          const literals = schemaUnionLiterals(node);
          if (literals === null || !isFiniteVocabulary(literals.values)) return;
          reportVocabulary(literals.node, literals.values, false);
        },

        NewExpression(node: ESTree.NewExpression) {
          const callee = unwrapExpression(node.callee);
          if (callee.type !== "Identifier" || callee.name !== SET_CONSTRUCTOR) return;
          const argument = argumentOf(node);
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
