import { optionsRecord } from "./rule-options.ts";

import type { Options } from "@oxlint/plugins";

export const spellingsFrom = (
  ruleConfiguration: Readonly<Options>,
  named: { readonly option: string; readonly fallback: readonly string[] },
): ReadonlySet<string> => {
  const configured = optionsRecord(ruleConfiguration)?.[named.option];
  if (!Array.isArray(configured)) return new Set(named.fallback);

  const spelled = configured.filter((spelling): spelling is string => typeof spelling === "string");
  return new Set(spelled.length === 0 ? named.fallback : spelled);
};

const spellingFrom = (
  ruleConfiguration: Readonly<Options>,
  named: { readonly option: string; readonly fallback: string },
): string => {
  const configured = optionsRecord(ruleConfiguration)?.[named.option];
  return typeof configured === "string" && configured.length > 0 ? configured : named.fallback;
};

const MOCK_NAMESPACE_OPTION = "mockNamespace";

const DEFAULT_MOCK_NAMESPACE = "vi";

export const mockNamespaceFrom = (ruleConfiguration: Readonly<Options>): string =>
  spellingFrom(ruleConfiguration, {
    option: MOCK_NAMESPACE_OPTION,
    fallback: DEFAULT_MOCK_NAMESPACE,
  });
