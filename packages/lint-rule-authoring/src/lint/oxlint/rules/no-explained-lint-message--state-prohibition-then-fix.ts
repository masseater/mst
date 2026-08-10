import { createLintRuleAuthoringRule } from "../../../create-rule.ts";
import { propertyNameOf } from "../../../object-property-name.ts";

import type { ESTree } from "@oxlint/plugins";

const PROHIBITION_MARKER = /\b(?:must not|is forbidden|are forbidden)\b/iu;

const RATIONALE_MARKER = /\b(?:because|since|so that|therefore|which means|as a result)\b/iu;

const CONDITION_MARKER = /\b(?:if|when|unless|whenever|once|otherwise)\b/iu;

const ESCAPE_MARKER =
  /(?:suppress this rule|disable this rule|add an exemption|add it to the allowlist|opt out|as a last resort)/iu;

const NON_ENGLISH_CHARACTER = /[^ -~]/u;

const HAND_WRITTEN_DOC_POINTER = /\.md\b/u;

const FIX_VERBS = new Set([
  "Add",
  "Annotate",
  "Assert",
  "Await",
  "Bind",
  "Build",
  "Call",
  "Choose",
  "Convert",
  "Create",
  "Decide",
  "Declare",
  "Delete",
  "Derive",
  "Drop",
  "Export",
  "Extract",
  "Fold",
  "Forward",
  "Give",
  "Import",
  "Inline",
  "Keep",
  "List",
  "Merge",
  "Move",
  "Name",
  "Narrow",
  "Parse",
  "Pass",
  "Pick",
  "Place",
  "Put",
  "Re-export",
  "Read",
  "Recover",
  "Reduce",
  "Register",
  "Remove",
  "Rename",
  "Reorder",
  "Replace",
  "Return",
  "Rewrite",
  "Sort",
  "Split",
  "Stop",
  "Take",
  "Throw",
  "Turn",
  "Use",
  "Validate",
  "Wrap",
  "Write",
]);

const proseOf = (node: ESTree.Node): string | null => {
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : null;
  if (node.type !== "TemplateLiteral") return null;
  return node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ");
};

const inspectableOf = (prose: string): string =>
  prose.replace(/`[^`]*`/gu, " ").replace(/\{\{[^}]*\}\}/gu, " ");

const opensWithFixVerb = (inspectable: string): boolean =>
  inspectable
    .split(/(?<=[.!?])\s+/u)
    .some((sentence) => FIX_VERBS.has(sentence.trim().split(/[\s,:;]/u)[0] ?? ""));

const namedPropertyOf = (
  properties: ESTree.ObjectExpression["properties"],
  name: string,
): ESTree.ObjectProperty | null => {
  for (const property of properties) {
    if (property.type !== "Property") continue;
    if (propertyNameOf(property) === name) return property;
  }
  return null;
};

const descriptionOf = (docs: ESTree.ObjectProperty): string => {
  if (docs.value.type !== "ObjectExpression") return "";
  const description = namedPropertyOf(docs.value.properties, "description");
  return description === null ? "" : (proseOf(description.value) ?? "");
};

const violationsOf = (
  prose: string,
  description: string,
): readonly { readonly messageId: string; readonly phrase: string }[] => {
  const inspectable = inspectableOf(prose);
  const rationale = RATIONALE_MARKER.exec(inspectable);
  const condition = CONDITION_MARKER.exec(inspectable);
  const escape = ESCAPE_MARKER.exec(inspectable);
  return [
    NON_ENGLISH_CHARACTER.test(prose) ? { messageId: "nonEnglishMessage", phrase: "" } : null,
    HAND_WRITTEN_DOC_POINTER.test(prose)
      ? { messageId: "handWrittenDocPointer", phrase: "" }
      : null,
    prose.trim() === description.trim() ? { messageId: "descriptionEcho", phrase: "" } : null,
    PROHIBITION_MARKER.test(inspectable) ? null : { messageId: "missingProhibition", phrase: "" },
    opensWithFixVerb(inspectable) ? null : { messageId: "missingFixDirection", phrase: "" },
    rationale === null ? null : { messageId: "rationaleStatement", phrase: rationale[0] },
    condition === null ? null : { messageId: "conditionStatement", phrase: condition[0] },
    escape === null ? null : { messageId: "escapeHatchPhrase", phrase: escape[0] },
  ].filter((violation) => violation !== null);
};

export const noExplainedLintMessage = createLintRuleAuthoringRule({
  name: "no-explained-lint-message--state-prohibition-then-fix",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every lint message to carry a prohibition and an imperative repair direction and nothing else, so the first thing a reader meets is the action that clears the report",
      relatedGuidelines: [],
    },
    messages: {
      missingProhibition:
        "Lint message `{{messageId}}` must not leave the rejected pattern unmarked. Add `must not` or `is forbidden` to the sentence that names that pattern.",
      missingFixDirection:
        "Lint message `{{messageId}}` must not stop at the prohibition. Add a sentence that opens with an imperative verb and names the repair.",
      rationaleStatement:
        "Lint message `{{messageId}}` must not argue for the rule. Delete `{{phrase}}` and the clause it opens, and leave the prohibition and the repair direction standing.",
      conditionStatement:
        "Lint message `{{messageId}}` must not make the repair conditional. Delete `{{phrase}}` and the branch it opens, and state one repair direction.",
      escapeHatchPhrase:
        "Lint message `{{messageId}}` must not offer a way around the rule. Delete `{{phrase}}` and the passage it belongs to.",
      handWrittenDocPointer:
        "Lint message `{{messageId}}` must not carry a hand-written document pointer. Delete the pointer and build this rule through the workspace lint-rule factory.",
      nonEnglishMessage:
        "Lint message `{{messageId}}` must not carry characters outside printable ASCII. Rewrite the whole message in English.",
      descriptionEcho:
        "Lint message `{{messageId}}` must not repeat `meta.docs.description`. Rewrite the message as a prohibition followed by a repair direction.",
    },
    schema: [],
  },
  create(context) {
    const reportEveryViolation = (message: ESTree.ObjectProperty, description: string): void => {
      const prose = proseOf(message.value);
      if (prose === null) return;
      const messageId = propertyNameOf(message) ?? "";
      for (const violation of violationsOf(prose, description)) {
        context.report({
          node: message,
          messageId: violation.messageId,
          data: { messageId, phrase: violation.phrase },
        });
      }
    };

    return {
      ObjectExpression(node: ESTree.ObjectExpression) {
        const messages = namedPropertyOf(node.properties, "messages");
        const docs = namedPropertyOf(node.properties, "docs");
        if (messages === null || docs === null) return;
        if (messages.value.type !== "ObjectExpression") return;
        const description = descriptionOf(docs);
        for (const message of messages.value.properties) {
          if (message.type !== "Property") continue;
          reportEveryViolation(message, description);
        }
      },
    };
  },
});
