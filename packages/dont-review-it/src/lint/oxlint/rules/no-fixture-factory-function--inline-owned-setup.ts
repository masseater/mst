import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { isAssertionEntryCall } from "../lib/spec-syntax/assertion-entries.ts";
import {
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
  type FixtureDeclaration,
  type FixtureDependency,
} from "../lib/spec-syntax/fixture-declarations.ts";
import {
  THROW_EXPECTING_MATCHERS,
  THROW_EXPECTING_MODIFIERS,
} from "../lib/spec-syntax/matcher-vocabulary.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import {
  asSpecFunction,
  blockBodyOf,
  localConstInitializer,
  unwrapSubject,
  type SpecFunction,
} from "../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  testBlockRootNames,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree, Options, Reference, Scope } from "@oxlint/plugins";
import type { ScopeLookup } from "../lib/resolved-bindings.ts";

const THROW_EXPECTING_MATCHERS_OPTION = "throwExpectingMatchers";

const throwExpectingMatchersFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return THROW_EXPECTING_MATCHERS;
  }

  const configured = first[THROW_EXPECTING_MATCHERS_OPTION];
  return Array.isArray(configured) ? new Set(configured.map(String)) : THROW_EXPECTING_MATCHERS;
};

const entryUnder = (
  node: ESTree.Expression,
  modifiers: readonly string[],
): { readonly entry: ESTree.CallExpression; readonly modifiers: readonly string[] } | null => {
  const written = unwrapSubject(node);
  if (written.type === "CallExpression") {
    return isAssertionEntryCall(written) ? { entry: written, modifiers } : null;
  }
  if (written.type !== "MemberExpression") return null;

  const member = staticMemberName(written);
  return member === null ? null : entryUnder(written.object, [member, ...modifiers]);
};

type AssertedChain = {
  readonly subject: ESTree.Expression;
  readonly matcher: string;
  readonly modifiers: readonly string[];
};

const assertedChainOf = (call: ESTree.CallExpression): AssertedChain | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const matcher = staticMemberName(callee);
  if (matcher === null) return null;

  const stood = entryUnder(callee.object, []);
  if (stood === null) return null;

  const [handed] = stood.entry.arguments;
  if (handed === undefined || handed.type === "SpreadElement") return null;
  return { subject: unwrapSubject(handed), matcher, modifiers: stood.modifiers };
};

const demandsFailure = (chain: AssertedChain, matchers: ReadonlySet<string>): boolean =>
  matchers.has(chain.matcher) ||
  chain.modifiers.some((modifier) => THROW_EXPECTING_MODIFIERS.has(modifier));

const handedBackFunctionOf = (input: {
  readonly subject: ESTree.Expression;
  readonly body: ESTree.FunctionBody | null;
  readonly reached: Set<string>;
}): SpecFunction | null => {
  const { subject, body, reached } = input;
  const written = asSpecFunction(subject);
  if (written !== null) return written;

  const named = unwrapSubject(subject);
  if (named.type !== "Identifier" || body === null || reached.has(named.name)) return null;

  reached.add(named.name);
  const initializer = localConstInitializer(body, named.name);
  return initializer === null
    ? null
    : handedBackFunctionOf({ subject: initializer, body, reached });
};

const referencesTo = (scope: Scope, spelled: string): readonly Reference[] =>
  scope.variables.filter((bound) => bound.name === spelled).flatMap((bound) => bound.references);

type ThunkReading = {
  readonly handedOn: ReadonlySet<string>;
  readonly takenApart: readonly FixtureDependency[];
  readonly throwSubjects: ReadonlySet<ESTree.Node>;
  readonly scopeAt: ScopeLookup;
};

const readsOnlyDemandFailure = (dependency: FixtureDependency, reading: ThunkReading): boolean => {
  const { boundAs, property } = dependency;
  if (boundAs === null) return false;

  return referencesTo(reading.scopeAt(property.value), boundAs).every(
    (reference) => !reference.isWrite() && reading.throwSubjects.has(reference.identifier),
  );
};

