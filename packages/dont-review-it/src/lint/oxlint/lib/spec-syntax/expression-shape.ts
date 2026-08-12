import { isAstFields, type AstFields } from "../ast-node.ts";

const NOTATION_KEYS: ReadonlySet<string> = new Set([
  "end",
  "loc",
  "optional",
  "parent",
  "range",
  "raw",
  "shorthand",
  "start",
  "type",
]);

const FORWARDED_BY_TYPE: ReadonlyMap<string, string> = new Map([
  ["AwaitExpression", "argument"],
  ["ChainExpression", "expression"],
  ["ParenthesizedExpression", "expression"],
  ["TSAsExpression", "expression"],
  ["TSNonNullExpression", "expression"],
  ["TSSatisfiesExpression", "expression"],
  ["TSTypeAssertion", "expression"],
]);

const UNORDERED_MEMBERS_TYPE = "ObjectExpression";

const spelledOut = (held: unknown): string => JSON.stringify(held ?? null);

const spelledTemplate = (node: AstFields): string | null => {
  const substitutions = [node.expressions].flat();
  const [piece] = [node.quasis].flat();
  const spelling = isAstFields(piece) && isAstFields(piece.value) ? piece.value.cooked : null;
  return substitutions.length === 0 && typeof spelling === "string" ? spelling : null;
};

const literalShape = (node: AstFields): string => {
  const pattern = node.regex;
  if (isAstFields(pattern)) {
    return `regex ${spelledOut(pattern.pattern)}${spelledOut(pattern.flags)}`;
  }

  const wide = node.bigint;
  if (typeof wide === "string") return `bigint ${wide}`;
  return `value ${spelledOut(node.value)}`;
};

const atomShapeOf = (node: AstFields, nodeType: string): string | null => {
  if (nodeType === "Literal") return literalShape(node);
  if (nodeType !== "TemplateLiteral") return null;

  const spelling = spelledTemplate(node);
  return spelling === null ? null : `value ${spelledOut(spelling)}`;
};

export const syntaxShapeOf = (held: unknown): string => {
  if (Array.isArray(held)) return `[${held.map((held) => syntaxShapeOf(held)).join(",")}]`;
  if (!isAstFields(held)) return spelledOut(held);

  const nodeType = typeof held.type === "string" ? held.type : "";
  const forwarded = FORWARDED_BY_TYPE.get(nodeType);
  if (forwarded !== undefined) return syntaxShapeOf(held[forwarded]);

  const atom = atomShapeOf(held, nodeType);
  if (atom !== null) return atom;

  const members = Object.keys(held)
    .filter((named) => !NOTATION_KEYS.has(named))
    .toSorted()
    .map((named) => {
      const carried = held[named];
      const unordered = nodeType === UNORDERED_MEMBERS_TYPE && Array.isArray(carried);
      const shapes = unordered ? carried.map((member) => syntaxShapeOf(member)).toSorted() : null;
      return `${named}:${shapes === null ? syntaxShapeOf(carried) : `[${shapes.join(",")}]`}`;
    });
  return `${nodeType}(${members.join(",")})`;
};
