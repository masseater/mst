import type { Options } from "@oxlint/plugins";

export const listedUnder = (
  options: Readonly<Options>,
  key: string,
): readonly Readonly<Record<string, unknown>>[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return [];

  const listed = first[key];
  if (!Array.isArray(listed)) return [];
  return listed.flatMap((held) =>
    typeof held === "object" && held !== null && !Array.isArray(held) ? [held] : [],
  );
};
