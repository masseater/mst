import { parseSync, type Comment, type ParseResult } from "oxc-parser";

import {
  CANONICAL_VALUES_TAG,
  containsCanonicalValuesAnnotation,
  findRetiredAnnotationTags,
  parseCanonicalValuesAnnotation,
  RETIRED_ANNOTATION_TAGS,
} from "./annotation.ts";

export type CanonicalValuesDeclaration = {
  readonly binding: string;
  readonly bindingStart: number;
  readonly conceptId: string;
  readonly line: number;
  readonly annotationStart: number;
  readonly declarationStart: number;
  readonly declarationEnd: number;
};

/** @canonical-values canonical-values.invalid-declaration-reason */
export const INVALID_CANONICAL_DECLARATION_REASONS = {
  adjacentDeclarationRequired: "adjacent-declaration-required",
  identifierBindingRequired: "identifier-binding-required",
  jsdocRequired: "jsdoc-required",
  moduleScopeRequired: "module-scope-required",
  runtimeInitializerRequired: "runtime-initializer-required",
  singleAnnotationRequired: "single-annotation-required",
  singleBindingRequired: "single-binding-required",
  variableStatementRequired: "variable-statement-required",
} as const;

export type InvalidCanonicalDeclarationReason =
  (typeof INVALID_CANONICAL_DECLARATION_REASONS)[keyof typeof INVALID_CANONICAL_DECLARATION_REASONS];

export type CanonicalValuesTextProblem =
  | {
      readonly kind: "invalid-declaration";
      readonly line: number;
      readonly conceptId: string | null;
      readonly reason: InvalidCanonicalDeclarationReason;
    }
  | { readonly kind: "out-of-scope-declaration"; readonly line: number; readonly conceptId: string }
  | { readonly kind: "retired-annotation-tag"; readonly line: number; readonly tag: string }
  | { readonly kind: "canonical-rule-suppression"; readonly line: number }
  | { readonly kind: "unparsable-annotation"; readonly line: number }
  | { readonly kind: "unparsable-source"; readonly line: number }
  | {
      readonly kind: "vocabulary-without-values";
      readonly line: number;
      readonly conceptId: string;
    };

export type CanonicalValuesTextScan = {
  readonly declarations: readonly CanonicalValuesDeclaration[];
  readonly problems: readonly CanonicalValuesTextProblem[];
};

type NodeFields = Readonly<Record<string, unknown>> & {
  readonly end: number;
  readonly start: number;
  readonly type: string;
};

type VariableDeclarationFields = NodeFields & {
  readonly declare?: boolean;
  readonly declarations: readonly unknown[];
};

type ValidationResult<Value> =
  | { readonly value: Value }
  | { readonly problem: CanonicalValuesTextScan };

const COMMENT_BODY_OFFSET = 2;

const DEFAULT_SOURCE_NAME = "source.ts";

const JSDOC_COMMENT_VALUE_PREFIX = "*";

const CANONICAL_RULE_BASENAMES: ReadonlySet<string> = new Set([
  "no-local-finite-value-set--use-or-register-canonical-values",
  "no-strict-canonical-literal-use--use-canonical-import",
]);

const LINT_DISABLE_DIRECTIVE =
  /\b(?:eslint|oxlint)-disable(?:-line|-next-line)?(?:[ \t]+([^\n]*))?/gu;

const lineAt = (text: string, offset: number): number => text.slice(0, offset).split("\n").length;

const normalizedCommentLines = (commentValue: string): readonly string[] =>
  commentValue.split("\n").map((line) => line.replace(/^\s*\*?\s?/u, "").trim());

const canonicalAnnotationLines = (commentValue: string): readonly string[] =>
  normalizedCommentLines(commentValue).filter((line) => line.includes(CANONICAL_VALUES_TAG));

const withoutRetiredTags = (commentValue: string): string =>
  RETIRED_ANNOTATION_TAGS.reduce((remaining, tag) => remaining.replaceAll(tag, ""), commentValue);

const isNodeFields = (value: unknown): value is NodeFields =>
  value !== null &&
  typeof value === "object" &&
  "type" in value &&
  typeof value.type === "string" &&
  "start" in value &&
  typeof value.start === "number" &&
  "end" in value &&
  typeof value.end === "number";

