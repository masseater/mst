import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import { CONCATENATION_OPERATOR } from "../written-out-text.ts";

export type CouplingEdge = {
  readonly specifier: string;
  readonly carriesValues: boolean;
};

const TRAVERSED_AWAY_FIELDS: ReadonlySet<string> = new Set(["parent", "loc", "range"]);

export const TYPE_ONLY_KIND = "type";

const REQUIRE_CALL_NAME = "require";

const IMPORT_DECLARATION = "ImportDeclaration";

const EXPORT_NAMED_DECLARATION = "ExportNamedDeclaration";

const EXPORT_ALL_DECLARATION = "ExportAllDeclaration";

export const astFieldsOf = (held: unknown): AstFields | null => (isAstFields(held) ? held : null);

export const nodeTypeOf = (node: AstFields): string => {
  const spelled = node[NODE_TYPE_FIELD];
  return typeof spelled === "string" ? spelled : "";
};

export const listedFieldsOf = (held: unknown): readonly AstFields[] =>
  (Array.isArray(held) ? held : [held]).map(astFieldsOf).filter((entry) => entry !== null);

export const statementsOf = (program: AstFields): readonly AstFields[] =>
  listedFieldsOf(program.body);

const childrenOf = (node: AstFields): readonly AstFields[] =>
  Object.entries(node)
    .filter(([field]) => !TRAVERSED_AWAY_FIELDS.has(field))
    .flatMap(([, held]) => listedFieldsOf(held));

const cookedTextOf = (quasi: AstFields): string | null => {
  const written = astFieldsOf(quasi.value);
  if (written === null) return null;
  return typeof written.cooked === "string" ? written.cooked : null;
};

const assembledFromParts = (
  node: AstFields,
  constants: ReadonlyMap<string, string>,
): string | null => {
  const texts = listedFieldsOf(node.quasis).map(cookedTextOf);
  const filled = listedFieldsOf(node.expressions).map((expression) =>
    staticSpecifierOf(expression, constants),
  );
  if (texts.includes(null) || filled.includes(null)) return null;
  return texts.map((text, index) => [text, filled.at(index)].join("")).join("");
};

const joinedFromSides = (
  node: AstFields,
  constants: ReadonlyMap<string, string>,
): string | null => {
  if (node.operator !== CONCATENATION_OPERATOR) return null;

  const spelled = listedFieldsOf([node.left, node.right]).map((side) =>
    staticSpecifierOf(side, constants),
  );
  return spelled.includes(null) ? null : spelled.join("");
};

export const staticSpecifierOf = (
  node: AstFields,
  constants: ReadonlyMap<string, string>,
): string | null => {
  const type = nodeTypeOf(node);
  if (type === "Literal") return typeof node.value === "string" ? node.value : null;
  if (type === "Identifier") return constants.get(String(node.name)) ?? null;
  if (type === "TemplateLiteral") return assembledFromParts(node, constants);
  if (type === "BinaryExpression") return joinedFromSides(node, constants);
  return null;
};

const edgeThrough = (
  source: unknown,
  { kind, constants }: { readonly kind: unknown; readonly constants: ReadonlyMap<string, string> },
): CouplingEdge | null => {
  const spelled = astFieldsOf(source);
  if (spelled === null) return null;
  const specifier = staticSpecifierOf(spelled, constants);
  if (specifier === null) return null;
  return { specifier, carriesValues: kind !== TYPE_ONLY_KIND };
};

const declaredEdgeOf = (
  node: AstFields,
  constants: ReadonlyMap<string, string>,
): CouplingEdge | null => {
  const type = nodeTypeOf(node);
  if (type === IMPORT_DECLARATION) {
    return edgeThrough(node.source, { kind: node.importKind, constants });
  }
  if (type === EXPORT_NAMED_DECLARATION || type === EXPORT_ALL_DECLARATION) {
    return edgeThrough(node.source, { kind: node.exportKind, constants });
  }
  return null;
};

export const requestedSpecifierOf = (node: unknown): AstFields | null => {
  const spelled = astFieldsOf(node);
  if (spelled === null) return null;

  const type = nodeTypeOf(spelled);
  if (type === "ImportExpression") return astFieldsOf(spelled.source);
  if (type !== "CallExpression") return null;

  const callee = astFieldsOf(spelled.callee);
  if (callee === null || nodeTypeOf(callee) !== "Identifier") return null;
  if (callee.name !== REQUIRE_CALL_NAME) return null;
  return listedFieldsOf(spelled.arguments).at(0) ?? null;
};

export const couplingEdgeOf = (
  node: unknown,
  constants: ReadonlyMap<string, string>,
): CouplingEdge | null => {
  const spelled = astFieldsOf(node);
  if (spelled === null) return null;
  return (
    declaredEdgeOf(spelled, constants) ??
    edgeThrough(requestedSpecifierOf(spelled), { kind: "value", constants })
  );
};

export const couplingEdgesUnder = (
  node: AstFields,
  constants: ReadonlyMap<string, string>,
): readonly CouplingEdge[] => {
  const own = couplingEdgeOf(node, constants);
  const nested = childrenOf(node).flatMap((child) => couplingEdgesUnder(child, constants));
  return own === null ? nested : [own, ...nested];
};

const declaredStatementOf = (statement: AstFields): AstFields =>
  nodeTypeOf(statement) === EXPORT_NAMED_DECLARATION
    ? (astFieldsOf(statement.declaration) ?? statement)
    : statement;

const boundConstantsIn = (
  statement: AstFields,
  known: ReadonlyMap<string, string>,
): readonly (readonly [string, string])[] => {
  const declared = declaredStatementOf(statement);
  if (nodeTypeOf(declared) !== "VariableDeclaration" || declared.kind !== "const") return [];

  return listedFieldsOf(declared.declarations).flatMap((declarator) => {
    const named = astFieldsOf(declarator.id);
    const bound = astFieldsOf(declarator.init);
    if (named === null || bound === null || nodeTypeOf(named) !== "Identifier") return [];
    const spelling = staticSpecifierOf(bound, known);
    return spelling === null ? [] : [[String(named.name), spelling] as const];
  });
};

export const constantSpecifiersIn = (body: unknown): ReadonlyMap<string, string> =>
  listedFieldsOf(body).reduce<ReadonlyMap<string, string>>(
    (known, statement) => new Map([...known, ...boundConstantsIn(statement, known)]),
    new Map(),
  );
