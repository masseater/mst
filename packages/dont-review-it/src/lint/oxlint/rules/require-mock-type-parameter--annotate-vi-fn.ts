import { isNil } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  DEFAULT_MOCK_CREATION_MEMBERS,
  DEFAULT_MOCK_NAMESPACE_SPELLINGS,
  spellsMockNamespace,
  type NamespaceLookup,
} from "../lib/spec-syntax/mock-namespace.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import { WIDENED_TYPE_NODES } from "../lib/widened-type-nodes.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const MOCK_NAMESPACE_SPELLINGS_OPTION = "mockNamespaceSpellings";

const MOCK_FACTORY_MEMBERS_OPTION = "mockFactoryMembers";

const UNCONSTRAINED_TYPE_NAMES_OPTION = "unconstrainedTypeNames";

const DEFAULT_UNCONSTRAINED_TYPE_NAMES: readonly string[] = ["Function"];

const namedSetsFrom =
  (ruleOptions: Readonly<Options>) =>
  (named: string, fallback: readonly string[]): ReadonlySet<string> => {
    const [first] = ruleOptions;
    if (typeof first !== "object" || first === null || Array.isArray(first)) {
      return new Set(fallback);
    }

    const configured = first[named];
    if (!Array.isArray(configured)) return new Set(fallback);

    const spelled = configured.filter(
      (candidate): candidate is string => typeof candidate === "string",
    );
    return new Set(spelled.length === 0 ? fallback : spelled);
  };

const typeReferenceName = (written: ESTree.TSTypeReference): string | null =>
  written.typeName.type === "Identifier" ? written.typeName.name : null;

const isWideArgumentList = (written: ESTree.TSType): boolean => {
  if (written.type === "TSAnyKeyword") return true;
  if (written.type === "TSTypeOperator") return isWideArgumentList(written.typeAnnotation);
  return written.type === "TSArrayType" && WIDENED_TYPE_NODES.has(written.elementType.type);
};

const takesAnyArgumentList = (written: ESTree.TSFunctionType): boolean => {
  const [only] = written.params;
  if (only === undefined || written.params.length !== 1) return false;
  if (only.type !== "RestElement") return false;

  const annotation = only.typeAnnotation;
  return isNil(annotation) || isWideArgumentList(annotation.typeAnnotation);
};

const yieldsAnyValue = (written: ESTree.TSFunctionType): boolean =>
  written.returnType.typeAnnotation.type === "TSAnyKeyword";

const isUnconstrainedType = (
  written: ESTree.TSType,
  unconstrainedNames: ReadonlySet<string>,
): boolean => {
  if (written.type === "TSAnyKeyword") return true;
  if (written.type === "TSTypeReference") {
    return unconstrainedNames.has(typeReferenceName(written) ?? "");
  }
  if (written.type !== "TSFunctionType") return false;
  return yieldsAnyValue(written) || takesAnyArgumentList(written);
};

export const requireMockTypeParameter = createDontReviewItRule({
  name: "require-mock-type-parameter--annotate-vi-fn",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every mock function creation to carry a type parameter that pins the call signature of the dependency it stands in for, so a mock drifting from that dependency is caught by the type checker instead of passing every assertion in the suite",
      relatedGuidelines: [],
    },
    messages: {
      untypedMockCreation:
        "A mock function must not be created without a type parameter naming the call signature it stands in for. Write the call signature of the real dependency as the type parameter of the creation call.",
      unconstrainedMockTypeParameter:
        "The type parameter of a mock function creation must not leave the call signature open. Replace `{{written}}` with the call signature of the real dependency: name the type of every parameter and the type of the returned value.",
    },
    schema: [
      {
        type: "object",
        properties: {
          mockNamespaceSpellings: { type: "array", items: { type: "string" } },
          mockFactoryMembers: { type: "array", items: { type: "string" } },
          unconstrainedTypeNames: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const namedSets = namedSetsFrom(inspection.options);
    const lookup: NamespaceLookup = {
      scopeAt: (node) => inspection.sourceCode.getScope(node),
      spellings: namedSets(MOCK_NAMESPACE_SPELLINGS_OPTION, DEFAULT_MOCK_NAMESPACE_SPELLINGS),
      seenBindings: new Set(),
    };
    const factoryMembers = namedSets(MOCK_FACTORY_MEMBERS_OPTION, DEFAULT_MOCK_CREATION_MEMBERS);
    const unconstrainedNames = namedSets(
      UNCONSTRAINED_TYPE_NAMES_OPTION,
      DEFAULT_UNCONSTRAINED_TYPE_NAMES,
    );

    const reportUnconstrained = (
      node: ESTree.CallExpression,
      written: readonly ESTree.TSType[],
    ): void => {
      const open = written.find((handedParam) =>
        isUnconstrainedType(handedParam, unconstrainedNames),
      );
      if (open === undefined) return;
      inspection.report({
        node,
        messageId: "unconstrainedMockTypeParameter",
        data: { written: inspection.sourceCode.getText(open) },
      });
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        const callee = unwrapSubject(node.callee);
        if (callee.type !== "MemberExpression") return;

        const member = staticMemberName(callee);
        if (member === null || !factoryMembers.has(member)) return;
        if (!spellsMockNamespace(callee.object, lookup)) return;

        const written = node.typeArguments?.params ?? [];
        if (written.length === 0) {
          inspection.report({ node, messageId: "untypedMockCreation" });
          return;
        }
        reportUnconstrained(node, written);
      },
    };
  },
});
