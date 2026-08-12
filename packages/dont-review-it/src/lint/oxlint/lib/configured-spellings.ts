import type { Options } from "@oxlint/plugins";

const MOCK_NAMESPACE_OPTION = "mockNamespace";

const DEFAULT_MOCK_NAMESPACE = "vi";

const configuredOptions = (ruleOptions: Readonly<Options>): Record<string, unknown> | null => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return null;
  return first;
};

export const spellingsFrom = (
  ruleOptions: Readonly<Options>,
  named: { readonly option: string; readonly fallback: readonly string[] },
): ReadonlySet<string> => {
  const configured = configuredOptions(ruleOptions)?.[named.option];
  if (!Array.isArray(configured)) return new Set(named.fallback);

  const spelled = configured.filter(
    (candidate): candidate is string => typeof candidate === "string",
  );
  return new Set(spelled.length === 0 ? named.fallback : spelled);
};

const spellingFrom = (
  ruleOptions: Readonly<Options>,
  named: { readonly option: string; readonly fallback: string },
): string => {
  const configured = configuredOptions(ruleOptions)?.[named.option];
  return typeof configured === "string" && configured.length > 0 ? configured : named.fallback;
};

export const mockNamespaceFrom = (ruleOptions: Readonly<Options>): string =>
  spellingFrom(ruleOptions, { option: MOCK_NAMESPACE_OPTION, fallback: DEFAULT_MOCK_NAMESPACE });
