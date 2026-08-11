import { createDontReviewItRule } from "../../../create-rule.ts";
import { handedValues, partsOf } from "../lib/spec-syntax/expression-parts.ts";
import {
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
} from "../lib/spec-syntax/fixture-declarations.ts";
import {
  importedDeclarationOf,
  moduleDeclarationsOf,
  type ModuleDeclarations,
} from "../lib/spec-syntax/module-declarations.ts";
import {
  DESTRUCTIVE_OPERATIONS,
  NORMALIZING_METHODS,
  normalizingFunctionsFrom,
  SPREADING_ASSIGNMENT,
  SPREADING_ASSIGNMENT_NAMESPACE,
} from "../lib/spec-syntax/normalizing-operations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticCalleeName, staticMemberName } from "../lib/spec-syntax/static-names.ts";
import {
  blockBodyOf,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
} from "../lib/spec-syntax/subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

const PROPERTY_WRITE = "An assignment";

const PROPERTY_REMOVAL = "A `delete`";

const SPREADING_WRITE = "Object.assign";

type Reading = {
  readonly module: ModuleDeclarations;
  readonly factory: SpecFunction | null;
  readonly locals: ReadonlyMap<string, ESTree.Expression>;
  readonly bound: ReadonlySet<string>;
  readonly visitedModules: ReadonlySet<string>;
};

type Origin = {
  readonly node: ESTree.Node;
  readonly name: string;
} | null;

type Finding = {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: Readonly<Record<string, string>>;
};

type Mutation = {
  readonly node: ESTree.Node;
  readonly root: string;
  readonly operation: string;
};

type Walk = {
  readonly written: ESTree.Expression;
  readonly reading: Reading;
  readonly vocabulary: ReadonlySet<string>;
  readonly origin: Origin;
  readonly seen: Set<ESTree.Expression>;
};

const asFunction = (node: ESTree.Expression): SpecFunction | null => {
  const written = unwrapSubject(node);
  if (written.type === "ArrowFunctionExpression") return written;
  if (written.type === "FunctionExpression") return written;
  return written.type === "FunctionDeclaration" ? written : null;
};

const parameterNamesOf = (fn: SpecFunction): ReadonlySet<string> =>
  new Set([
    ...fn.params.flatMap((parameter) => (parameter.type === "Identifier" ? [parameter.name] : [])),
    ...(fixtureDependenciesOf(fn) ?? []).flatMap((dependency) =>
      dependency.boundAs === null ? [] : [dependency.boundAs],
    ),
  ]);

const readingIn = (input: {
  readonly module: ModuleDeclarations;
  readonly factory: SpecFunction | null;
  readonly visitedModules: ReadonlySet<string>;
}): Reading => {
  const body = input.factory === null ? null : blockBodyOf(input.factory);
  return {
    ...input,
    locals:
      body === null
        ? new Map()
        : moduleDeclarationsOf(input.module.filename, body.body).initializerByName,
    bound: input.factory === null ? new Set() : parameterNamesOf(input.factory),
  };
};

const localInitializer = (name: string, reading: Reading): ESTree.Expression | null => {
  if (reading.bound.has(name)) return null;
  return reading.locals.get(name) ?? reading.module.initializerByName.get(name) ?? null;
};

const resolvedName = (
  name: string,
  reading: Reading,
): { readonly declared: ESTree.Expression; readonly reading: Reading } | null => {
  const local = localInitializer(name, reading);
  if (local !== null) return { declared: local, reading };
  if (reading.bound.has(name)) return null;

  const imported = reading.module.importedByName.get(name);
  if (imported === undefined) return null;

  const found = importedDeclarationOf({
    from: reading.module,
    imported,
    visited: reading.visitedModules,
  });
  if (found === null) return null;
  return {
    declared: found.declared,
    reading: readingIn({
      module: found.module,
      factory: null,
      visitedModules: new Set([...reading.visitedModules, found.module.filename]),
    }),
  };
};

