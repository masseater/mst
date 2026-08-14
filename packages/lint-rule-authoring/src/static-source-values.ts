import type { UnknownFields } from "./unknown-fields.ts";

export type ConstantsByName = ReadonlyMap<string, UnknownFields>;

type ResolveInput = {
  readonly node: UnknownFields;
  readonly constants: ConstantsByName;
  readonly visited: readonly string[];
};

export const isAstNode = (candidate: unknown): candidate is UnknownFields =>
  typeof candidate === "object" && candidate !== null;

export const nodesIn = (candidate: unknown): readonly UnknownFields[] =>
  Array.isArray(candidate) ? candidate.filter(isAstNode) : [];

export const keyNameOf = (property: UnknownFields): string | null => {
  const named = property.key as UnknownFields;
  if (named.type === "Identifier") return named.name as string;
  if (named.type === "Literal" && typeof named.value === "string") return named.value;
  return null;
};

export const propertyOf = (objectNode: UnknownFields, propertyName: string): UnknownFields | null =>
  nodesIn(objectNode.properties)
    .filter((property) => property.type === "Property" && keyNameOf(property) === propertyName)
    .map((property) => property.value as UnknownFields)
    .at(0) ?? null;

const templateTextOf = (node: UnknownFields): string | null => {
  const expressions = node.expressions as readonly unknown[];
  if (expressions.length > 0) return null;
  return nodesIn(node.quasis)
    .map((quasi) => (quasi.value as UnknownFields).cooked as string)
    .join("");
};

const concatenatedTextOf = ({ node, constants, visited }: ResolveInput): string | null => {
  const left = resolveText({ node: node.left as UnknownFields, constants, visited });
  const right = resolveText({ node: node.right as UnknownFields, constants, visited });
  return left === null || right === null ? null : `${left}${right}`;
};

const referencedTextOf = ({
  referencedName,
  constants,
  visited,
}: {
  readonly referencedName: string;
  readonly constants: ConstantsByName;
  readonly visited: readonly string[];
}): string | null => {
  const referenced = constants.get(referencedName);
  if (referenced === undefined || visited.includes(referencedName)) return null;
  return resolveText({ node: referenced, constants, visited: [...visited, referencedName] });
};

export const resolveText = (input: ResolveInput): string | null => {
  const { node, constants, visited } = input;
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : null;
  if (node.type === "TemplateLiteral") return templateTextOf(node);
  if (node.type === "BinaryExpression" && node.operator === "+") return concatenatedTextOf(input);
  if (node.type === "Identifier") {
    return referencedTextOf({ referencedName: node.name as string, constants, visited });
  }
  return null;
};

export const declaratorsIn = (statement: UnknownFields): readonly UnknownFields[] => {
  if (statement.type === "VariableDeclaration") return nodesIn(statement.declarations);
  if (statement.type === "ExportNamedDeclaration" && isAstNode(statement.declaration)) {
    return declaratorsIn(statement.declaration);
  }
  return [];
};

export const moduleConstantsIn = (statements: readonly UnknownFields[]): ConstantsByName =>
  new Map(
    statements.flatMap(declaratorsIn).flatMap((declarator) => {
      const binding = declarator.id as UnknownFields;
      const initializer = declarator.init;
      return binding.type === "Identifier" && isAstNode(initializer)
        ? [[binding.name as string, initializer] as const]
        : [];
    }),
  );
