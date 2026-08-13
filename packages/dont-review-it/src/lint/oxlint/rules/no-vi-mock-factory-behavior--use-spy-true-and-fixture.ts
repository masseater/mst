import { createDontReviewItRule } from "../../../create-rule.ts";
import { exemptionsWrittenAbove } from "../lib/directive-comments.ts";
import {
  DEFAULT_MOCK_CREATION_MEMBERS,
  DEFAULT_MOCK_NAMESPACE_SPELLINGS,
  MOCK_BEHAVIOUR_SETTERS,
  MODULE_REPLACEMENT_MEMBER,
  spellsImportedBinding,
  spellsMockNamespace,
  type NamespaceLookup,
} from "../lib/spec-syntax/mock-namespace.ts";
import { staticMemberName, staticSpelling } from "../lib/spec-syntax/static-names.ts";
import {
  asSpecFunction,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
} from "../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Options, Scope } from "@oxlint/plugins";

const RULE_NAME = "no-vi-mock-factory-behavior--use-spy-true-and-fixture";

const BUILTIN_MODULE_PREFIXES_OPTION = "builtinModulePrefixes";

const DEFAULT_BUILTIN_MODULE_PREFIXES: readonly string[] = ["node:"];

const builtinModulePrefixesFrom = (ruleOptions: Readonly<Options>): readonly string[] => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return DEFAULT_BUILTIN_MODULE_PREFIXES;
  }

  const configured = first[BUILTIN_MODULE_PREFIXES_OPTION];
  if (!Array.isArray(configured)) return DEFAULT_BUILTIN_MODULE_PREFIXES;

  const spelled = configured.filter(
    (candidate): candidate is string => typeof candidate === "string",
  );
  return spelled.length === 0 ? DEFAULT_BUILTIN_MODULE_PREFIXES : spelled;
};

type ModuleReplacement = {
  readonly factory: SpecFunction;
  readonly specifier: string | null;
};

const moduleReplacementOf = (
  call: ESTree.CallExpression,
  lookup: NamespaceLookup,
): ModuleReplacement | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;
  if (staticMemberName(callee) !== MODULE_REPLACEMENT_MEMBER) return null;
  if (!spellsMockNamespace(callee.object, lookup)) return null;

  const handed = call.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : [argument],
  );
  if (handed.length !== call.arguments.length) return null;

  const [named, second] = handed;
  if (named === undefined || second === undefined) return null;

  const factory = asSpecFunction(second);
  return factory === null ? null : { factory, specifier: staticSpelling(named) };
};

const yieldsEmptyObjectOnly = (factory: SpecFunction): boolean => {
  const yielded = returnedExpressionsOf(factory);
  if (yielded.length === 0) return false;

  return yielded.every((expression) => {
    const written = unwrapSubject(expression);
    return written.type === "ObjectExpression" && written.properties.length === 0;
  });
};

const namesBuiltinModule = (specifier: string | null, prefixes: readonly string[]): boolean =>
  specifier !== null && prefixes.some((prefix) => specifier.startsWith(prefix));

const setsMockBehaviour = (call: ESTree.CallExpression): boolean => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return false;

  const member = staticMemberName(callee);
  return member !== null && MOCK_BEHAVIOUR_SETTERS.has(member);
};

const createsMockWithImplementation = (
  call: ESTree.CallExpression,
  lookup: NamespaceLookup,
): boolean => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return false;

  const member = staticMemberName(callee);
  if (member === null || !DEFAULT_MOCK_CREATION_MEMBERS.includes(member)) return false;
  if (call.arguments.length === 0) return false;
  return spellsMockNamespace(callee.object, lookup);
};

const callsImportedBinding = (
  call: ESTree.CallExpression,
  scopeAt: (node: ESTree.Node) => Scope,
): boolean => {
  const callee = unwrapSubject(call.callee);
  return callee.type === "Identifier" && spellsImportedBinding(callee, scopeAt);
};

const yieldsImportedBinding = (
  factory: SpecFunction,
  scopeAt: (node: ESTree.Node) => Scope,
): boolean =>
  returnedExpressionsOf(factory)
    .map((expression) => unwrapSubject(expression))
    .some((written) => written.type === "Identifier" && spellsImportedBinding(written, scopeAt));

export const noViMockFactoryBehavior = createDontReviewItRule({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a module replacement declaration from carrying a factory, so what a replaced module hands back is declared by the fixture of the test that reads it instead of being fixed once for every test in the file",
      relatedGuidelines: [],
    },
    messages: {
      factoryShape:
        "A module replacement declaration must not hand over a factory. Pass `{ spy: true }` as the second argument and let the replaced module answer, so the replacement records how it was called and settles nothing.",
      factoryBehaviour:
        "The body of a module replacement factory must not settle what a mock hands back. Delete every return value, resolved value, rejected value and implementation written here, and leave the replacement a pass-through that only records how it was called.",
      unreasonedExemption:
        "An exemption comment must not stand without grounds. Write the grounds for this exemption after `--`, and name there the boundary this spec replaces by hand.",
    },
    schema: [
      {
        type: "object",
        properties: {
          builtinModulePrefixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const lookup: NamespaceLookup = {
      scopeAt: (node: ESTree.Node): Scope => inspection.sourceCode.getScope(node),
      spellings: new Set(DEFAULT_MOCK_NAMESPACE_SPELLINGS),
      seenBindings: new Set(),
    };
    const builtinPrefixes = builtinModulePrefixesFrom(inspection.options);
    const factories = new Set<SpecFunction>();
    const settled = new Set<SpecFunction>();

    const reportBehaviour = (factory: SpecFunction): void => {
      if (settled.has(factory)) return;
      settled.add(factory);
      inspection.report({ node: factory, messageId: "factoryBehaviour" });
    };

    const enclosingFactory = (node: ESTree.Node): SpecFunction | null =>
      [...factories].find((factory) => node.start >= factory.start && node.end <= factory.end) ??
      null;

    const grantsExemption = (call: ESTree.CallExpression): boolean => {
      const written = exemptionsWrittenAbove({
        comments: inspection.sourceCode.ast.comments,
        line: call.loc.start.line,
        ruleName: RULE_NAME,
      });

      for (const exemption of written.filter((carried) => carried.grounds === "")) {
        inspection.report({ loc: exemption.comment.loc, messageId: "unreasonedExemption" });
      }
      return written.some((exemption) => exemption.grounds !== "");
    };

    const takeDeclaration = (call: ESTree.CallExpression, replacement: ModuleReplacement): void => {
      factories.add(replacement.factory);
      if (yieldsImportedBinding(replacement.factory, lookup.scopeAt)) {
        reportBehaviour(replacement.factory);
      }

      const exempted = grantsExemption(call);
      if (namesBuiltinModule(replacement.specifier, builtinPrefixes)) return;
      if (yieldsEmptyObjectOnly(replacement.factory)) return;
      if (exempted) return;
      inspection.report({ node: replacement.factory, messageId: "factoryShape" });
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        const replacement = moduleReplacementOf(node, lookup);
        if (replacement !== null) {
          takeDeclaration(node, replacement);
          return;
        }

        const factory = enclosingFactory(node);
        if (factory === null) return;
        if (
          setsMockBehaviour(node) ||
          createsMockWithImplementation(node, lookup) ||
          callsImportedBinding(node, lookup.scopeAt)
        ) {
          reportBehaviour(factory);
        }
      },
    };
  },
});
