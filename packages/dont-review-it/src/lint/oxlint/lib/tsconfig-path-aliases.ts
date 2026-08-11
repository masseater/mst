import { dirname, isAbsolute, join, resolve } from "node:path";

import { readTextFile } from "./canonical-values/source-files.ts";
import { listedTexts } from "./listed-texts.ts";
import { parseJsonc, TSCONFIG_FILE_NAME } from "./nearest-tsconfig.ts";

const WILDCARD = "*";

const PLACE_NAMING_SPECIFIER = /^(?:\.{1,2}\/|#)/u;

type PathAliases = {
  readonly baseDirectory: string;
  readonly patternTargets: ReadonlyMap<string, readonly string[]>;
};

const recordOf = (held: unknown): Readonly<Record<string, unknown>> | null =>
  typeof held === "object" && held !== null && !Array.isArray(held)
    ? (held as Readonly<Record<string, unknown>>)
    : null;

const textOf = (held: unknown): string | null => (typeof held === "string" ? held : null);

const aliasesIn = (
  configPath: string,
  config: Readonly<Record<string, unknown>>,
): PathAliases | null => {
  const compilerOptions = recordOf(config.compilerOptions);
  const declared = compilerOptions === null ? null : recordOf(compilerOptions.paths);
  if (compilerOptions === null || declared === null) return null;

  const baseUrl = textOf(compilerOptions.baseUrl) ?? ".";
  const patternTargets = new Map(
    Object.entries(declared).map(([pattern, held]) => [pattern, listedTexts(held)] as const),
  );
  return { baseDirectory: resolve(dirname(configPath), baseUrl), patternTargets };
};

const inheritedSpecifiersOf = (config: Readonly<Record<string, unknown>>): readonly string[] => {
  const declared = config.extends;
  if (typeof declared === "string") return [declared];
  return listedTexts(declared);
};

const aliasesAt = (configPath: string, visited: ReadonlySet<string>): PathAliases | null => {
  if (visited.has(configPath)) return null;
  const text = readTextFile(configPath);
  const config = text === null ? null : recordOf(parseJsonc(text));
  if (config === null) return null;

  const own = aliasesIn(configPath, config);
  if (own !== null) return own;

  const followed = new Set([...visited, configPath]);
  return (
    inheritedSpecifiersOf(config)
      .filter((specifier) => PLACE_NAMING_SPECIFIER.test(specifier))
      .map((specifier) => aliasesAt(resolve(dirname(configPath), specifier), followed))
      .find((found) => found !== null) ?? null
  );
};

const aliasesByDirectory = new Map<string, PathAliases | null>();

const nearestAliasesFrom = (directory: string): PathAliases | null => {
  const remembered = aliasesByDirectory.get(directory);
  if (remembered !== undefined) return remembered;

  const parent = dirname(directory);
  const found =
    aliasesAt(join(directory, TSCONFIG_FILE_NAME), new Set()) ??
    (parent === directory ? null : nearestAliasesFrom(parent));
  aliasesByDirectory.set(directory, found);
  return found;
};

const filledTarget = (target: string, captured: string): string =>
  target.replace(WILDCARD, captured);

const capturedBy = (pattern: string, specifier: string): string | null => {
  const [prefix, suffix, ...extraParts] = pattern.split(WILDCARD);
  if (prefix === undefined || extraParts.length > 0) return null;
  if (suffix === undefined) return specifier === pattern ? "" : null;

  const shortest = prefix.length + suffix.length;
  if (specifier.length < shortest) return null;
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return null;
  return specifier.slice(prefix.length, specifier.length - suffix.length);
};

type MatchedAlias = {
  readonly prefixLength: number;
  readonly captured: string;
  readonly targets: readonly string[];
};

const prefixLengthOf = (pattern: string): number => {
  const wildcardAt = pattern.indexOf(WILDCARD);
  return wildcardAt === -1 ? pattern.length : wildcardAt;
};

const matchedAliasesIn = (aliases: PathAliases, specifier: string): readonly MatchedAlias[] =>
  [...aliases.patternTargets].flatMap(([pattern, targets]) => {
    const captured = capturedBy(pattern, specifier);
    return captured === null ? [] : [{ prefixLength: prefixLengthOf(pattern), captured, targets }];
  });

const longestMatchOf = (matched: readonly MatchedAlias[]): MatchedAlias | null =>
  matched.reduce<MatchedAlias | null>(
    (longest, entry) =>
      longest === null || entry.prefixLength > longest.prefixLength ? entry : longest,
    null,
  );

export const aliasedPathsFor = ({
  specifier,
  fromFile,
}: {
  readonly specifier: string;
  readonly fromFile: string;
}): readonly string[] => {
  if (PLACE_NAMING_SPECIFIER.test(specifier) || isAbsolute(specifier)) return [];

  const aliases = nearestAliasesFrom(dirname(fromFile));
  if (aliases === null) return [];

  const matched = longestMatchOf(matchedAliasesIn(aliases, specifier));
  if (matched === null) return [];

  return matched.targets.map((target) =>
    resolve(aliases.baseDirectory, filledTarget(target, matched.captured)),
  );
};
