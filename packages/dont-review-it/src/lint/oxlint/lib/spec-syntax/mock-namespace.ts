import { IMPORT_BINDING_NODE_TYPES } from "../node-kinds.ts";
import { resolveBinding } from "../resolved-bindings.ts";
import { moduleExportSpelling } from "./module-declarations.ts";
import { staticMemberName } from "./static-names.ts";
import { unwrapSubject } from "./subject-expressions.ts";

import type { Definition, ESTree, Scope, Variable } from "@oxlint/plugins";

export const DEFAULT_MOCK_NAMESPACE_SPELLINGS: readonly string[] = ["vi"];

export const DEFAULT_MOCK_CREATION_MEMBERS: readonly string[] = ["fn"];

export const MODULE_REPLACEMENT_MEMBER = "mock";

export const MOCK_BEHAVIOUR_SETTERS: ReadonlySet<string> = new Set([
  "mockImplementation",
  "mockImplementationOnce",
  "mockRejectedValue",
  "mockRejectedValueOnce",
  "mockResolvedValue",
  "mockResolvedValueOnce",
  "mockReturnThis",
  "mockReturnValue",
  "mockReturnValueOnce",
  "mockThrow",
  "mockThrowOnce",
  "withImplementation",
]);

export type NamespaceLookup = {
  readonly scopeAt: (node: ESTree.Node) => Scope;
  readonly spellings: ReadonlySet<string>;
  readonly seenBindings: ReadonlySet<Variable>;
};

const definitionSpellsNamespace = (definition: Definition, lookup: NamespaceLookup): boolean => {
  const declared = definition.node;
  if (declared.type === "ImportSpecifier") {
    return lookup.spellings.has(moduleExportSpelling(declared.imported));
  }
  if (declared.type !== "VariableDeclarator" || declared.init === null) return false;
  return declared.id.type === "Identifier" && spellsMockNamespace(declared.init, lookup);
};

const bindingSpellsNamespace = (binding: Variable, lookup: NamespaceLookup): boolean => {
  if (lookup.seenBindings.has(binding)) return false;

  const traced = { ...lookup, seenBindings: new Set([...lookup.seenBindings, binding]) };
  return binding.defs.some((definition) => definitionSpellsNamespace(definition, traced));
};

const carriesWholeModule = (node: ESTree.Expression, lookup: NamespaceLookup): boolean => {
  const written = unwrapSubject(node);
  if (written.type !== "Identifier") return false;

  const binding = resolveBinding(lookup.scopeAt(written), written.name);
  if (binding === null) return false;
  return binding.defs.some((definition) => definition.node.type === "ImportNamespaceSpecifier");
};

export const spellsMockNamespace = (node: ESTree.Expression, lookup: NamespaceLookup): boolean => {
  const written = unwrapSubject(node);
  if (written.type === "MemberExpression") {
    const member = staticMemberName(written);
    if (member === null || !lookup.spellings.has(member)) return false;
    return carriesWholeModule(written.object, lookup);
  }
  if (written.type !== "Identifier") return false;

  const binding = resolveBinding(lookup.scopeAt(written), written.name);
  if (binding === null) return lookup.spellings.has(written.name);
  return bindingSpellsNamespace(binding, lookup);
};

export const spellsImportedBinding = (
  identifier: ESTree.IdentifierReference,
  scopeAt: (node: ESTree.Node) => Scope,
): boolean => {
  const binding = resolveBinding(scopeAt(identifier), identifier.name);
  if (binding === null) return false;
  return binding.defs.some((definition) => IMPORT_BINDING_NODE_TYPES.has(definition.node.type));
};