const operationFinding = (input: {
  readonly node: ESTree.Node;
  readonly operation: string;
  readonly origin: Origin;
}): Finding =>
  input.origin === null
    ? { node: input.node, messageId: "normalizedSubject", data: { operation: input.operation } }
    : {
        node: input.origin.node,
        messageId: "normalizedBehindName",
        data: { name: input.origin.name, operation: input.operation },
      };

const findingsIn = (walk: Walk): readonly Finding[] => {
  const bare = unwrapSubject(walk.written);
  if (walk.seen.has(bare)) return [];

  walk.seen.add(bare);
  const beside = partsOf(bare).flatMap((part) => findingsIn({ ...walk, written: part }));
  if (bare.type === "Identifier") return [...beside, ...findingsBehindName(bare, walk)];
  return bare.type === "CallExpression" ? [...beside, ...findingsInCall(bare, walk)] : beside;
};

const findingsBehindName = (name: ESTree.IdentifierReference, walk: Walk): readonly Finding[] => {
  const resolved = resolvedName(name.name, walk.reading);
  if (resolved === null) return [];

  const crossed = resolved.reading.module.filename !== walk.reading.module.filename;
  return findingsIn({
    ...walk,
    written: resolved.declared,
    reading: resolved.reading,
    origin: walk.origin ?? (crossed ? { node: name, name: name.name } : null),
  });
};

const findingsInCall = (call: ESTree.CallExpression, walk: Walk): readonly Finding[] => {
  if (spreadingWriteTarget(call) !== null) {
    return [operationFinding({ node: call, operation: SPREADING_WRITE, origin: walk.origin })];
  }

  const name = staticCalleeName(call);
  if (name === null) return [];
  if (walk.vocabulary.has(name)) {
    return [operationFinding({ node: call, operation: name, origin: walk.origin })];
  }

  const resolved = resolvedName(name, walk.reading);
  const declared = resolved === null ? null : asFunction(resolved.declared);
  if (resolved === null || declared === null) return [];

  return returnedExpressionsOf(declared).flatMap((returned) =>
    findingsIn({
      ...walk,
      written: returned,
      reading: readingIn({ ...resolved.reading, factory: declared }),
      origin: walk.origin ?? { node: call, name },
    }),
  );
};

const rootName = (node: ESTree.Expression): string | null => {
  const written = unwrapSubject(node);
  if (written.type === "Identifier") return written.name;
  return written.type === "MemberExpression" ? rootName(written.object) : null;
};

const spreadingWriteTarget = (call: ESTree.CallExpression): ESTree.Expression | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;
  if (staticMemberName(callee) !== SPREADING_ASSIGNMENT) return null;

  const namespace = unwrapSubject(callee.object);
  if (namespace.type !== "Identifier") return null;
  if (namespace.name !== SPREADING_ASSIGNMENT_NAMESPACE) return null;
  return handedValues(call.arguments).at(0) ?? null;
};

const mutationInCall = (call: ESTree.CallExpression): Mutation | null => {
  const spreading = spreadingWriteTarget(call);
  if (spreading !== null) {
    const root = rootName(spreading);
    return root === null ? null : { node: call, root, operation: `\`${SPREADING_WRITE}\`` };
  }

  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const member = staticMemberName(callee);
  if (member === null || !DESTRUCTIVE_OPERATIONS.has(member)) return null;

  const root = rootName(callee.object);
  return root === null ? null : { node: call, root, operation: `\`${member}\`` };
};

const boundNamesOf = (named: {
  readonly subject: ESTree.Expression;
  readonly reading: Reading;
  readonly reached: Set<string>;
}): ReadonlySet<string> => {
  const bare = unwrapSubject(named.subject);
  if (bare.type !== "Identifier" || named.reached.has(bare.name)) return named.reached;

  named.reached.add(bare.name);
  const initializer = localInitializer(bare.name, named.reading);
  return initializer === null ? named.reached : boundNamesOf({ ...named, subject: initializer });
};

