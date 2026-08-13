import type { Options } from "@oxlint/plugins";
import type { ForbiddenNamePattern } from "../forbidden-ambiguous-names.ts";

const FORBIDDEN_SUBJECT_NAMES_OPTION = "forbiddenSubjectNames";

const patternEntry = (listed: unknown): ForbiddenNamePattern | null => {
  if (typeof listed !== "object" || listed === null || !("pattern" in listed)) return null;

  const { pattern } = listed;
  return typeof pattern === "string" ? { pattern } : null;
};

export const forbiddenSubjectNamesFrom = (
  ruleOptions: Readonly<Options>,
): readonly ForbiddenNamePattern[] => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];

  const configured = first[FORBIDDEN_SUBJECT_NAMES_OPTION];
  if (!Array.isArray(configured)) return [];
  return configured.flatMap((listed) => patternEntry(listed) ?? []);
};
