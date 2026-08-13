import { parseSync } from "oxc-parser";

import { astFieldsOf, listedFieldsOf, nodeTypeOf } from "../setup-modules/coupling-edges.ts";

import type { AstFields } from "../ast-node.ts";

type ClassMember = {
  readonly name: string;
  readonly writesThis: boolean;
  readonly calledOwnMethods: readonly string[];
};

type NamedClassBody = readonly [string, AstFields];

const OWN_SCOPE_NODES: ReadonlySet<string> = new Set([
  "ClassBody",
  "FunctionDeclaration",
  "FunctionExpression",
]);

const CARRIED_INSIDE_FIELD_BY_TYPE: ReadonlyMap<string, string> = new Map([
  ["ChainExpression", "expression"],
  ["ParenthesizedExpression", "expression"],
  ["TSAsExpression", "expression"],
  ["TSNonNullExpression", "expression"],
  ["TSSatisfiesExpression", "expression"],
  ["TSTypeAssertion", "expression"],
]);

const PRIVATE_NAME_PREFIX = "#";

const DELETE_OPERATOR = "delete";

const WRITTEN_METHOD_KIND = "method";

const unwrappedNodeOf = (node: AstFields): AstFields => {
  const field = CARRIED_INSIDE_FIELD_BY_TYPE.get(nodeTypeOf(node));
  const inside = field === undefined ? null : astFieldsOf(node[field]);
  return inside === null ? node : unwrappedNodeOf(inside);
};

const rootsAtThis = (node: AstFields): boolean => {
  const written = unwrappedNodeOf(node);
  const nodeType = nodeTypeOf(written);
  if (nodeType === "ThisExpression") return true;
  if (nodeType !== "MemberExpression") return false;

  const inside = astFieldsOf(written.object);
  return inside !== null && rootsAtThis(inside);
};

const writesThroughThis = (held: unknown): boolean =>
  listedFieldsOf(held).some((node) => {
    const written = unwrappedNodeOf(node);
    return nodeTypeOf(written) === "MemberExpression" && rootsAtThis(written);
  });

const spelledNamesOf = (keyNode: AstFields, computed: unknown): readonly string[] => {
  const nodeType = nodeTypeOf(keyNode);
  if (nodeType === "PrivateIdentifier") return [`${PRIVATE_NAME_PREFIX}${String(keyNode.name)}`];
  if (nodeType === "Identifier") return computed === true ? [] : [String(keyNode.name)];
  if (nodeType === "Literal") return typeof keyNode.value === "string" ? [keyNode.value] : [];
  if (nodeType !== "TemplateLiteral") return [];

  const quasis = listedFieldsOf(keyNode.quasis);
  const substituted = quasis.length !== 1 || listedFieldsOf(keyNode.expressions).length !== 0;
  if (substituted) return [];
  return quasis
    .flatMap((quasi) => listedFieldsOf(quasi.value))
    .map((quasiValue) => String(quasiValue.cooked));
};

const spelledKeyOf = (held: unknown, computed: unknown): string | null =>
  listedFieldsOf(held)
    .flatMap((keyNode) => spelledNamesOf(keyNode, computed))
    .at(0) ?? null;

const nestedNodesOf = (node: AstFields): readonly AstFields[] =>
  Object.values(node).flatMap((held) => listedFieldsOf(held));

const reachedNodesIn = (node: AstFields): readonly AstFields[] =>
  nestedNodesOf(node).flatMap((nested) =>
    OWN_SCOPE_NODES.has(nodeTypeOf(nested)) ? [] : [nested, ...reachedNodesIn(nested)],
  );

const writesThisIn = (nodes: readonly AstFields[]): boolean =>
  nodes.some((node) => {
    const nodeType = nodeTypeOf(node);
    if (nodeType === "AssignmentExpression") return writesThroughThis(node.left);
    if (nodeType === "UpdateExpression") return writesThroughThis(node.argument);
    if (nodeType !== "UnaryExpression" || node.operator !== DELETE_OPERATOR) return false;
    return writesThroughThis(node.argument);
  });