const variableDeclarationIn = (statement: unknown): VariableDeclarationFields | null => {
  if (!isNodeFields(statement)) return null;
  if (statement.type === "VariableDeclaration" && "declarations" in statement) {
    return statement as VariableDeclarationFields;
  }
  if (statement.type !== "ExportNamedDeclaration" || !("declaration" in statement)) return null;
  const { declaration } = statement;
  if (!isNodeFields(declaration) || declaration.type !== "VariableDeclaration") return null;
  if (!("declarations" in declaration)) return null;
  return declaration as VariableDeclarationFields;
};

const invalidDeclaration = (input: {
  readonly conceptId: string | null;
  readonly line: number;
  readonly reason: InvalidCanonicalDeclarationReason;
}): CanonicalValuesTextScan => ({
  declarations: [],
  problems: [
    {
      kind: "invalid-declaration",
      line: input.line,
      conceptId: input.conceptId,
      reason: input.reason,
    },
  ],
});

const annotationConceptId = (input: {
  readonly comment: Comment;
  readonly line: number;
}): ValidationResult<string> => {
  const annotation = parseCanonicalValuesAnnotation(input.comment.value);
  if (annotation === null)
    return {
      problem: {
        declarations: [],
        problems: [{ kind: "unparsable-annotation", line: input.line }],
      },
    };
  if (canonicalAnnotationLines(input.comment.value).length !== 1) {
    return {
      problem: invalidDeclaration({
        line: input.line,
        conceptId: annotation.conceptId,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.singleAnnotationRequired,
      }),
    };
  }
  if (
    input.comment.type !== "Block" ||
    !input.comment.value.startsWith(JSDOC_COMMENT_VALUE_PREFIX)
  ) {
    return {
      problem: invalidDeclaration({
        line: input.line,
        conceptId: annotation.conceptId,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.jsdocRequired,
      }),
    };
  }
  return { value: annotation.conceptId };
};

const ownerStatement = (input: {
  readonly comment: Comment;
  readonly conceptId: string;
  readonly line: number;
  readonly program: ParseResult["program"];
  readonly sourceText: string;
}): ValidationResult<ParseResult["program"]["body"][number]> => {
  const nested = input.program.body.some(
    (statement) => statement.start < input.comment.start && input.comment.end <= statement.end,
  );
  if (nested) {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.moduleScopeRequired,
      }),
    };
  }

  const owner = input.program.body.find((statement) => statement.start >= input.comment.end);
  if (owner === undefined) {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.variableStatementRequired,
      }),
    };
  }
  if (input.sourceText.slice(input.comment.end, owner.start).trim() !== "") {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.adjacentDeclarationRequired,
      }),
    };
  }
  return { value: owner };
};

const runtimeVariable = (input: {
  readonly conceptId: string;
  readonly line: number;
  readonly owner: ParseResult["program"]["body"][number];
}): ValidationResult<VariableDeclarationFields> => {
  const variable = variableDeclarationIn(input.owner);
  if (variable === null) {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.variableStatementRequired,
      }),
    };
  }
  if (variable.declare === true) {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.runtimeInitializerRequired,
      }),
    };
  }
  if (variable.declarations.length !== 1) {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.singleBindingRequired,
      }),
    };
  }
  return { value: variable };
};

const identifierBinding = (input: {
  readonly conceptId: string;
  readonly line: number;
  readonly variable: VariableDeclarationFields;
}): ValidationResult<{ readonly binding: string; readonly bindingStart: number }> => {
  const [declarator] = input.variable.declarations;
  if (!isNodeFields(declarator) || !("id" in declarator)) {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.identifierBindingRequired,
      }),
    };
  }
  if (!("init" in declarator) || declarator.init === null) {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.runtimeInitializerRequired,
      }),
    };
  }
  const { id } = declarator;
  if (
    !isNodeFields(id) ||
    id.type !== "Identifier" ||
    !("name" in id) ||
    typeof id.name !== "string"
  ) {
    return {
      problem: invalidDeclaration({
        ...input,
        reason: INVALID_CANONICAL_DECLARATION_REASONS.identifierBindingRequired,
      }),
    };
  }
  return { value: { binding: id.name, bindingStart: id.start } };
};

