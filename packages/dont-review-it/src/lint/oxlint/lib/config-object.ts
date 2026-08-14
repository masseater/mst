import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "./ast-node.ts";

export const fieldsIn = (held: unknown): readonly AstFields[] =>
  Array.isArray(held) ? held.filter(isAstFields) : [];

export const nodeOfType = ({ held, type }: { readonly held: unknown; readonly type: string }) =>
  isAstFields(held) && String(held[NODE_TYPE_FIELD]) === type ? held : null;

const OBJECT_EXPRESSION = "ObjectExpression";

export const propertiesOf = (held: unknown): readonly AstFields[] =>
  fieldsIn(nodeOfType({ held, type: OBJECT_EXPRESSION })?.properties);

export const LITERAL = "Literal";

export const IDENTIFIER = "Identifier";

export const keyNameOf = (property: AstFields): string | null => {
  const named = property.key;
  if (nodeOfType({ held: named, type: LITERAL }) !== null)
    return String((named as AstFields).value);
  const identifier = nodeOfType({ held: named, type: IDENTIFIER });
  return identifier === null || property.computed === true ? null : String(identifier.name);
};

export const valueAt = ({ held, key }: { readonly held: unknown; readonly key: string }): unknown =>
  propertiesOf(held).findLast((property) => keyNameOf(property) === key)?.value ?? null;

const CALL_EXPRESSION = "CallExpression";

export const unwrappedCall = (held: unknown): unknown => {
  const call = nodeOfType({ held, type: CALL_EXPRESSION });
  return call === null ? held : unwrappedCall(fieldsIn(call.arguments)[0]);
};

const EXPORT_DEFAULT = "ExportDefaultDeclaration";

export const defaultExportedValue = (program: { readonly body: unknown }): unknown =>
  unwrappedCall(
    fieldsIn(program.body).findLast(
      (statement) => String(statement[NODE_TYPE_FIELD]) === EXPORT_DEFAULT,
    )?.declaration,
  );
