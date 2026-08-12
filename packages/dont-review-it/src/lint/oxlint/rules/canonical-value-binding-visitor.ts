import type { ESTree, Visitor } from "@oxlint/plugins";
import type { CanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";

export type CanonicalValueBindingVisitorHooks = {
  readonly afterAssignment?: (node: ESTree.AssignmentExpression) => void;
  readonly afterBinary?: (node: ESTree.BinaryExpression) => void;
  readonly afterCall?: (node: ESTree.CallExpression) => void;
  readonly afterClassDeclaration?: (node: ESTree.Class) => void;
  readonly afterNew?: (node: ESTree.NewExpression) => void;
  readonly afterMember?: (node: ESTree.MemberExpression) => void;
  readonly afterTemplate?: (node: ESTree.TemplateLiteral) => void;
  readonly afterUnary?: (node: ESTree.UnaryExpression) => void;
  readonly afterUpdate?: (node: ESTree.UpdateExpression) => void;
  readonly programExit?: (node: ESTree.Program) => void;
};

export const createCanonicalValueBindingVisitor = (
  bindingIndex: CanonicalValueBindingIndex,
  hooks: CanonicalValueBindingVisitorHooks = {},
): Visitor => ({
  AssignmentExpression(node: ESTree.AssignmentExpression) {
    bindingIndex.recordAssignment(node);
    hooks.afterAssignment?.(node);
  },
  AssignmentPattern: bindingIndex.recordAssignmentPattern,
  BinaryExpression(node: ESTree.BinaryExpression) {
    bindingIndex.recordBinaryExpression(node);
    hooks.afterBinary?.(node);
  },
  CallExpression(node: ESTree.CallExpression) {
    bindingIndex.recordCallExpression(node);
    hooks.afterCall?.(node);
  },
  ClassDeclaration(node: ESTree.Class) {
    bindingIndex.recordClassDeclaration(node);
    hooks.afterClassDeclaration?.(node);
  },
  ClassExpression: bindingIndex.recordClassExpression,
  Decorator: bindingIndex.recordDecorator,
  ExportDefaultDeclaration: bindingIndex.recordExportDefaultDeclaration,
  ExportNamedDeclaration: bindingIndex.recordExportNamedDeclaration,
  ForInStatement: bindingIndex.recordForInStatement,
  ForOfStatement: bindingIndex.recordForOfStatement,
  MemberExpression(node: ESTree.MemberExpression) {
    bindingIndex.recordMemberExpression(node);
    hooks.afterMember?.(node);
  },
  NewExpression(node: ESTree.NewExpression) {
    bindingIndex.recordNewExpression(node);
    hooks.afterNew?.(node);
  },
  "Program:exit"(node: ESTree.Program) {
    bindingIndex.finalize();
    hooks.programExit?.(node);
  },
  SpreadElement: bindingIndex.recordSpreadElement,
  ReturnStatement: bindingIndex.recordReturnStatement,
  TaggedTemplateExpression: bindingIndex.recordTaggedTemplateExpression,
  TemplateLiteral(node: ESTree.TemplateLiteral) {
    bindingIndex.recordTemplateLiteral(node);
    hooks.afterTemplate?.(node);
  },
  UnaryExpression(node: ESTree.UnaryExpression) {
    bindingIndex.recordUnaryExpression(node);
    hooks.afterUnary?.(node);
  },
  UpdateExpression(node: ESTree.UpdateExpression) {
    bindingIndex.recordUpdateExpression(node);
    hooks.afterUpdate?.(node);
  },
  VariableDeclarator: bindingIndex.recordVariableDeclarator,
  YieldExpression: bindingIndex.recordYieldExpression,
});
