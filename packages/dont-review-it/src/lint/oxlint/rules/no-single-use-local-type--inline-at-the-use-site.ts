import { createDontReviewItRule } from "../../../create-rule.ts";
import { isWithin } from "../lib/is-within.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";

import type { ESTree, Reference, Variable } from "@oxlint/plugins";

type LocalTypeDeclaration = {
  readonly node: ESTree.TSTypeAliasDeclaration;
  readonly variable: Variable;
};

const REFERENCES_A_SHARED_TYPE = 2;

const DECLARATION_FILE = /\.d\.[cm]?ts$/u;

const isExportReference = (reference: Reference): boolean => {
  const parent = reference.identifier.parent;
  return parent.type === "ExportSpecifier" && parent.local === reference.identifier;
};

const referenceKindOf = (
  reference: Reference,
): "implements" | "interfaceHeritage" | "typeReference" | null => {
  const identifier = reference.identifier;
  const parent = identifier.parent;
  if (
    parent.type === "TSTypeReference" &&
    parent.typeName.type === "Identifier" &&
    parent.typeName === identifier
  ) {
    return "typeReference";
  }
  if (
    parent.type === "TSInterfaceHeritage" &&
    parent.expression.type === "Identifier" &&
    parent.expression === identifier
  ) {
    return "interfaceHeritage";
  }
  if (
    parent.type === "TSClassImplements" &&
    parent.expression.type === "Identifier" &&
    parent.expression === identifier
  ) {
    return "implements";
  }
  return null;
};

const messageIdFor = (
  { node }: LocalTypeDeclaration,
  reference: Reference | undefined,
):
  | "selfOnlyLocalType"
  | "singleImplementationLocalType"
  | "singleInterfaceHeritageLocalType"
  | "singleUseLocalTypeAlias"
  | "unusedLocalType" => {
  if (reference === undefined) return "unusedLocalType";
  if (isWithin(reference.identifier, node)) return "selfOnlyLocalType";

  const referenceKind = referenceKindOf(reference);
  if (referenceKind === "implements") return "singleImplementationLocalType";
  if (referenceKind === "interfaceHeritage") return "singleInterfaceHeritageLocalType";
  return "singleUseLocalTypeAlias";
};

export const noSingleUseLocalType = createDontReviewItRule({
  name: "no-single-use-local-type--inline-at-the-use-site",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a type alias declared at the top level of a file without being exported when its resolved binding has fewer than two type references, so a name is given to a shape only where more than one place has to agree on it",
      relatedGuidelines: [],
    },
    messages: {
      selfOnlyLocalType:
        "A recursive local type referenced only from its own declaration must not remain. Delete the entire `{{name}}` declaration.",
      singleImplementationLocalType:
        "A local type implemented by only one class must not remain as a second contract for that class. Remove `implements {{name}}` from the class, then delete the `{{name}}` declaration.",
      singleInterfaceHeritageLocalType:
        "A local type extended by only one interface must not remain as a separate base. Alpha-rename every binding in the extending interface that shadows a free type name from `{{name}}`. Replace `extends {{name}}` with the object types its declaration names, move its declared members into the extending interface, substitute its type arguments, then delete the `{{name}}` declaration.",
      singleUseLocalTypeAlias:
        "A local type alias referenced from only one ordinary type position must not remain as an indirection. Alpha-rename every use-site binding that shadows a free type name from `{{name}}`. Replace that reference with the alias right-hand type, substitute its type arguments, then delete the alias.",
      unusedLocalType:
        "A local type referenced nowhere must not remain. Delete the entire `{{name}}` declaration.",
    },
    schema: [],
  },
  create(inspection) {
    if (isOutOfScopeSource(inspection.filename) || DECLARATION_FILE.test(inspection.filename))
      return {};

    const variablesFor = (node: ESTree.Node): readonly Variable[] =>
      inspection.sourceCode.getDeclaredVariables(node);

    const inspectDeclaration = (node: LocalTypeDeclaration["node"]): void => {
      if (node.parent.type !== "Program") return;
      const declaration = variablesFor(node)
        .filter((variable) => variable.identifiers.includes(node.id))
        .slice(0, 1)
        .map((variable) => ({ node, variable }))
        .at(0);
      if (declaration === undefined) return;
      const { variable } = declaration;
      if (variable.references.some(isExportReference)) return;
      const references = variable.references.filter(
        (reference) => referenceKindOf(reference) !== null,
      );
      if (references.length >= REFERENCES_A_SHARED_TYPE) return;
      inspection.report({
        node,
        messageId: messageIdFor(declaration, references[0]),
        data: { name: node.id.name },
      });
    };

    return {
      TSTypeAliasDeclaration: inspectDeclaration,
    };
  },
});
