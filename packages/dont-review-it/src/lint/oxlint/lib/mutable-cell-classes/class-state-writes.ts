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

const soleQuasiText = (key: unknown): string | null => {
  const spelled = listedFieldsOf(fieldOf(key, "quasis"))
    .flatMap((quasi) => listedFieldsOf(quasi.value))
    .map((value) => String(value.cooked));
  return listedFieldsOf(fieldOf(key, "expressions")).length === 0 ? spelled.join("") : null;
};

const spelledKey = (member: unknown): string | null => {
  const key = fieldOf(member, "property");
  if (fieldOf(member, "computed") !== true) {
    const spelled = String(fieldOf(key, "name"));
    return kindAt(key) === "PrivateIdentifier" ? `${PRIVATE_NAME_MARK}${spelled}` : spelled;
  }
  if (kindAt(key) === "Literal") {
    const spelled = fieldOf(key, "value");
    return typeof spelled === "string" ? spelled : null;
  }
  return kindAt(key) === "TemplateLiteral" ? soleQuasiText(key) : null;
};

const ownStateFieldOf = (target: unknown): string | null => {
  const written = unwrapped(target);
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

  const kind = kindAt(member);
  if (kind === "MethodDefinition") {
    const written = fieldOf(fieldOf(member, "value"), "body");
    return fieldsWrittenUnder(written, fieldOf(member, "kind") === "constructor");
  }
  if (HELD_STATE_MEMBER_KINDS.has(kind)) return fieldsWrittenUnder(fieldOf(member, "value"), true);
  return [];
};

export const stateFieldsWrittenAfterConstruction = (classNode: unknown): readonly string[] =>
  uniq(listedFieldsOf(fieldOf(fieldOf(classNode, "body"), "body")).flatMap(fieldsWrittenBy));