const declarationFor = (input: {
  readonly program: ParseResult["program"];
  readonly sourceText: string;
  readonly comment: Comment;
  readonly line: number;
}): CanonicalValuesTextScan => {
  const annotation = annotationConceptId(input);
  if ("problem" in annotation) return annotation.problem;
  const owner = ownerStatement({ ...input, conceptId: annotation.value });
  if ("problem" in owner) return owner.problem;
  const variable = runtimeVariable({
    conceptId: annotation.value,
    line: input.line,
    owner: owner.value,
  });
  if ("problem" in variable) return variable.problem;
  const binding = identifierBinding({
    conceptId: annotation.value,
    line: input.line,
    variable: variable.value,
  });
  if ("problem" in binding) return binding.problem;

  return {
    declarations: [
      {
        binding: binding.value.binding,
        bindingStart: binding.value.bindingStart,
        conceptId: annotation.value,
        line: input.line,
        annotationStart: input.comment.start,
        declarationStart: owner.value.start,
        declarationEnd: owner.value.end,
      },
    ],
    problems: [],
  };
};

const retiredProblemsIn = (
  sourceText: string,
  comment: Comment,
): readonly CanonicalValuesTextProblem[] =>
  findRetiredAnnotationTags(comment.value).map((tag) => ({
    kind: "retired-annotation-tag",
    line: lineAt(sourceText, comment.start + COMMENT_BODY_OFFSET + comment.value.indexOf(tag)),
    tag,
  }));

const canonicalRuleSuppressionProblemsIn = (
  sourceText: string,
  comment: Comment,
): readonly CanonicalValuesTextProblem[] =>
  [...comment.value.matchAll(LINT_DISABLE_DIRECTIVE)].flatMap((match) => {
    const directiveParameters = match[1] ?? "";
    const reason = /(?:^|[ \t]+)--(?:[ \t]+|$)/u.exec(directiveParameters);
    const targets = directiveParameters
      .slice(0, reason?.index ?? directiveParameters.length)
      .split(/[\s,]+/u)
      .filter((target) => target !== "");
    const targetsCanonicalRule = targets.some((target) => {
      const diagnosticRule = /^[^()]+\(([^()]+)\)$/u.exec(target)?.[1] ?? target;
      return CANONICAL_RULE_BASENAMES.has(diagnosticRule.split("/").at(-1) ?? diagnosticRule);
    });
    if (targets.length !== 0 && !targets.includes("all") && !targetsCanonicalRule) {
      return [];
    }
    return [
      {
        kind: "canonical-rule-suppression" as const,
        line: lineAt(sourceText, comment.start + COMMENT_BODY_OFFSET + match.index),
      },
    ];
  });

const scanComment = (
  {
    sourceText,
    program,
  }: { readonly sourceText: string; readonly program: ParseResult["program"] },
  comment: Comment,
): CanonicalValuesTextScan => {
  const retiredProblems = retiredProblemsIn(sourceText, comment);
  const suppressionProblems = canonicalRuleSuppressionProblemsIn(sourceText, comment);
  const remaining = withoutRetiredTags(comment.value);
  if (!containsCanonicalValuesAnnotation(remaining)) {
    return { declarations: [], problems: [...retiredProblems, ...suppressionProblems] };
  }
  if (retiredProblems.length > 0) {
    return { declarations: [], problems: [...retiredProblems, ...suppressionProblems] };
  }

  const declaration = declarationFor({
    program,
    sourceText,
    comment,
    line: lineAt(sourceText, comment.start),
  });
  return {
    declarations: declaration.declarations,
    problems: [...suppressionProblems, ...declaration.problems],
  };
};

export const scanCanonicalValuesText = (
  sourceText: string,
  sourceName: string = DEFAULT_SOURCE_NAME,
): CanonicalValuesTextScan => {
  const parsed = parseSync(sourceName, sourceText);
  if (parsed.errors.length > 0 && containsCanonicalValuesAnnotation(sourceText)) {
    return {
      declarations: [],
      problems: [
        {
          kind: "unparsable-source",
          line: lineAt(sourceText, sourceText.indexOf(CANONICAL_VALUES_TAG)),
        },
      ],
    };
  }
  const scans = parsed.comments.map((comment) =>
    scanComment({ sourceText, program: parsed.program }, comment),
  );

  return {
    declarations: scans.flatMap((scan) => scan.declarations),
    problems: scans.flatMap((scan) => scan.problems),
  };
};
