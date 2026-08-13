import type { Options } from "@oxlint/plugins";

export const optionsRecord = (
  options: Readonly<Options>,
): Readonly<Record<string, unknown>> | null => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return null;
  return first;
};
