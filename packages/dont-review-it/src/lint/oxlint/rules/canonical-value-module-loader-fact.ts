import { uniqBy } from "es-toolkit";

import type { ESTree } from "@oxlint/plugins";

export type ModuleCallableFact = {
  readonly boundFirst: ESTree.Expression | null;
  readonly kind: symbol;
};

export type ModuleLoaderInvocation = {
  readonly argumentArray: ESTree.Expression | null;
  readonly bind: boolean;
  readonly directArguments: readonly ESTree.Argument[] | null;
  readonly target: ESTree.Expression;
};

export const CREATE_REQUIRE = Symbol();
export const COMMONJS_MODULE = Symbol();
export const GET_BUILTIN_MODULE = Symbol();
export const IMPORT_META = Symbol();
export const MODULE_LOADER = Symbol();
export const MODULE_RESOLVER = Symbol();
export const NODE_MODULE = Symbol();
export const PROCESS_GLOBAL = Symbol();
export const REFLECT_GLOBAL = Symbol();
export const REFLECT_CONSTRUCT = Symbol();

const FACT_KIND_KEYS: ReadonlyMap<symbol, number> = new Map([
  [CREATE_REQUIRE, 0],
  [MODULE_LOADER, 1],
  [COMMONJS_MODULE, 2],
  [GET_BUILTIN_MODULE, 3],
  [IMPORT_META, 4],
  [MODULE_RESOLVER, 5],
  [NODE_MODULE, 6],
  [PROCESS_GLOBAL, 7],
  [REFLECT_GLOBAL, 8],
  [REFLECT_CONSTRUCT, 9],
]);

const factKindKey = (fact: ModuleCallableFact): number =>
  FACT_KIND_KEYS.get(fact.kind) ?? FACT_KIND_KEYS.size;

const factKey = (fact: ModuleCallableFact): string =>
  `${factKindKey(fact)}:${fact.boundFirst?.start ?? "none"}:${fact.boundFirst?.end ?? "none"}`;

export const uniqueModuleCallableFacts = (
  facts: readonly ModuleCallableFact[],
): readonly ModuleCallableFact[] => uniqBy(facts, factKey);
