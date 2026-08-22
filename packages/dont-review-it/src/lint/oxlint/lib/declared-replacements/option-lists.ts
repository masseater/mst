import type { Options } from "@oxlint/plugins";

export const listedUnder = (
  ruleOptions: Readonly<Options>,
  named: string,
): readonly Readonly<Record<string, unknown>>[] => {
  const [first] = ruleOptions;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];

  const listed = first[named];
  if (!Array.isArray(listed)) return [];
  return listed.flatMap((held) =>
    typeof held === "object" && held !== null && !Array.isArray(held) ? [held] : [],
  );
};