const calledOwnMethodOf = (node: AstFields): string | null => {
  if (nodeTypeOf(node) !== "CallExpression") return null;

  const callee = astFieldsOf(node.callee);
  if (callee === null || nodeTypeOf(callee) !== "MemberExpression") return null;

  const receiver = astFieldsOf(callee.object);
  if (receiver === null || nodeTypeOf(unwrappedNodeOf(receiver)) !== "ThisExpression") return null;
  return spelledKeyOf(callee.property, callee.computed);
};

const memberBodyOf = (member: AstFields): AstFields | null => {
  const written = astFieldsOf(member.value);
  if (written === null) return null;

  const nodeType = nodeTypeOf(member);
  if (nodeType === "MethodDefinition") {
    return member.kind === WRITTEN_METHOD_KIND ? astFieldsOf(written.body) : null;
  }
  if (nodeType !== "PropertyDefinition") return null;
  return nodeTypeOf(written) === "ArrowFunctionExpression" ? astFieldsOf(written.body) : null;
};

const classMemberOf = (member: AstFields): readonly ClassMember[] => {
  const memberName = spelledKeyOf(member.key, member.computed);
  const memberBody = memberBodyOf(member);
  if (memberName === null || memberBody === null) return [];

  const reached = [memberBody, ...reachedNodesIn(memberBody)];
  return [
    {
      name: memberName,
      writesThis: writesThisIn(reached),
      calledOwnMethods: reached.flatMap((node) => {
        const called = calledOwnMethodOf(node);
        return called === null ? [] : [called];
      }),
    },
  ];
};

const closedOverWrites = (members: readonly ClassMember[]): ReadonlySet<string> => {
  const grownFrom = (settled: ReadonlySet<string>): ReadonlySet<string> => {
    const grown = new Set([
      ...settled,
      ...members
        .filter((member) => member.calledOwnMethods.some((called) => settled.has(called)))
        .map((member) => member.name),
    ]);
    return grown.size === settled.size ? settled : grownFrom(grown);
  };
  return grownFrom(new Set(members.filter((member) => member.writesThis).map((one) => one.name)));
};

const declaredNameOf = (node: AstFields): readonly string[] =>
  listedFieldsOf(node.id).flatMap((named) => (typeof named.name === "string" ? [named.name] : []));

const namedBodiesOf = (named: AstFields, holder: AstFields): readonly NamedClassBody[] =>
  declaredNameOf(named).flatMap((className) =>
    listedFieldsOf(holder.body).map((classBody): NamedClassBody => [className, classBody]),
  );

const classBodiesOf = (node: AstFields): readonly NamedClassBody[] => {
  const nodeType = nodeTypeOf(node);
  if (nodeType === "ClassDeclaration") return namedBodiesOf(node, node);
  if (nodeType !== "VariableDeclaration") return [];

  return listedFieldsOf(node.declarations).flatMap((declarator) =>
    listedFieldsOf(declarator.init)
      .filter((init) => nodeTypeOf(init) === "ClassExpression")
      .flatMap((init) => namedBodiesOf(declarator, init)),
  );
};

const declaredNodesOf = (statement: AstFields): readonly AstFields[] => {
  const nodeType = nodeTypeOf(statement);
  if (nodeType !== "ExportNamedDeclaration" && nodeType !== "ExportDefaultDeclaration")
    return [statement];

  const declared = astFieldsOf(statement.declaration);
  return declared === null ? [] : [declared];
};

export const mutatingMethodNamesIn = (asked: {
  readonly source: string;
  readonly path: string;
  readonly className: string;
}): ReadonlySet<string> | null => {
  const statements = listedFieldsOf(parseSync(asked.path, asked.source).program.body);
  const bodyByClassName = new Map(statements.flatMap(declaredNodesOf).flatMap(classBodiesOf));
  const classBody = bodyByClassName.get(asked.className);
  if (classBody === undefined) return null;

  return closedOverWrites(listedFieldsOf(classBody.body).flatMap(classMemberOf));
};