const isDemandedFailureThunk = (fixtureName: string, reading: ThunkReading): boolean =>
  !reading.handedOn.has(fixtureName) &&
  reading.takenApart
    .filter((dependency) => dependency.name === fixtureName)
    .every((dependency) => readsOnlyDemandFailure(dependency, reading));

type FactoryReport = {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: { readonly fixture: string };
};

const reportForSubject = (input: {
  readonly declaration: FixtureDeclaration;
  readonly subject: ESTree.Expression;
  readonly reading: ThunkReading;
}): FactoryReport | null => {
  const { declaration, subject, reading } = input;
  const { name, factory } = declaration;
  if (factory === null) return null;

  const handedBack = handedBackFunctionOf({
    subject,
    body: blockBodyOf(factory),
    reached: new Set(),
  });
  if (handedBack === null) return null;

  if (handedBack.params.length > 0) {
    return { node: subject, messageId: "parameterisedFactory", data: { fixture: name } };
  }
  return isDemandedFailureThunk(name, reading)
    ? null
    : { node: subject, messageId: "handedBackFunction", data: { fixture: name } };
};

const reportsFor = (
  declarations: readonly FixtureDeclaration[],
  reading: ThunkReading,
): readonly FactoryReport[] =>
  declarations.flatMap((declaration) =>
    declaration.subjects.flatMap((subject) => {
      const report = reportForSubject({ declaration, subject, reading });
      return report === null ? [] : [report];
    }),
  );

export const noFixtureFactoryFunction = createDontReviewItRule({
  name: "no-fixture-factory-function--inline-owned-setup",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a fixture handing back a function that builds the subject, so the setup a scenario runs is spelled out in the fixture that owns it rather than chosen again by every test block",
      relatedGuidelines: [],
    },
    messages: {
      parameterisedFactory:
        "A fixture must not hand back a function that declares parameters. `{{fixture}}` hands one back, leaving every test block to pick the arguments its own subject is built from. Move the setup into this fixture, return the subject the scenario produces, and declare one fixture per scenario, repeating the setup the scenarios share. Renaming the fixture leaves the same function standing, and dropping the parameters to pass it off as a thunk leaves it reported.",
      handedBackFunction:
        "A fixture must not hand back a function as its subject. `{{fixture}}` hands one back, and the test blocks reading it ask for something other than a thrown value. Move the setup into this fixture, return the subject the scenario produces, and declare one fixture per scenario, repeating the setup the scenarios share. Wrapping the function in a type assertion, binding it to a name inside the fixture first, and handing it to the older `use` callback are all read the same way. Keep a thunk that takes no parameters only for assertions demanding a thrown value.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
          throwExpectingMatchers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const matchers = throwExpectingMatchersFrom(inspection.options);

    return {
      "Program:exit"(program: ESTree.Program) {
        const rootNames = testBlockRootNames(program);
        const calls = nodesOfType(program, "CallExpression");
        const declarations = calls.flatMap((call) => fixtureDeclarationsOf(call));
        const factories = declarations.flatMap(({ factory }) => factory ?? []);
        const testCallbacks = calls
          .filter((call) => declaresTestBlock(call, rootNames))
          .flatMap((call) => testCallbacksOf(call));

        const reading: ThunkReading = {
          handedOn: new Set(
            factories.flatMap((factory) =>
              (fixtureDependenciesOf(factory) ?? []).map(({ name }) => name),
            ),
          ),
          takenApart: testCallbacks.flatMap(
            (testCallback) => fixtureDependenciesOf(testCallback) ?? [],
          ),
          throwSubjects: new Set(
            calls
              .flatMap((call) => assertedChainOf(call) ?? [])
              .filter((chain) => demandsFailure(chain, matchers))
              .flatMap((chain) => (chain.subject.type === "Identifier" ? [chain.subject] : [])),
          ),
          scopeAt: (node) => inspection.sourceCode.getScope(node),
        };

        for (const report of reportsFor(declarations, reading)) inspection.report(report);
      },
    };
  },
});
