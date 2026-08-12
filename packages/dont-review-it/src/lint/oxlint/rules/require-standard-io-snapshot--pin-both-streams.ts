import { createDontReviewItRule } from "../../../create-rule.ts";
import { standardIoFixtureLocalNameOf } from "../lib/standard-io-fixture.ts";

import type { ESTree } from "@oxlint/plugins";

const CAPTURED_STREAM_NAMES = ["stdout", "stderr"] as const;

const SNAPSHOT_MATCHER_NAMES = new Set(["toMatchInlineSnapshot", "toMatchSnapshot"]);

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
  if (callee.object.callee.type !== "Identifier" || callee.object.callee.name !== "expect") {
    return null;
  }
  const [subject] = callee.object.arguments;
  if (subject === undefined || subject.type === "SpreadElement") return null;
  return subject;
};

const capturedTextStreamOf = (subject: ESTree.Expression): string | null => {
  if (subject.type !== "MemberExpression" || subject.object.type !== "Identifier") return null;
  if (subject.property.type !== "Identifier" || subject.property.name !== "text") return null;
  const streamName = subject.object.name;
  return (CAPTURED_STREAM_NAMES as readonly string[]).includes(streamName) ? streamName : null;
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
        "A spec that derives tests from `standardIoTest` must not leave `{{name}}` unpinned. Add a test asserting `expect({{name}}.text).toMatchInlineSnapshot()`.",
    },
    schema: [],
  },
  create(inspection) {
    const fixtureLocalNames = new Set<string>();
    const fixtureCalls = new Set<ESTree.CallExpression>();
    const snapshottedStreams = new Set<string>();

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        const localName = standardIoFixtureLocalNameOf(node);
        if (localName !== null) fixtureLocalNames.add(localName);
      },
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        if (node.id.type !== "Identifier" || node.init === null) return;
        if (isDerivedFromFixture(node.init, fixtureLocalNames)) {
          fixtureLocalNames.add(node.id.name);
        }
      },
      CallExpression(node: ESTree.CallExpression) {
        const rootName = calleeRootNameOf(node.callee);
        if (rootName !== null && fixtureLocalNames.has(rootName)) fixtureCalls.add(node);
        const subject = snapshotSubjectOf(node);
        if (subject === null) return;
        const streamName = capturedTextStreamOf(subject);
        if (streamName !== null) snapshottedStreams.add(streamName);
      },
      "Program:exit"() {
        const [firstFixtureCall] = fixtureCalls;
        if (firstFixtureCall === undefined) return;
        for (const spelled of CAPTURED_STREAM_NAMES) {
          if (snapshottedStreams.has(spelled)) continue;
          inspection.report({
            node: firstFixtureCall,
            messageId: "missingSnapshot",
            data: { name: spelled },
          });
        }
      },
    };
  },
});
