import { nodeTypeOf } from "../setup-modules/coupling-edges.ts";

import type { AstFields } from "../ast-node.ts";

const CARRIER_KINDS: ReadonlySet<string> = new Set([
  "ArrayExpression",
  "ChainExpression",
  "ConditionalExpression",
  "LogicalExpression",
  "ObjectExpression",
  "ParenthesizedExpression",
  "Property",
  "SequenceExpression",
  "SpreadElement",
  "TSAsExpression",
  "TSInstantiationExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
  "TemplateLiteral",
]);

const HANDING_KINDS: ReadonlySet<string> = new Set([
  "ExportDefaultDeclaration",
  "ExportNamedDeclaration",
  "ExportSpecifier",
  "ReturnStatement",
  "ThrowStatement",
  "YieldExpression",
]);

const HANDED_AT_FIELD: ReadonlyMap<string, string> = new Map([
  ["ArrowFunctionExpression", "body"],
  ["AssignmentExpression", "right"],
  ["VariableDeclarator", "init"],
]);

const HELD_AT_FIELD: ReadonlyMap<string, string> = new Map([
  ["CallExpression", "callee"],
  ["NewExpression", "callee"],
  ["TaggedTemplateExpression", "tag"],
]);

const isHandedBy = (parent: AstFields, child: AstFields): boolean => {
  const nodeKind = nodeTypeOf(parent);
  if (HANDING_KINDS.has(nodeKind)) return true;

  const handedAt = HANDED_AT_FIELD.get(nodeKind);
  if (handedAt !== undefined) return parent[handedAt] === child;

  const heldAt = HELD_AT_FIELD.get(nodeKind);
  return heldAt !== undefined && parent[heldAt] !== child;
};

const climbing = (child: AstFields, chain: readonly AstFields[]): boolean =>
  chain
    .slice(-1)
    .some(
      (parent) =>
        isHandedBy(parent, child) ||
        (CARRIER_KINDS.has(nodeTypeOf(parent)) && climbing(parent, chain.slice(0, -1))),
    );

export const flowsOutOf = (node: AstFields, chain: readonly AstFields[]): boolean =>
  climbing(node, chain);
