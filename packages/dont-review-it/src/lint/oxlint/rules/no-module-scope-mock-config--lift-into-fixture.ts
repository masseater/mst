import { createDontReviewItRule } from "../../../create-rule.ts";
import { resolveBinding } from "../lib/resolved-bindings.ts";
import {
  FIXTURE_BUILDER_MEMBER,
  fixtureDeclarationsOf,
} from "../lib/spec-syntax/fixture-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import { asSpecFunction, unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import { testBlockBindings } from "../lib/spec-syntax/test-block-declarations.ts";

import type { Definition, ESTree, Options, Scope, Variable } from "@oxlint/plugins";

type MockVocabulary = {
  readonly namespaceSpellings: ReadonlySet<string>;
  readonly creationMembers: ReadonlySet<string>;
  readonly behaviorMembers: ReadonlySet<string>;
  readonly replacementMembers: ReadonlySet<string>;
};

type RunnerReach = {
  readonly namespace: boolean;
  readonly mock: boolean;
};

const REACHED_NOTHING: RunnerReach = { namespace: false, mock: false };

const REACHED_NAMESPACE: RunnerReach = { namespace: true, mock: false };

const REACHED_MOCK: RunnerReach = { namespace: false, mock: true };

type ReachLookup = {
  readonly scopeAt: (node: ESTree.Node) => Scope;
  readonly vocabulary: MockVocabulary;
  readonly tracedBindings: ReadonlySet<Variable>;
};

type MockWriting = {
  readonly call: ESTree.CallExpression;
  readonly messageId: string;
  readonly member: string;
};

const listedNames = (options: Readonly<Options>, named: string): readonly string[] | null => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return null;

  const listed = first[named];
  if (!Array.isArray(listed)) return null;

  const spelled = listed.filter((entry): entry is string => typeof entry === "string");
  return spelled.length === 0 ? null : spelled;
};

const mockVocabularyFrom = (options: Readonly<Options>): MockVocabulary => ({
  namespaceSpellings: new Set(listedNames(options, "mockNamespaceSpellings") ?? ["vi"]),
  creationMembers: new Set(
    listedNames(options, "mockCreationMembers") ?? ["fn", "mocked", "spyOn"],
  ),
  behaviorMembers: new Set(
    listedNames(options, "mockBehaviorMembers") ?? [
      "mockImplementation",
      "mockImplementationOnce",
      "mockRejectedValue",
      "mockRejectedValueOnce",
      "mockResolvedValue",
      "mockResolvedValueOnce",
      "mockReturnThis",
      "mockReturnValue",
      "mockReturnValueOnce",
      "mockThrow",
      "mockThrowOnce",
      "withImplementation",
    ],
  ),
  replacementMembers: new Set(
    listedNames(options, "moduleReplacementMembers") ?? ["mock", "doMock"],
  ),
});

const soonestReach = (reached: readonly RunnerReach[]): RunnerReach =>
  reached.find((reach) => reach.namespace || reach.mock) ?? REACHED_NOTHING;

const qualifiedNamespaceReach = (
  node: ESTree.MemberExpression,
  lookup: ReachLookup,
): RunnerReach => {
  const member = staticMemberName(node);
  if (member === null || !lookup.vocabulary.namespaceSpellings.has(member)) return REACHED_NOTHING;

  const holder = unwrapSubject(node.object);
  if (holder.type !== "Identifier") return REACHED_NOTHING;

  const binding = resolveBinding(lookup.scopeAt(holder), holder.name);
  if (binding === null) return REACHED_NOTHING;
  return binding.defs.some((held) => held.node.type === "ImportNamespaceSpecifier")
    ? REACHED_NAMESPACE
    : REACHED_NOTHING;
};

const memberReach = (node: ESTree.MemberExpression, lookup: ReachLookup): RunnerReach =>
  runnerReachOf(node.object, lookup).mock ? REACHED_MOCK : qualifiedNamespaceReach(node, lookup);

