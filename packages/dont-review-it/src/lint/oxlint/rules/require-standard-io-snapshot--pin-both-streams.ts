import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { isAssertionEntryReference } from "../lib/spec-syntax/assertion-entries.ts";
import {
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
  type FixtureDeclaration,
} from "../lib/spec-syntax/fixture-declarations.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import { standardIoFixtureLocalNameOf } from "../lib/standard-io-fixture.ts";

import type { ESTree } from "@oxlint/plugins";

const CAPTURED_STREAM_NAMES = ["stdout", "stderr"] as const;

const SNAPSHOT_MATCHER_NAMES = new Set(["toMatchInlineSnapshot", "toMatchSnapshot"]);

const rootIdentifierName = (expression: ESTree.Expression): string | null => {
  const written = unwrapSubject(expression);
  if (written.type === "Identifier") return written.name;
  if (written.type === "MemberExpression") return rootIdentifierName(written.object);
  if (written.type === "CallExpression") return rootIdentifierName(written.callee);
  return null;
};

const calleeRootNameOf = (callee: ESTree.Expression): string | null => {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type !== "MemberExpression" || callee.object.type !== "Identifier") return null;
  return callee.object.name;
};

const isDerivedFromFixture = (
  expression: ESTree.Expression,
  fixtureLocalNames: ReadonlySet<string>,
): boolean => {
  if (expression.type === "Identifier") return fixtureLocalNames.has(expression.name);
  if (expression.type !== "CallExpression") return false;
  const { callee } = expression;
  if (callee.type !== "MemberExpression") return false;
  return isDerivedFromFixture(callee.object, fixtureLocalNames);
};

const snapshotSubjectOf = (node: ESTree.CallExpression): ESTree.Expression | null => {
  const { callee } = node;
  if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return null;
  if (!SNAPSHOT_MATCHER_NAMES.has(callee.property.name)) return null;
  if (callee.object.type !== "CallExpression") return null;
  if (!isAssertionEntryReference(callee.object.callee)) return null;
  const [subject] = callee.object.arguments;
  if (subject === undefined || subject.type === "SpreadElement") return null;
  return subject;
};

const declaredDependencyNames = (declaration: FixtureDeclaration): readonly string[] => {
  if (declaration.factory === null) return [];
  return (fixtureDependenciesOf(declaration.factory) ?? []).map((dependency) => dependency.name);
};

const streamsReachedBy = (
  reached: ReadonlyMap<string, ReadonlySet<string>>,
  dependencies: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, ReadonlySet<string>> => {
  const grown = new Map(
    [...dependencies].map(([fixtureName, declared]): readonly [string, ReadonlySet<string>] => [
      fixtureName,
      new Set(
        declared.flatMap((dependency) => [
          ...((CAPTURED_STREAM_NAMES as readonly string[]).includes(dependency)
            ? [dependency]
            : []),
          ...(reached.get(dependency) ?? []),
        ]),
      ),
    ]),
  );

  const settled = [...grown].every(
    ([fixtureName, streams]) => streams.size === (reached.get(fixtureName)?.size ?? -1),
  );
  return settled ? grown : streamsReachedBy(grown, dependencies);
};

const streamsBehindNames = (program: ESTree.Program): ReadonlyMap<string, ReadonlySet<string>> => {
  const declarations = nodesOfType(program, "CallExpression").flatMap((call) =>
    fixtureDeclarationsOf(call),
  );
  const dependencies = new Map(
    declarations.map((declaration): readonly [string, readonly string[]] => [
      declaration.name,
      declaredDependencyNames(declaration),
    ]),
  );
  return streamsReachedBy(new Map(), dependencies);
};

const fixtureLocalNamesIn = (program: ESTree.Program): ReadonlySet<string> => {
  const known = new Set(
    nodesOfType(program, "ImportDeclaration").flatMap(
      (node) => standardIoFixtureLocalNameOf(node) ?? [],
    ),
  );
  const declarators = nodesOfType(program, "VariableDeclarator");
  const grown = (reached: ReadonlySet<string>): ReadonlySet<string> => {
    const gained = new Set([
      ...reached,
      ...declarators.flatMap((declarator) =>
        declarator.id.type === "Identifier" &&
        declarator.init !== null &&
        isDerivedFromFixture(declarator.init, reached)
          ? [declarator.id.name]
          : [],
      ),
    ]);
    return gained.size === reached.size ? reached : grown(gained);
  };
  return grown(known);
};

export const requireStandardIoSnapshot = createDontReviewItRule({
  name: "require-standard-io-snapshot--pin-both-streams",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a spec that derives tests from `standardIoTest` to pin both captured streams with a snapshot, so every change to what the command prints surfaces as a diff",
      relatedGuidelines: [],
    },
    messages: {
      missingSnapshot:
        "A spec that derives tests from `standardIoTest` must not leave `{{name}}` unpinned. Add a test taking `{{name}}` as its subject and pinning it with `toMatchInlineSnapshot()`, or pin a fixture that reads from it.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      "Program:exit"(program: ESTree.Program) {
        const fixtureLocalNames = fixtureLocalNamesIn(program);
        const [firstFixtureCall] = nodesOfType(program, "CallExpression").filter((call) => {
          const rootName = calleeRootNameOf(call.callee);
          return rootName !== null && fixtureLocalNames.has(rootName);
        });
        if (firstFixtureCall === undefined) return;

        const behind = streamsBehindNames(program);
        const pinnedNames = nodesOfType(program, "CallExpression").flatMap((call) => {
          const subject = snapshotSubjectOf(call);
          return subject === null ? [] : (rootIdentifierName(subject) ?? []);
        });
        const pinnedStreams = new Set(
          pinnedNames.flatMap((pinnedName) => [
            ...((CAPTURED_STREAM_NAMES as readonly string[]).includes(pinnedName)
              ? [pinnedName]
              : []),
            ...(behind.get(pinnedName) ?? []),
          ]),
        );

        for (const streamName of CAPTURED_STREAM_NAMES) {
          if (pinnedStreams.has(streamName)) continue;
          inspection.report({
            node: firstFixtureCall,
            messageId: "missingSnapshot",
            data: { name: streamName },
          });
        }
      },
    };
  },
});
