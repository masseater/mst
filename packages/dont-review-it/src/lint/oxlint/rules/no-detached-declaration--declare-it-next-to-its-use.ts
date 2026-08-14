import { createDontReviewItRule } from "../../../create-rule.ts";
import { detachedDeclarations, type StatementPlacement } from "../lib/detached-declarations.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";
import { REFERENCES_A_SHARED_TYPE } from "../lib/shared-type-references.ts";
import { carriesStartupWork } from "../lib/startup-work.ts";

import type { ESTree, FixFn, Range, SourceCode } from "@oxlint/plugins";

type TypeReference = {
  readonly name: string;
  readonly position: number;
};

const typeReferencesIn = (program: ESTree.Program): readonly TypeReference[] => [
  ...nodesOfType(program, "TSTypeReference").flatMap((node) =>
    node.typeName.type === "Identifier"
      ? [{ name: node.typeName.name, position: node.typeName.start }]
      : [],
  ),
  ...nodesOfType(program, "TSInterfaceHeritage").flatMap((node) =>
    node.expression.type === "Identifier"
      ? [{ name: node.expression.name, position: node.expression.start }]
      : [],
  ),
  ...nodesOfType(program, "TSClassImplements").flatMap((node) =>
    node.expression.type === "Identifier"
      ? [{ name: node.expression.name, position: node.expression.start }]
      : [],
  ),
];

const isTypeDeclaration = (declaration: ESTree.Node): boolean =>
  declaration.type === "TSTypeAliasDeclaration" || declaration.type === "TSInterfaceDeclaration";

const isValueDeclaration = (declaration: ESTree.Node): boolean =>
  declaration.type === "VariableDeclaration" ||
  declaration.type === "FunctionDeclaration" ||
  declaration.type === "ClassDeclaration" ||
  declaration.type === "TSEnumDeclaration";

const declaredNamesOf = (declaration: ESTree.Node): readonly string[] => {
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((declared) =>
      declared.id.type === "Identifier" ? [declared.id.name] : [],
    );
  }
  if (
    declaration.type === "TSTypeAliasDeclaration" ||
    declaration.type === "TSInterfaceDeclaration" ||
    declaration.type === "TSEnumDeclaration"
  ) {
    return [declaration.id.name];
  }
  if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") {
    return declaration.id === null ? [] : [declaration.id.name];
  }
  return [];
};

type Reading = {
  readonly sourceCode: SourceCode;
  readonly typeReferences: readonly TypeReference[];
  readonly atModuleLevel: boolean;
};

const typeReferenceCount = (reading: Reading, spelled: string): number =>
  reading.typeReferences.filter((reference) => reference.name === spelled).length;

const initializersOf = (declaration: ESTree.Node): readonly ESTree.Node[] =>
  declaration.type === "VariableDeclaration"
    ? declaration.declarations.flatMap((declared) =>
        declared.init === null ? [] : [declared.init],
      )
    : [];

const declaredNode = (statement: ESTree.Node): ESTree.Node => {
  if (statement.type === "ExportNamedDeclaration" && statement.declaration !== null) {
    return statement.declaration;
  }
  return statement.type === "ExportDefaultDeclaration" ? statement.declaration : statement;
};

const carriesNoStartupWork = (statement: ESTree.Node): boolean =>
  initializersOf(declaredNode(statement)).every((initializer) => !carriesStartupWork(initializer));

const isReportable = (statement: ESTree.Node, reading: Reading): boolean => {
  const declaration = declaredNode(statement);
  if (isValueDeclaration(declaration)) {
    return declaredNamesOf(declaration).length > 0 && carriesNoStartupWork(statement);
  }
  if (!isTypeDeclaration(declaration)) return false;
  if (statement.type === "ExportNamedDeclaration" || !reading.atModuleLevel) return true;
  return declaredNamesOf(declaration).every(
    (spelled) => typeReferenceCount(reading, spelled) >= REFERENCES_A_SHARED_TYPE,
  );
};

const referencePositionsOf = (statement: ESTree.Node, reading: Reading): readonly number[] => {
  const declaration = declaredNode(statement);
  const declaredSpellings = declaredNamesOf(declaration);
  const fromTypes = isTypeDeclaration(declaration)
    ? reading.typeReferences
        .filter((reference) => declaredSpellings.includes(reference.name))
        .map((reference) => reference.position)
    : [];
  const fromValues = reading.sourceCode
    .getDeclaredVariables(declaration)
    .flatMap((variable) => variable.references.map((reference) => reference.identifier.start));
  return [...fromTypes, ...fromValues];
};

