import { uniqBy } from "es-toolkit";

import {
  appendCandidateSets,
  closedCandidateSet,
  mapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueKey,
  fingerprintValues,
  type CanonicalValue,
} from "../lib/canonical-values/fingerprint.ts";
import { scalarLiteralValue } from "../lib/canonical-values/finite-value-syntax.ts";
import { type CanonicalValuePropertyNameStructure } from "./canonical-value-property-name-origin.ts";
import {
  canonicalValueRouteOriginKey,
  type CanonicalValueRouteOrigin,
} from "./canonical-value-route-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValuePropertyNameEnvironment } from "./canonical-value-property-name-domain.ts";

export type CanonicalValuePropertyNameFragment = {
  readonly node: ESTree.Span;
  readonly routes: readonly Exclude<CanonicalValueRouteOrigin, { readonly kind: "local" }>[];
  readonly values: readonly CanonicalValue[];
};

export type CanonicalValuePropertyNameResolution = {
  readonly environment: CanonicalValuePropertyNameEnvironment;
  readonly keySemantics: "keyof" | "object-keys";
  readonly seenExpressions: ReadonlySet<ESTree.Expression>;
};

export const canonicalValuePropertyNameFragmentKey = (
  fragment: CanonicalValuePropertyNameFragment,
): string =>
  `${fragment.node.start}:${fragment.node.end}:${fingerprintValues(fragment.values)}:${fragment.routes
    .map(canonicalValueRouteOriginKey)
    .toSorted()
    .join("|")}`;

const appendFragment = (
  left: CanonicalValuePropertyNameFragment,
  right: CanonicalValuePropertyNameFragment,
): CanonicalValuePropertyNameFragment => ({
  node: left.node,
  routes: uniqBy([...left.routes, ...right.routes], canonicalValueRouteOriginKey),
  values: [...left.values, ...right.values],
});

export const appendCanonicalValuePropertyNameFragments = (
  accumulated: CandidateSet<CanonicalValuePropertyNameFragment>,
  next: CandidateSet<CanonicalValuePropertyNameFragment>,
): CandidateSet<CanonicalValuePropertyNameFragment> =>
  appendCandidateSets({
    accumulated,
    append: appendFragment,
    candidateKey: canonicalValuePropertyNameFragmentKey,
    next,
  });

const emptyFragment = (node: ESTree.Span): CandidateSet<CanonicalValuePropertyNameFragment> =>
  closedCandidateSet([{ node, routes: [], values: [] }], canonicalValuePropertyNameFragmentKey);

const keyFragments = (
  node: ESTree.Span,
  keys: CandidateSet<CanonicalValue>,
): CandidateSet<CanonicalValuePropertyNameFragment> =>
  mapCandidateSet(keys, {
    candidateKey: canonicalValuePropertyNameFragmentKey,
    mapCandidate: (key) => ({ node, routes: [], values: [key] }),
  });

const keyofStaticKeys = (
  resolution: CanonicalValuePropertyNameResolution,
  input: { readonly computed: boolean; readonly key: ESTree.Node },
): CandidateSet<CanonicalValue> => {
  if (!input.computed && input.key.type === "Identifier") {
    return closedCandidateSet([input.key.name], canonicalValueKey);
  }
  const literal =
    input.key.type === "Literal" || input.key.type === "TemplateLiteral"
      ? scalarLiteralValue(input.key)
      : undefined;
  if (literal !== undefined) {
    return closedCandidateSet(
      [typeof literal === "number" ? literal : String(literal)],
      canonicalValueKey,
    );
  }
  return mapCandidateSet(
    resolution.environment.propertyState.primitives({
      expression: input.key as ESTree.Expression,
    }),
    {
      candidateKey: canonicalValueKey,
      mapCandidate: (primitive) => (typeof primitive === "number" ? primitive : String(primitive)),
    },
  );
};

const staticKeys = (
  resolution: CanonicalValuePropertyNameResolution,
  input: { readonly computed: boolean; readonly key: ESTree.Node },
): CandidateSet<CanonicalValue> =>
  resolution.keySemantics === "keyof"
    ? keyofStaticKeys(resolution, input)
    : resolution.environment.propertyState.propertyKeys({
        computed: input.computed,
        key: input.key,
      });

