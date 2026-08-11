import type { Options } from "@oxlint/plugins";

const MOCK_NAMESPACE_OPTION = "mockNamespace";

const DEFAULT_MOCK_NAMESPACE = "vi";

const configuredOptions = (options: Readonly<Options>): Record<string, unknown> | null => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return null;
  return first;
};

export const spellingsFrom = (
  options: Readonly<Options>,
  named: { readonly option: string; readonly fallback: readonly string[] },
): ReadonlySet<string> => {
  const configured = configuredOptions(options)?.[named.option];
  if (!Array.isArray(configured)) return new Set(named.fallback);

  const spelled = configured.filter((entry): entry is string => typeof entry === "string");
  return new Set(spelled.length === 0 ? named.fallback : spelled);
};

const spellingFrom = (
  options: Readonly<Options>,
  named: { readonly option: string; readonly fallback: string },
): string => {
  const configured = configuredOptions(options)?.[named.option];
  return typeof configured === "string" && configured.length > 0 ? configured : named.fallback;
};

export const mockNamespaceFrom = (options: Readonly<Options>): string =>
  spellingFrom(options, { option: MOCK_NAMESPACE_OPTION, fallback: DEFAULT_MOCK_NAMESPACE });