const carriesEffect = (statement: ESTree.Node): boolean =>
  carriesStartupWork(declaredNode(statement)) ||
  nodesOfType(statement, "AssignmentExpression").length > 0 ||
  nodesOfType(statement, "UpdateExpression").length > 0;

const holdsPosition = (statement: ESTree.Node, position: number): boolean =>
  position >= statement.start && position < statement.end;

const indexesHolding = (
  statements: readonly ESTree.Node[],
  positions: readonly number[],
): readonly number[] =>
  statements.flatMap((statement, index) =>
    positions.some((position) => holdsPosition(statement, position)) ? [index] : [],
  );

const placementsOf = (
  statements: readonly ESTree.Node[],
  reading: Reading,
): readonly StatementPlacement<ESTree.Node>[] =>
  statements.map((statement, index) => ({
    held: statement,
    reportable: isReportable(statement, reading),
    carriesEffect: carriesEffect(statement),
    usedAt: indexesHolding(statements, referencePositionsOf(statement, reading)).filter(
      (found) => found !== index,
    ),
  }));

const declaringStatements = (statements: readonly ESTree.Node[]): readonly ESTree.Node[] =>
  statements.filter((statement) => statement.type !== "ImportDeclaration");

const movedRangeOf = (
  statement: ESTree.Node,
  sourceCode: SourceCode,
): readonly [number, number] => {
  const leading = sourceCode.getCommentsBefore(statement).at(0);
  return [leading === undefined ? statement.start : leading.start, statement.end];
};

const indentBefore = (sourceText: string, position: number): string => {
  const standing = sourceText.slice(sourceText.lastIndexOf("\n", position - 1) + 1, position);
  return standing.trim() === "" ? standing : "";
};

const fixThatMoves = (
  sourceCode: SourceCode,
  moving: { readonly statement: ESTree.Node; readonly target: ESTree.Node },
): FixFn | undefined => {
  if (moving.target.start < moving.statement.start) return undefined;
  const sourceText = sourceCode.getText();
  const [start, end] = movedRangeOf(moving.statement, sourceCode);
  const [targetStart] = movedRangeOf(moving.target, sourceCode);
  const taken: Range = [
    start - indentBefore(sourceText, start).length,
    sourceText.charAt(end) === "\n" ? end + 1 : end,
  ];
  const indent = indentBefore(sourceText, targetStart);
  return (fixer) => [
    fixer.removeRange(taken),
    fixer.insertTextBeforeRange(
      [targetStart, targetStart],
      `${sourceText.slice(start, end)}${indent === "" ? "\n\n" : "\n"}${indent}`,
    ),
  ];
};

const statementListsIn = (program: ESTree.Program): readonly (readonly ESTree.Node[])[] => [
  program.body,
  ...nodesOfType(program, "BlockStatement").map((block) => block.body),
];

export const noDetachedDeclaration = createDontReviewItRule({
  name: "no-detached-declaration--declare-it-next-to-its-use",
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Disallow a declaration that stands apart from the statement that uses it, so a reader reaches the shape of a name without leaving the line that names it",
      relatedGuidelines: [],
    },
    messages: {
      detachedDeclaration:
        "A declaration must not stand apart from the statement that uses it. Move `{{name}}` directly in front of the statement on line {{line}}.",
    },
    schema: [],
  },
  create(inspection) {
    if (isOutOfScopeSource(inspection.filename)) return {};

    return {
      "Program:exit"(program: ESTree.Program) {
        const typeReferences = typeReferencesIn(program);
        for (const [listIndex, statementList] of statementListsIn(program).entries()) {
          const statements = declaringStatements(statementList);
          const reading = {
            sourceCode: inspection.sourceCode,
            typeReferences,
            atModuleLevel: listIndex === 0,
          };
          for (const found of detachedDeclarations(placementsOf(statements, reading))) {
            inspection.report({
              node: found.held,
              messageId: "detachedDeclaration",
              data: {
                name: declaredNamesOf(declaredNode(found.held)).join(", "),
                line: String(found.firstUse.loc.start.line),
              },
              fix: fixThatMoves(inspection.sourceCode, {
                statement: found.held,
                target: found.firstUse,
              }),
            });
          }
        }
      },
    };
  },
});