const callReach = (node: ESTree.CallExpression, lookup: ReachLookup): RunnerReach => {
  const callee = unwrapSubject(node.callee);
  if (callee.type !== "MemberExpression") return REACHED_NOTHING;

  const member = staticMemberName(callee);
  if (member !== null && lookup.vocabulary.creationMembers.has(member)) {
    return runnerReachOf(callee.object, lookup).namespace ? REACHED_MOCK : REACHED_NOTHING;
  }
  if (member !== null && !lookup.vocabulary.behaviorMembers.has(member)) return REACHED_NOTHING;
  return runnerReachOf(callee.object, lookup).mock ? REACHED_MOCK : REACHED_NOTHING;
};

const definitionReach = (definition: Definition, lookup: ReachLookup): RunnerReach => {
  const declared = definition.node;
  if (declared.type === "ImportSpecifier") {
    const exported =
      declared.imported.type === "Identifier" ? declared.imported.name : declared.imported.value;
    return lookup.vocabulary.namespaceSpellings.has(exported) ? REACHED_NAMESPACE : REACHED_NOTHING;
  }
  if (declared.type !== "VariableDeclarator" || declared.init === null) return REACHED_NOTHING;
  if (declared.id.type !== "Identifier") return REACHED_NOTHING;
  return runnerReachOf(declared.init, lookup);
};

const bindingReach = (binding: Variable, lookup: ReachLookup): RunnerReach => {
  if (lookup.tracedBindings.has(binding)) return REACHED_NOTHING;

  const traced = { ...lookup, tracedBindings: new Set([...lookup.tracedBindings, binding]) };
  return soonestReach(binding.defs.map((definition) => definitionReach(definition, traced)));
};

const runnerReachOf = (node: ESTree.Expression, lookup: ReachLookup): RunnerReach => {
  const written = unwrapSubject(node);
  if (written.type === "MemberExpression") return memberReach(written, lookup);
  if (written.type === "CallExpression") return callReach(written, lookup);
  if (written.type !== "Identifier") return REACHED_NOTHING;

  const binding = resolveBinding(lookup.scopeAt(written), written.name);
  if (binding !== null) return bindingReach(binding, lookup);
  return lookup.vocabulary.namespaceSpellings.has(written.name)
    ? REACHED_NAMESPACE
    : REACHED_NOTHING;
};

const namesMockThroughSubscript = (
  callee: ESTree.MemberExpression,
  lookup: ReachLookup,
): boolean => {
  if (!callee.computed) return false;

  const reached = runnerReachOf(callee.object, lookup);
  return reached.mock || reached.namespace;
};

const mockWritingOf = (call: ESTree.CallExpression, lookup: ReachLookup): MockWriting | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const member = staticMemberName(callee);
  if (member === null) {
    return namesMockThroughSubscript(callee, lookup)
      ? { call, messageId: "subscriptedMockWriting", member: "" }
      : null;
  }
  if (lookup.vocabulary.behaviorMembers.has(member)) {
    return { call, messageId: "mockBehaviorOutsideFixture", member };
  }
  if (!lookup.vocabulary.creationMembers.has(member)) return null;
  return runnerReachOf(callee.object, lookup).namespace
    ? { call, messageId: "mockCreationOutsideFixture", member }
    : null;
};

const replacementFactoryOf = (
  call: ESTree.CallExpression,
  lookup: ReachLookup,
): ESTree.Node | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const member = staticMemberName(callee);
  if (member === null || !lookup.vocabulary.replacementMembers.has(member)) return null;
  if (!runnerReachOf(callee.object, lookup).namespace) return null;

  const [, handed] = call.arguments;
  if (handed === undefined || handed.type === "SpreadElement") return null;
  return asSpecFunction(handed);
};

const builderRootName = (node: ESTree.Expression): string | null => {
  const written = unwrapSubject(node);
  if (written.type === "Identifier") return written.name;
  if (written.type === "CallExpression") return builderRootName(written.callee);
  if (written.type !== "MemberExpression") return null;
  if (staticMemberName(written) !== FIXTURE_BUILDER_MEMBER) return null;
  return builderRootName(written.object);
};

const fixtureBodiesOf = (call: ESTree.CallExpression): readonly ESTree.Node[] =>
  fixtureDeclarationsOf(call).flatMap((declaration) => {
    const held = declaration.factory?.body;
    return held === undefined || held === null ? [] : [held];
  });

