import {
  astFieldsOf,
  couplingEdgeOf,
  nodeTypeOf,
  staticSpecifierOf,
} from "../setup-modules/coupling-edges.ts";

import type { AstFields } from "../ast-node.ts";

const requiredSpecifierOf = (
  statement: AstFields,
  constants: ReadonlyMap<string, string>,
): string | null => {
  const reference = astFieldsOf(statement.moduleReference);
  if (reference === null || nodeTypeOf(reference) !== "TSExternalModuleReference") return null;

  const expression = astFieldsOf(reference.expression);
  return expression === null ? null : staticSpecifierOf(expression, constants);
};

const typePositionSpecifierOf = (
  node: AstFields,
  constants: ReadonlyMap<string, string>,
): string | null => {
  const type = nodeTypeOf(node);
  if (type === "TSImportEqualsDeclaration") return requiredSpecifierOf(node, constants);
  if (type !== "TSImportType") return null;

  const source = astFieldsOf(node.source);
  return source === null ? null : staticSpecifierOf(source, constants);
};

export const reachRouteOf = (
  node: unknown,
  constants: ReadonlyMap<string, string>,
): string | null => {
  const edge = couplingEdgeOf(node, constants);
  if (edge !== null) return edge.specifier;

  const spelled = astFieldsOf(node);
  return spelled === null ? null : typePositionSpecifierOf(spelled, constants);
};
