import { isPlainObject } from "es-toolkit";
import { parseSync } from "oxc-parser";

import type { RepositoryProblem } from "@mst/repository-checks";

export type SpecificationSubject = {
  readonly subject: string;
  readonly claims: readonly string[];
};

type AstFields = {
  readonly type?: unknown;
  readonly [field: string]: unknown;
};

type CallFields = AstFields & {
  readonly type: "CallExpression";
  readonly start: number;
  readonly callee: AstFields;
  readonly arguments: readonly unknown[];
};

type ProblemAt = { readonly offset: number; readonly message: string };

const RUNNER_NAMES: ReadonlySet<string> = new Set(["describe", "it", "test"]);

const UNPARSABLE_SOURCE =
  "A specification test must parse as TypeScript, because its claims are read without running it. Fix the syntax so the parser accepts the file.";

const COMPUTED_NAME =
  "A subject or claim must not carry a computed name, because the specification list is assembled without running the tests. Write the first argument as a plain string literal.";

const TEST_FUNCTION_CLAIM =
  "A claim must not be declared with the test function, because a claim reads as a sentence about the subject and it keeps that form. Replace test with it.";

const NARROWED_RUNNER =
  "A describe or it must not be narrowed through a member such as each, skip or only, because a claim that runs conditionally or in variants cannot be read as one plain sentence. Write each claim as its own it with a literal name.";

const SUBJECT_WITHOUT_CLAIMS =
  "A subject must not stand without claims, because a heading with no sentences under it promises nothing. Give the describe at least one it, or delete it.";

const FILE_WITHOUT_SUBJECTS =
  "A specification test file must not go without a top-level describe, because the generated list groups claims under subjects. Declare a describe whose name is the feature the file specifies.";

const isAstNode = (candidate: unknown): candidate is AstFields => isPlainObject(candidate);

const isParenthesized = (node: AstFields): node is AstFields & { readonly expression: AstFields } =>
  node.type === "ParenthesizedExpression";

const isExpressionStatement = (
  node: AstFields,
): node is AstFields & { readonly expression: AstFields } => node.type === "ExpressionStatement";

const isCallNode = (node: AstFields): node is CallFields => node.type === "CallExpression";

const isIdentifierNode = (node: AstFields): node is AstFields & { readonly name: string } =>
  node.type === "Identifier";

const isMemberNode = (node: AstFields): node is AstFields & { readonly object: AstFields } =>
  node.type === "MemberExpression";

const isBlockNode = (
  node: AstFields,
): node is AstFields & { readonly body: readonly AstFields[] } => node.type === "BlockStatement";

const isLiteralNode = (node: AstFields): node is AstFields & { readonly value: unknown } =>
  node.type === "Literal";

const withoutParentheses = (node: AstFields): AstFields =>
  isParenthesized(node) ? withoutParentheses(node.expression) : node;

const nodeOrNull = (candidate: unknown): AstFields | null =>
  isAstNode(candidate) ? withoutParentheses(candidate) : null;

const callWithin = (statement: AstFields): CallFields | null => {
  if (!isExpressionStatement(statement)) return null;
  const expression = withoutParentheses(statement.expression);
  return isCallNode(expression) ? expression : null;
};

const identifierNameOf = (callee: AstFields): string | null => {
  const node = withoutParentheses(callee);
  return isIdentifierNode(node) ? node.name : null;
};

const rootRunnerNameOf = (callee: AstFields): string | null => {
  const node = withoutParentheses(callee);
  if (isMemberNode(node)) return rootRunnerNameOf(node.object);
  if (isCallNode(node)) return rootRunnerNameOf(node.callee);
  const spelled = isIdentifierNode(node) ? node.name : null;
  return spelled !== null && RUNNER_NAMES.has(spelled) ? spelled : null;
};

const literalTextOf = (argument: AstFields | null): string | null => {
  if (argument === null || !isLiteralNode(argument)) return null;
  return typeof argument.value === "string" ? argument.value : null;
};

const at = (call: CallFields, complaint: string): ProblemAt => ({
  offset: call.start,
  message: complaint,
});

const bodyStatementsOf = (call: CallFields): readonly AstFields[] => {
  const handedCallback = nodeOrNull(call.arguments[1]);
  const callbackBody = handedCallback === null ? null : nodeOrNull(handedCallback.body);
  if (callbackBody === null) return [];
  if (isBlockNode(callbackBody)) return callbackBody.body;
  return [{ type: "ExpressionStatement", expression: callbackBody }];
};