export const canonicalValueObjectPropertyIsPrototypeSetter = (
  property: ESTree.ObjectProperty,
): boolean =>
  !property.computed &&
  !property.method &&
  !property.shorthand &&
  property.kind === "init" &&
  ((property.key.type === "Identifier" && property.key.name === "__proto__") ||
    (property.key.type === "Literal" && property.key.value === "__proto__"));

export const resolveCanonicalValueObjectPropertyNameFragments = (input: {
  readonly object: ESTree.ObjectExpression;
  readonly resolution: CanonicalValuePropertyNameResolution;
  readonly resolveExpression: (
    resolution: CanonicalValuePropertyNameResolution,
    expression: ESTree.Expression,
  ) => CandidateSet<CanonicalValuePropertyNameFragment>;
}): CandidateSet<CanonicalValuePropertyNameFragment> =>
  input.object.properties.reduce<CandidateSet<CanonicalValuePropertyNameFragment>>(
    (fragments, property) => {
      if (property.type === "SpreadElement") {
        return appendCanonicalValuePropertyNameFragments(
          fragments,
          input.resolveExpression(input.resolution, property.argument),
        );
      }
      if (canonicalValueObjectPropertyIsPrototypeSetter(property)) return fragments;
      return appendCanonicalValuePropertyNameFragments(
        fragments,
        keyFragments(input.object, staticKeys(input.resolution, property)),
      );
    },
    emptyFragment(input.object),
  );

type ClassElementInput = {
  readonly element: ESTree.Class["body"]["body"][number];
  readonly resolution: CanonicalValuePropertyNameResolution;
  readonly structure: Extract<CanonicalValuePropertyNameStructure, { readonly kind: "class" }>;
};

const staticBlockKeys = (
  input: ClassElementInput & { readonly element: ESTree.StaticBlock },
): CandidateSet<CanonicalValue> | null =>
  input.resolution.keySemantics === "object-keys" && input.structure.side === "static"
    ? unknownCandidateSet()
    : null;

type KeyedClassElement = Exclude<
  ClassElementInput["element"],
  ESTree.StaticBlock | ESTree.TSIndexSignature
>;

const objectKeysClassElementIsExcluded = (element: KeyedClassElement): boolean =>
  element.type !== "PropertyDefinition" ||
  element.declare === true ||
  element.key.type === "PrivateIdentifier";

const keyofClassElementIsExcluded = (element: KeyedClassElement): boolean =>
  element.accessibility === "private" ||
  element.accessibility === "protected" ||
  element.key.type === "PrivateIdentifier" ||
  (element.type === "MethodDefinition" && element.kind === "constructor");

const classElementIsExcluded = (
  input: ClassElementInput & {
    readonly element: KeyedClassElement;
  },
): boolean => {
  const { element, resolution, structure } = input;
  if (element.static !== (structure.side === "static")) return true;
  return resolution.keySemantics === "object-keys"
    ? objectKeysClassElementIsExcluded(element)
    : keyofClassElementIsExcluded(element);
};

const classElementKeys = (input: ClassElementInput): CandidateSet<CanonicalValue> | null => {
  const { element, resolution } = input;
  if (element.type === "StaticBlock") return staticBlockKeys({ ...input, element });
  if (element.type === "TSIndexSignature") return unknownCandidateSet();
  if (classElementIsExcluded({ ...input, element })) return null;
  return staticKeys(resolution, element);
};

const classFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  structure: Extract<CanonicalValuePropertyNameStructure, { readonly kind: "class" }>,
): CandidateSet<CanonicalValuePropertyNameFragment> =>
  structure.node.body.body.reduce<CandidateSet<CanonicalValuePropertyNameFragment>>(
    (fragments, element) => {
      const keys = classElementKeys({ element, resolution, structure });
      return keys === null
        ? fragments
        : appendCanonicalValuePropertyNameFragments(fragments, keyFragments(structure.node, keys));
    },
    emptyFragment(structure.node),
  );

const signatureKeys = (
  resolution: CanonicalValuePropertyNameResolution,
  signature: ESTree.TSSignature,
): CandidateSet<CanonicalValue> | null => {
  if (signature.type === "TSIndexSignature") return unknownCandidateSet();
  if (signature.type !== "TSPropertySignature" && signature.type !== "TSMethodSignature") {
    return null;
  }
  return staticKeys(resolution, signature);
};

