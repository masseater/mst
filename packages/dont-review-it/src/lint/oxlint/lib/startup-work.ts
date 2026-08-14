import { BACK_REFERENCE_FIELD, isAstFields, NODE_TYPE_FIELD } from "./ast-node.ts";

const defersItsBody = (nodeType: string): boolean =>
  nodeType === "ArrowFunctionExpression" ||
  nodeType === "FunctionExpression" ||
  nodeType === "FunctionDeclaration" ||
  nodeType === "ClassBody";

const runsWhereItStands = (nodeType: string): boolean =>
  nodeType === "CallExpression" ||
  nodeType === "AwaitExpression" ||
  nodeType === "TaggedTemplateExpression";

export const carriesStartupWork = (held: unknown): boolean => {
  if (Array.isArray(held)) return held.some((listed) => carriesStartupWork(listed));
  if (!isAstFields(held)) return false;
  const nodeType = held[NODE_TYPE_FIELD];
  if (typeof nodeType === "string" && defersItsBody(nodeType)) return false;
  if (typeof nodeType === "string" && runsWhereItStands(nodeType)) return true;
  return Object.entries(held).some(
    ([field, carried]) => field !== BACK_REFERENCE_FIELD && carriesStartupWork(carried),
  );
};