const callsBeneath = (node: ESTree.Expression): readonly ESTree.CallExpression[] => {
  const written = unwrapSubject(node);
  if (written.type === "MemberExpression") return callsBeneath(written.object);
  if (written.type !== "CallExpression") return [];
  return [written, ...receiverCallsOf(written)];
};

const receiverCallsOf = (call: ESTree.CallExpression): readonly ESTree.CallExpression[] => {
  const callee = unwrapSubject(call.callee);
  return callee.type === "MemberExpression" ? callsBeneath(callee.object) : [];
};

const standsWithin = (written: ESTree.Node, regions: readonly ESTree.Node[]): boolean =>
  regions.some((region) => written.start >= region.start && written.end <= region.end);

export const noModuleScopeMockConfig = createDontReviewItRule({
  name: "no-module-scope-mock-config--lift-into-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow creating a mock or settling what it does anywhere but a module replacement factory and the body of a fixture, so the instance a test reads was stood up and settled for that test alone",
      relatedGuidelines: [],
    },
    messages: {
      mockCreationOutsideFixture:
        "A mock must not be stood up outside a fixture. Move `{{member}}` into the body of the fixture the test takes its subject from, return the mock binding from there, and let the test block receive it as a parameter. Only the factory of a module replacement declaration and the body of a fixture function may hold this call. Parking the instance in a hoisted container, importing the mock namespace under another name, reaching the member through a subscript, and dropping the call into the body of the test block are each reported the same way.",
      mockBehaviorOutsideFixture:
        "What a mock does must not be settled outside a fixture. Move `{{member}}` into the body of the fixture that returns the mock, leaving every test to run with the setting applied for it alone. Only the factory of a module replacement declaration and the body of a fixture function may hold this call. Moving the call into the body of the test block, behind a renamed binding, and behind a subscript are each reported the same way, and clearing or restoring the mock afterwards is not the answer either: the shared runner configuration owns that.",
      subscriptedMockWriting:
        "A method reached on a mock through a subscript that only settles at run time must not be called outside a fixture. Write the member out by name and move the call into the body of the fixture that returns the mock. Only the factory of a module replacement declaration and the body of a fixture function may hold this call. A subscript spelled out in full is read as the member it names, so moving that spelling into a binding changes nothing.",
    },
    schema: [
      {
        type: "object",
        properties: {
          mockNamespaceSpellings: { type: "array", items: { type: "string" } },
          mockCreationMembers: { type: "array", items: { type: "string" } },
          mockBehaviorMembers: { type: "array", items: { type: "string" } },
          moduleReplacementMembers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const lookup: ReachLookup = {
      scopeAt: (node) => context.sourceCode.getScope(node),
      vocabulary: mockVocabularyFrom(context.options),
      tracedBindings: new Set(),
    };

    const bindings = testBlockBindings();
    const writings = new Set<MockWriting>();
    const builderCalls = new Set<ESTree.CallExpression>();
    const factoryRegions = new Set<ESTree.Node>();

    const allowedRegions = (): readonly ESTree.Node[] => {
      const rootNames = bindings.rootNames();
      return [
        ...factoryRegions,
        ...[...builderCalls]
          .filter((call) => rootNames.has(builderRootName(call.callee) ?? ""))
          .flatMap((call) => fixtureBodiesOf(call)),
      ];
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        bindings.takeImport(node);
      },
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        bindings.takeLocalBinding(node);
      },
      CallExpression(node: ESTree.CallExpression) {
        const factory = replacementFactoryOf(node, lookup);
        if (factory !== null) factoryRegions.add(factory);

        const callee = unwrapSubject(node.callee);
        if (
          callee.type === "MemberExpression" &&
          staticMemberName(callee) === FIXTURE_BUILDER_MEMBER
        ) {
          builderCalls.add(node);
        }

        const writing = mockWritingOf(node, lookup);
        if (writing !== null) writings.add(writing);
      },
      "Program:exit"() {
        const regions = allowedRegions();
        const outstanding = [...writings].filter((writing) => !standsWithin(writing.call, regions));
        const chained = new Set(outstanding.flatMap((writing) => receiverCallsOf(writing.call)));

        for (const writing of outstanding) {
          if (chained.has(writing.call)) continue;
          context.report({
            node: writing.call,
            messageId: writing.messageId,
            data: { member: writing.member },
          });
        }
      },
    };
  },
});
