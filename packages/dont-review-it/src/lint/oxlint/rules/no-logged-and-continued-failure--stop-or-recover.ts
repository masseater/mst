import { createDontReviewItRule } from "../../../create-rule.ts";
import { staticMemberOf, type StaticMember } from "../lib/static-member.ts";

import type { ESTree } from "@oxlint/plugins";

const CONSOLE_OBJECT_NAME = "console";

const PROCESS_OBJECT_NAME = "process";

const PROCESS_STREAM_NAMES: ReadonlySet<string> = new Set(["stdout", "stderr"]);

const STREAM_WRITE_NAME = "write";

const PROCESS_EXIT_NAME = "exit";

const STOPPING_STATEMENT_TYPES: ReadonlySet<string> = new Set([
  "ReturnStatement",
  "ThrowStatement",
]);

const OWN_BODY_NODE_TYPES: ReadonlySet<string> = new Set([
  "ArrowFunctionExpression",
  "ClassDeclaration",
  "ClassExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "StaticBlock",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
]);

const identifierNameOf = (expression: ESTree.Expression): string | null =>
  expression.type === "Identifier" ? expression.name : null;

const isStreamWrite = (member: StaticMember): boolean => {
  if (member.name !== STREAM_WRITE_NAME) return false;
  const stream = staticMemberOf(member.object);
  if (stream === null) return false;
  if (identifierNameOf(stream.object) !== PROCESS_OBJECT_NAME) return false;
  return PROCESS_STREAM_NAMES.has(stream.name);
};

const isOutputSinkCall = (node: ESTree.CallExpression): boolean => {
  const member = staticMemberOf(node.callee);
  if (member === null) return false;
  if (identifierNameOf(member.object) === CONSOLE_OBJECT_NAME) return true;
  return isStreamWrite(member);
};

const isProcessExitStatement = (statement: ESTree.Statement): boolean => {
  if (statement.type !== "ExpressionStatement") return false;
  const called = statement.expression;
  if (called.type !== "CallExpression") return false;
  const member = staticMemberOf(called.callee);
  if (member === null || member.name !== PROCESS_EXIT_NAME) return false;
  return identifierNameOf(member.object) === PROCESS_OBJECT_NAME;
};

const stopsUnconditionally = (clause: ESTree.CatchClause): boolean =>
  clause.body.body.some(
    (statement) =>
      STOPPING_STATEMENT_TYPES.has(statement.type) || isProcessExitStatement(statement),
  );

const enclosingCatchClause = (node: ESTree.Node): ESTree.CatchClause | null => {
  const { parent } = node;
  if (parent === null) return null;
  if (parent.type === "CatchClause") return parent;
  return OWN_BODY_NODE_TYPES.has(parent.type) ? null : enclosingCatchClause(parent);
};

export const noLoggedAndContinuedFailure = createDontReviewItRule({
  name: "no-logged-and-continued-failure--stop-or-recover",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow writing a caught failure to an output stream inside a catch clause that neither stops nor returns, so a failure that was caught either ends the work or produces a value the caller can use",
      relatedGuidelines: [],
    },
    messages: {
      loggedAndContinuedFailure:
        "A catch clause must not write the failure to an output stream and then let the surrounding code carry on. Choose one of the two endings the caller can act on. Stop: rethrow the failure, or throw one that names this layer's part in it. Recover: return the value the caller should use in place of the missing one, at the same statement level as this write.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (!isOutputSinkCall(node)) return;

        const clause = enclosingCatchClause(node);
        if (clause === null) return;
        if (stopsUnconditionally(clause)) return;

        inspection.report({ node, messageId: "loggedAndContinuedFailure" });
      },
    };
  },
});
