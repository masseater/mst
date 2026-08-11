import { isAstFields, NODE_TYPE_FIELD, type AstFields } from "../ast-node.ts";
import {
  importedDeclarationOf,
  type ImportedName,
  type ModuleDeclarations,
} from "./module-declarations.ts";

export const INJECTED_TEST_HOOK_SPELLINGS: readonly string[] = [
  "afterAll",
  "afterEach",
  "beforeAll",
  "beforeEach",
];

const IDENTIFIER_KIND = "Identifier";

const PROPERTY_KIND = "Property";

const MEMBER_KIND = "MemberExpression";

const readPositionsOf = (node: AstFields): readonly unknown[] => {
  const kind = node[NODE_TYPE_FIELD];
  if (node.computed === true) return Object.values(node);
  if (kind === PROPERTY_KIND) return [node.value];
  if (kind === MEMBER_KIND) return [node.object];
  return Object.values(node);
};

const namesReadWithin = (held: unknown): readonly string[] => {
  if (Array.isArray(held)) return held.flatMap(namesReadWithin);
  if (!isAstFields(held)) return [];
  if (held[NODE_TYPE_FIELD] === IDENTIFIER_KIND) return [String(held.name)];
  return readPositionsOf(held).flatMap(namesReadWithin);
};

const namesReadIn = (declared: unknown): ReadonlySet<string> => new Set(namesReadWithin(declared));

const hookNamesBoundIn = (
  module: ModuleDeclarations,
  hookNames: ReadonlySet<string>,
): ReadonlySet<string> =>
  new Set([
    ...[...hookNames].filter((name) => !module.initializerByName.has(name)),
    ...[...module.importedByName].flatMap(([local, imported]) =>
      hookNames.has(imported.exported) ? [local] : [],
    ),
  ]);

export const reachesTestHook = (reach: {
  readonly from: ModuleDeclarations;
  readonly imported: ImportedName;
  readonly hookNames: ReadonlySet<string>;
  readonly visited: ReadonlySet<string>;
}): boolean => {
  const found = importedDeclarationOf({
    from: reach.from,
    imported: reach.imported,
    visited: reach.visited,
  });
  if (found === null) return false;

  const { declared, module } = found;
  const read = namesReadIn(declared);
  const bound = hookNamesBoundIn(module, reach.hookNames);
  if ([...read].some((name) => bound.has(name))) return true;

  const visited = new Set([...reach.visited, module.filename]);
  return [...read].some((name) => {
    const imported = module.importedByName.get(name);
    if (imported === undefined) return false;
    return reachesTestHook({ from: module, imported, hookNames: reach.hookNames, visited });
  });
};