const claimIssueOf = (input: {
  readonly call: CallFields;
  readonly runner: string;
}): string | null => {
  if (identifierNameOf(input.call.callee) === null) return NARROWED_RUNNER;
  return input.runner === "test" ? TEST_FUNCTION_CLAIM : null;
};

const claimReadOf = (
  statement: AstFields,
): { readonly claim: string | null; readonly problems: readonly ProblemAt[] } => {
  const call = callWithin(statement);
  const runner = call === null ? null : rootRunnerNameOf(call.callee);
  if (call === null || runner === null) return { claim: null, problems: [] };

  const issue = claimIssueOf({ call, runner });
  if (issue !== null) return { claim: null, problems: [at(call, issue)] };
  if (runner !== "it") return { claim: null, problems: [] };

  const claim = literalTextOf(nodeOrNull(call.arguments[0]));
  if (claim === null) return { claim: null, problems: [at(call, COMPUTED_NAME)] };
  return { claim, problems: [] };
};

const claimsReadOf = (
  call: CallFields,
): { readonly claims: readonly string[]; readonly problems: readonly ProblemAt[] } => {
  const read = bodyStatementsOf(call).map(claimReadOf);
  return {
    claims: read.flatMap((readEntry) => (readEntry.claim === null ? [] : [readEntry.claim])),
    problems: read.flatMap((readEntry) => readEntry.problems),
  };
};

const subjectHeaderOf = (
  call: CallFields,
):
  | { readonly kind: "ok"; readonly subject: string }
  | { readonly kind: "issue"; readonly issue: ProblemAt } => {
  if (identifierNameOf(call.callee) === null) {
    return { kind: "issue", issue: at(call, NARROWED_RUNNER) };
  }
  const subject = literalTextOf(nodeOrNull(call.arguments[0]));
  if (subject === null) return { kind: "issue", issue: at(call, COMPUTED_NAME) };
  return { kind: "ok", subject };
};

const subjectReadOf = (
  statement: AstFields,
): {
  readonly subject: SpecificationSubject | null;
  readonly problems: readonly ProblemAt[];
} => {
  const call = callWithin(statement);
  if (call === null || rootRunnerNameOf(call.callee) !== "describe") {
    return { subject: null, problems: [] };
  }
  const header = subjectHeaderOf(call);
  if (header.kind === "issue") return { subject: null, problems: [header.issue] };

  const { claims, problems } = claimsReadOf(call);
  if (claims.length === 0 && problems.length === 0) {
    return { subject: null, problems: [at(call, SUBJECT_WITHOUT_CLAIMS)] };
  }
  return {
    subject: claims.length === 0 ? null : { subject: header.subject, claims },
    problems,
  };
};

const readStatements = (input: {
  readonly file: string;
  readonly source: string;
  readonly statements: readonly unknown[];
}): {
  readonly subjects: readonly SpecificationSubject[];
  readonly problems: readonly RepositoryProblem[];
} => {
  const read = input.statements.filter(isAstNode).map(subjectReadOf);
  const subjects = read.flatMap((readEntry) =>
    readEntry.subject === null ? [] : [readEntry.subject],
  );
  const problems = read
    .flatMap((readEntry) => readEntry.problems)
    .map(({ offset, message }) => ({
      file: input.file,
      line: input.source.slice(0, offset).split("\n").length,
      message,
    }));
  if (subjects.length === 0 && problems.length === 0) {
    return {
      subjects,
      problems: [{ file: input.file, line: null, message: FILE_WITHOUT_SUBJECTS }],
    };
  }
  return { subjects, problems };
};

export const extractClaims = (input: {
  readonly file: string;
  readonly source: string;
}): {
  readonly subjects: readonly SpecificationSubject[];
  readonly problems: readonly RepositoryProblem[];
} => {
  const { file, source } = input;
  const parsedProgram = parseSync(file, source);
  if (parsedProgram.errors.length > 0) {
    return { subjects: [], problems: [{ file, line: null, message: UNPARSABLE_SOURCE }] };
  }
  return readStatements({ file, source, statements: parsedProgram.program.body });
};
