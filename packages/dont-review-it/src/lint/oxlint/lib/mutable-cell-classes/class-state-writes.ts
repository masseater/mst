import { uniq } from "es-toolkit";

import { SUGARED_NODE_TYPES } from "../node-kinds.ts";
import { listedFieldsOf } from "../setup-modules/coupling-edges.ts";
import { fieldOf, kindAt, nodeVisitsIn } from "./node-visits.ts";

const PRIVATE_NAME_MARK = "#";

const OWN_THIS_KINDS: ReadonlySet<string> = new Set(["FunctionDeclaration", "FunctionExpression"]);

const HELD_STATE_MEMBER_KINDS: ReadonlySet<string> = new Set([
  "AccessorProperty",
  "PropertyDefinition",
]);

const unwrapped = (held: unknown): unknown =>
  SUGARED_NODE_TYPES.has(kindAt(held)) ? unwrapped(fieldOf(held, "expression")) : held;

const soleQuasiText = (named: unknown): string | null => {
  const spelled = listedFieldsOf(fieldOf(named, "quasis"))
    .flatMap((quasi) => listedFieldsOf(quasi.value))
    .map((held) => String(held.cooked));
  return listedFieldsOf(fieldOf(named, "expressions")).length === 0 ? spelled.join("") : null;
};

const spelledKey = (member: unknown): string | null => {
  const named = fieldOf(member, "property");
  if (fieldOf(member, "computed") !== true) {
    const spelled = String(fieldOf(named, "name"));
    return kindAt(named) === "PrivateIdentifier" ? `${PRIVATE_NAME_MARK}${spelled}` : spelled;
  }
  if (kindAt(named) === "Literal") {
    const spelled = fieldOf(named, "value");
    return typeof spelled === "string" ? spelled : null;
  }
  return kindAt(named) === "TemplateLiteral" ? soleQuasiText(named) : null;
};

const ownStateFieldOf = (checked: unknown): string | null => {
  const written = unwrapped(checked);
  if (kindAt(written) !== "MemberExpression") return null;

  const receiver = unwrapped(fieldOf(written, "object"));
  return kindAt(receiver) === "ThisExpression" ? spelledKey(written) : ownStateFieldOf(receiver);
};

const writtenTargetOf = (node: unknown): unknown => {
  switch (kindAt(node)) {
    case "AssignmentExpression":
      return fieldOf(node, "left");
    case "UnaryExpression":
      return fieldOf(node, "operator") === "delete" ? fieldOf(node, "argument") : null;
    case "UpdateExpression":
      return fieldOf(node, "argument");
    default:
      return null;
  }
};

const fieldsWrittenUnder = (root: unknown, deferralRequired: boolean): readonly string[] =>
  nodeVisitsIn(root).flatMap((visit) => {
    if (visit.ancestors.some((held) => OWN_THIS_KINDS.has(kindAt(held)))) return [];

    const deferred = visit.ancestors.some((held) => kindAt(held) === "ArrowFunctionExpression");
    if (deferralRequired && !deferred) return [];

    const field = ownStateFieldOf(writtenTargetOf(visit.node));
    return field === null ? [] : [field];
  });

const fieldsWrittenBy = (member: unknown): readonly string[] => {
  if (fieldOf(member, "static") === true) return [];

  const nodeKind = kindAt(member);
  if (nodeKind === "MethodDefinition") {
    const written = fieldOf(fieldOf(member, "value"), "body");
    return fieldsWrittenUnder(written, fieldOf(member, "kind") === "constructor");
  }
  if (HELD_STATE_MEMBER_KINDS.has(nodeKind))
    return fieldsWrittenUnder(fieldOf(member, "value"), true);
  return [];
};

export const stateFieldsWrittenAfterConstruction = (classNode: unknown): readonly string[] =>
  uniq(listedFieldsOf(fieldOf(fieldOf(classNode, "body"), "body")).flatMap(fieldsWrittenBy));
