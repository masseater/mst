import type { Options } from "@oxlint/plugins";
import type { ForbiddenNamePattern } from "../forbidden-ambiguous-names.ts";

const FORBIDDEN_SUBJECT_NAMES_OPTION = "forbiddenSubjectNames";

const patternEntry = (entry: unknown): ForbiddenNamePattern | null => {
  if (typeof entry !== "object" || entry === null || !("pattern" in entry)) return null;

  const { pattern } = entry;
  return typeof pattern === "string" ? { pattern } : null;
};

export const forbiddenSubjectNamesFrom = (
  options: Readonly<Options>,
): readonly ForbiddenNamePattern[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];

  const configured = first[FORBIDDEN_SUBJECT_NAMES_OPTION];
  if (!Array.isArray(configured)) return [];
  return configured.flatMap((entry) => patternEntry(entry) ?? []);
};