const signatureFragments = (input: {
  readonly node: ESTree.TSInterfaceDeclaration | ESTree.TSTypeLiteral;
  readonly resolution: CanonicalValuePropertyNameResolution;
  readonly signatures: readonly ESTree.TSSignature[];
}): CandidateSet<CanonicalValuePropertyNameFragment> =>
  input.signatures.reduce<CandidateSet<CanonicalValuePropertyNameFragment>>(
    (fragments, signature) => {
      const keys = signatureKeys(input.resolution, signature);
      return keys === null
        ? fragments
        : appendCanonicalValuePropertyNameFragments(fragments, keyFragments(input.node, keys));
    },
    emptyFragment(input.node),
  );

const enumFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  declaration: ESTree.TSEnumDeclaration,
): CandidateSet<CanonicalValuePropertyNameFragment> => {
  const fragments = declaration.body.members.reduce<
    CandidateSet<CanonicalValuePropertyNameFragment>
  >(
    (accumulated, member) =>
      appendCanonicalValuePropertyNameFragments(
        accumulated,
        keyFragments(
          declaration,
          staticKeys(resolution, { computed: member.computed, key: member.id }),
        ),
      ),
    emptyFragment(declaration),
  );
  return resolution.keySemantics === "object-keys"
    ? openCandidateSet(fragments.candidates, canonicalValuePropertyNameFragmentKey)
    : fragments;
};

const namedRuntimeDeclaration = (
  declaration: ESTree.Declaration,
): readonly ESTree.Node[] | null | undefined => {
  switch (declaration.type) {
    case "ClassDeclaration":
    case "FunctionDeclaration":
      return declaration.id === null ? null : [declaration.id];
    case "TSEnumDeclaration":
    case "TSImportEqualsDeclaration":
    case "TSModuleDeclaration":
      return declaration.id.type === "Identifier" ? [declaration.id] : null;
    default:
      return undefined;
  }
};

const runtimeDeclarationNames = (
  declaration: ESTree.Declaration,
): readonly ESTree.Node[] | null => {
  if (declaration.type === "VariableDeclaration") {
    const identifiers = declaration.declarations.map((item) => item.id);
    return identifiers.every((identifier) => identifier.type === "Identifier") ? identifiers : null;
  }
  const named = namedRuntimeDeclaration(declaration);
  if (named !== undefined) return named;
  return declaration.type === "TSTypeAliasDeclaration" ||
    declaration.type === "TSInterfaceDeclaration"
    ? []
    : null;
};

const namespaceStatementKeys = (
  resolution: CanonicalValuePropertyNameResolution,
  statement: ESTree.TSModuleBlock["body"][number],
): CandidateSet<CanonicalValue> | null => {
  if (statement.type !== "ExportNamedDeclaration") return null;
  if (statement.exportKind === "type") return closedCandidateSet([], canonicalValueKey);
  const declarationNames =
    statement.declaration === null ? [] : runtimeDeclarationNames(statement.declaration);
  if (declarationNames === null) return unknownCandidateSet();
  const specifierNames = statement.specifiers
    .filter((specifier) => specifier.exportKind !== "type")
    .map((specifier) => specifier.exported);
  return closedCandidateSet(
    [...declarationNames, ...specifierNames].flatMap((name) => {
      const keys = staticKeys(resolution, { computed: false, key: name });
      return keys.complete ? keys.candidates : [];
    }),
    canonicalValueKey,
  );
};

const namespaceFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  declaration: ESTree.TSModuleDeclaration,
): CandidateSet<CanonicalValuePropertyNameFragment> => {
  if (declaration.body === null) return unknownCandidateSet();
  return declaration.body.body.reduce<CandidateSet<CanonicalValuePropertyNameFragment>>(
    (fragments, statement) => {
      const keys = namespaceStatementKeys(resolution, statement);
      return keys === null
        ? fragments
        : appendCanonicalValuePropertyNameFragments(fragments, keyFragments(declaration, keys));
    },
    emptyFragment(declaration),
  );
};

export const resolveCanonicalValuePropertyNameStructureFragments = (
  resolution: CanonicalValuePropertyNameResolution,
  structure: CanonicalValuePropertyNameStructure,
): CandidateSet<CanonicalValuePropertyNameFragment> => {
  if (structure.kind === "class") return classFragments(resolution, structure);
  if (structure.kind === "enum") return enumFragments(resolution, structure.node);
  if (structure.kind === "namespace") return namespaceFragments(resolution, structure.node);
  const signatures =
    structure.kind === "interface" ? structure.node.body.body : structure.node.members;
  return signatureFragments({ node: structure.node, resolution, signatures });
};
