import { readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import { parseSync } from "oxc-parser";

import {
  declaratorsIn,
  isAstNode,
  keyNameOf,
  moduleConstantsIn,
  nodesIn,
  propertyOf,
  resolveText,
  type ConstantsByName,
} from "../static-source-values.ts";

import type { UnknownFields } from "../unknown-fields.ts";

type LintRuleMessage = {
  readonly messageId: string;
  readonly template: string;
};

export type LintRuleFacts = {
  readonly name: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly fixable: boolean;
  readonly hasSuggestions: boolean;
  readonly configurable: boolean;
  readonly shipped: boolean;
  readonly messages: readonly LintRuleMessage[];
};

const FUNCTION_EXPRESSION_TYPES: readonly string[] = [
  "ArrowFunctionExpression",
  "FunctionExpression",
];

const ruleCandidateOf = (initializer: UnknownFields): UnknownFields | null => {
  if (initializer.type === "ObjectExpression") return initializer;
  if (initializer.type === "CallExpression") {
    return (
      nodesIn(initializer.arguments).find((argument) => argument.type === "ObjectExpression") ??
      null
    );
  }
  if (FUNCTION_EXPRESSION_TYPES.includes(initializer.type as string)) {
    return ruleCandidateOf(initializer.body as UnknownFields);
  }
  return null;
};

const GENERIC_FILE_STEMS: readonly string[] = ["index", "rule"];

const ruleNameOf = ({
  definition,
  constants,
  sourcePath,
}: {
  readonly definition: UnknownFields;
  readonly constants: ConstantsByName;
  readonly sourcePath: string;
}): string => {
  const namedAs = propertyOf(definition, "name");
  const resolved = namedAs === null ? null : resolveText({ node: namedAs, constants, visited: [] });
  if (resolved !== null) return resolved;

  const stem = basename(sourcePath, extname(sourcePath));
  return GENERIC_FILE_STEMS.includes(stem) ? basename(dirname(sourcePath)) : stem;
};

const descriptionOf = ({
  docs,
  constants,
}: {
  readonly docs: UnknownFields | null;
  readonly constants: ConstantsByName;
}): string => {
  const descriptionNode = docs === null ? null : propertyOf(docs, "description");
  if (descriptionNode === null) return "";
  return resolveText({ node: descriptionNode, constants, visited: [] }) ?? "";
};

const messagesOf = ({
  complaints,
  constants,
}: {
  readonly complaints: UnknownFields;
  readonly constants: ConstantsByName;
}): readonly LintRuleMessage[] =>
  nodesIn(complaints.properties)
    .filter((property) => property.type === "Property")
    .flatMap((property) => {
      const messageId = keyNameOf(property);
      const template =
        messageId === null
          ? null
          : resolveText({ node: property.value as UnknownFields, constants, visited: [] });
      return messageId === null || template === null ? [] : [{ messageId, template }];
    });

const declaresOptions = ({
  schema,
  constants,
}: {
  readonly schema: UnknownFields | null;
  readonly constants: ConstantsByName;
}): boolean => {
  if (schema === null) return false;
  if (schema.type === "Identifier") {
    const named = constants.get(schema.name as string);
    return named === undefined ? true : declaresOptions({ schema: named, constants });
  }
  return Array.isArray(schema.elements) && schema.elements.length > 0;
};

const factsOf = ({
  definition,
  constants,
  sourcePath,
}: {
  readonly definition: UnknownFields;
  readonly constants: ConstantsByName;
  readonly sourcePath: string;
}): readonly LintRuleFacts[] => {
  const meta = propertyOf(definition, "meta");
  if (meta === null || meta.type !== "ObjectExpression") return [];

  const complaints = propertyOf(meta, "messages");
  if (complaints === null || complaints.type !== "ObjectExpression") return [];

  const schema = propertyOf(meta, "schema");
  const suggestionsFlag = propertyOf(meta, "hasSuggestions");
  const docs = propertyOf(meta, "docs");
  const shippedFlag = docs === null ? null : propertyOf(docs, "shipped");

  return [
    {
      name: ruleNameOf({ definition, constants, sourcePath }),
      description: descriptionOf({ docs, constants }),
      sourcePath,
      fixable: propertyOf(meta, "fixable") !== null,
      hasSuggestions: suggestionsFlag?.value === true,
      configurable: declaresOptions({ schema, constants }),
      shipped: shippedFlag?.value !== false,
      messages: messagesOf({ complaints, constants }),
    },
  ];
};

export const lintRuleFactsIn = ({
  workspaceRoot,
  sourcePath,
}: {
  readonly workspaceRoot: string;
  readonly sourcePath: string;
}): readonly LintRuleFacts[] => {
  const sourceText = readFileSync(join(workspaceRoot, sourcePath), "utf8");
  const statements = nodesIn(parseSync(sourcePath, sourceText).program.body);
  const constants = moduleConstantsIn(statements);

  return statements
    .filter((statement) => statement.type === "ExportNamedDeclaration")
    .flatMap(declaratorsIn)
    .map((declarator) => declarator.init)
    .filter(isAstNode)
    .map(ruleCandidateOf)
    .filter((candidate): candidate is UnknownFields => candidate !== null)
    .flatMap((definition) => factsOf({ definition, constants, sourcePath }));
};
