import type { Options } from "@oxlint/plugins";

export const baseNameOf = (filename: string): string =>
  filename.slice(Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\")) + 1);

export const longestMatchingSuffix = (
  filename: string,
  suffixes: readonly string[],
): string | null =>
  suffixes
    .filter((suffix) => baseNameOf(filename).endsWith(suffix))
    .reduce<string | null>(
      (longest, suffix) => (longest === null || suffix.length > longest.length ? suffix : longest),
      null,
    );

export const stemBefore = (filename: string, suffix: string): string => {
  const base = baseNameOf(filename);
  return base.slice(0, base.length - suffix.length);
};

export const configuredSuffixesFrom = (
  options: Readonly<Options>,
  { optionName, carried }: { readonly optionName: string; readonly carried: readonly string[] },
): readonly string[] => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return carried;

  const configured = first[optionName];
  if (!Array.isArray(configured)) return carried;

  const spelled = configured.filter((entry): entry is string => typeof entry === "string");
  return spelled.length === 0 ? carried : spelled;
};
