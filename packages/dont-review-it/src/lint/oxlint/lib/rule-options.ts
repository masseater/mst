import type { Options } from "@oxlint/plugins";

export const optionsRecord = (
  ruleConfiguration: Readonly<Options>,
): Readonly<Record<string, unknown>> | null => {
  const [first] = ruleConfiguration;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return null;
  return first;
};
