import { staticMemberName } from "./static-names.ts";
import { unwrapSubject } from "./subject-expressions.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const DEFAULT_HOST_OBJECT_TYPES: readonly string[] = ["Request", "Response"];

const DEFAULT_RUNTIME_MODULES: readonly string[] = ["undici"];

const HOST_OBJECT_FACTORY_MEMBERS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["Response", new Set(["error", "json", "redirect"])],
]);

const HOST_OBJECT_TYPES_OPTION = "hostObjectTypes";

const RUNTIME_MODULES_OPTION = "runtimeModules";

export type HostTypeLookup = {
  readonly named: (name: string, at: ESTree.Node) => string | null;
  readonly qualified: (namespace: string, member: string) => string | null;
};

const spelledListFrom = (asked: {
  readonly options: Readonly<Options>;
  readonly key: string;
  readonly fallback: readonly string[];
}): readonly string[] => {
  const [first] = asked.options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return asked.fallback;

  const configured = first[asked.key];
  if (!Array.isArray(configured)) return asked.fallback;

  const spelled = configured.filter(
    (candidate): candidate is string => typeof candidate === "string",
  );
  return spelled.length === 0 ? asked.fallback : spelled;
};

export const hostObjectTypesFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> =>
  new Set(
    spelledListFrom({
      options: ruleOptions,
      key: HOST_OBJECT_TYPES_OPTION,
      fallback: DEFAULT_HOST_OBJECT_TYPES,
    }),
  );

export const runtimeModulesFrom = (ruleOptions: Readonly<Options>): ReadonlySet<string> =>
  new Set(
    spelledListFrom({
      options: ruleOptions,
      key: RUNTIME_MODULES_OPTION,
      fallback: DEFAULT_RUNTIME_MODULES,
    }),
  );

const referencedHostTypeOf = (node: ESTree.Expression, lookup: HostTypeLookup): string | null => {
  const written = unwrapSubject(node);
  if (written.type === "Identifier") return lookup.named(written.name, written);
  if (written.type !== "MemberExpression") return null;

  const member = staticMemberName(written);
  const owner = unwrapSubject(written.object);
  if (member === null || owner.type !== "Identifier") return null;
  return lookup.qualified(owner.name, member);
};

const factoryHostTypeOf = (call: ESTree.CallExpression, lookup: HostTypeLookup): string | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const member = staticMemberName(callee);
  if (member === null) return null;

  const host = referencedHostTypeOf(callee.object, lookup);
  if (host === null) return null;
  return HOST_OBJECT_FACTORY_MEMBERS.get(host)?.has(member) === true ? host : null;
};

export const constructedHostTypeOf = (
  node: ESTree.Expression,
  lookup: HostTypeLookup,
): string | null => {
  const written = unwrapSubject(node);
  if (written.type === "NewExpression") return referencedHostTypeOf(written.callee, lookup);
  if (written.type === "CallExpression") return factoryHostTypeOf(written, lookup);
  return null;
};