const mutationFindingsOf = (input: {
  readonly subject: ESTree.Expression;
  readonly reading: Reading;
  readonly mutations: ReadonlySet<Mutation>;
}): readonly Finding[] => {
  const { factory } = input.reading;
  if (factory === null) return [];

  const guarded = boundNamesOf({
    subject: input.subject,
    reading: input.reading,
    reached: new Set(),
  });
  return [...input.mutations]
    .filter((mutation) => guarded.has(mutation.root))
    .filter((mutation) => mutation.node.start >= factory.start && mutation.node.end <= factory.end)
    .filter((mutation) => mutation.node.start < input.subject.start)
    .map((mutation) => ({
      node: mutation.node,
      messageId: "mutatedSubject",
      data: { operation: mutation.operation, subject: mutation.root },
    }));
};

export const noNormalizeSutOutput = createDontReviewItRule({
  name: "no-normalize-sut-output--assert-natural-shape",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reshaping the value a fixture hands back, so an assertion is written against the shape the code under test produced rather than the shape the spec tidied it into",
      relatedGuidelines: [],
    },
    messages: {
      normalizedSubject:
        "A fixture must not reshape the value the code under test produced before handing it back. `{{operation}}` reshapes it on the way out. Return the produced value untouched, and state the claim about order, duplication or formatting in the assertion itself: give each element its own `it`, assert that each expected element belongs to the collection, or wrap both sides in a set before comparing them.",
      normalizedBehindName:
        "A fixture must not reshape the value the code under test produced before handing it back. `{{name}}` reaches `{{operation}}` on the way out. Return the produced value untouched, and state the claim about order, duplication or formatting in the assertion itself: give each element its own `it`, assert that each expected element belongs to the collection, or wrap both sides in a set before comparing them.",
      mutatedSubject:
        "A fixture must not write over the value the code under test produced before handing it back. {{operation}} rewrites `{{subject}}` on the way out. Keep the produced value untouched, and state what this rewriting was preparing for in the assertion itself.",
    },
    schema: [
      {
        type: "object",
        properties: {
          normalizingFunctions: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const vocabulary = new Set([
      ...NORMALIZING_METHODS,
      ...normalizingFunctionsFrom(context.options),
    ]);
    const fixtures = new Set<ESTree.CallExpression>();
    const mutations = new Set<Mutation>();

    const readMutation = (mutation: Mutation | null): void => {
      if (mutation !== null) mutations.add(mutation);
    };

    return {
      AssignmentExpression(node: ESTree.AssignmentExpression) {
        if (node.left.type !== "MemberExpression") return;
        const root = rootName(node.left.object);
        readMutation(root === null ? null : { node, root, operation: PROPERTY_WRITE });
      },
      CallExpression(node: ESTree.CallExpression) {
        if (fixtureDeclarationsOf(node).length > 0) fixtures.add(node);
        readMutation(mutationInCall(node));
      },
      UnaryExpression(node: ESTree.UnaryExpression) {
        if (node.operator !== "delete") return;
        const written = unwrapSubject(node.argument);
        if (written.type !== "MemberExpression") return;
        const root = rootName(written.object);
        readMutation(root === null ? null : { node, root, operation: PROPERTY_REMOVAL });
      },
      "Program:exit"(node: ESTree.Program) {
        const module = moduleDeclarationsOf(context.filename, node.body);
        const reported = new Map<string, Finding>();

        for (const fixture of fixtures) {
          for (const declaration of fixtureDeclarationsOf(fixture)) {
            const reading = readingIn({
              module,
              factory: declaration.factory,
              visitedModules: new Set([context.filename]),
            });
            for (const subject of declaration.subjects) {
              const found = [
                ...findingsIn({
                  written: subject,
                  reading,
                  vocabulary,
                  origin: null,
                  seen: new Set(),
                }),
                ...mutationFindingsOf({ subject, reading, mutations }),
              ];
              for (const finding of found) {
                reported.set(`${finding.messageId}:${finding.node.start}`, finding);
              }
            }
          }
        }

        for (const finding of reported.values()) context.report(finding);
      },
    };
  },
});
