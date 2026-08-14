import { dirname, isAbsolute, join, resolve } from "node:path";

import { maxBy, memoize } from "es-toolkit";

import { readTextFile } from "./canonical-values/source-files.ts";
import { listedTexts } from "./listed-texts.ts";
import { namedFieldsOf } from "./named-fields.ts";
import { parseJsonc, TSCONFIG_FILE_NAME } from "./nearest-tsconfig.ts";

const PLACE_NAMING_SPECIFIER = /^(?:\.{1,2}\/|#)/u;

type PathAliases = {
  readonly baseDirectory: string;
  readonly patternTargets: ReadonlyMap<string, readonly string[]>;
};

const textOf = (held: unknown): string | null => (typeof held === "string" ? held : null);

const aliasesIn = (
  configPath: string,
  config: Readonly<Record<string, unknown>>,
): PathAliases | null => {
  const compilerOptions = namedFieldsOf(config.compilerOptions);
  const declared = compilerOptions === null ? null : namedFieldsOf(compilerOptions.paths);
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
  const configJsonc = readTextFile(configPath);
  const config = configJsonc === null ? null : namedFieldsOf(parseJsonc(configJsonc));
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

const nearestAliasesFrom: (directory: string) => PathAliases | null = memoize(
  (directory: string): PathAliases | null => {
    const parent = dirname(directory);
    return (
      aliasesAt(join(directory, TSCONFIG_FILE_NAME), new Set()) ??
      (parent === directory ? null : nearestAliasesFrom(parent))
    );
  },
);

const WILDCARD = "*";

const filledTarget = (pathTemplate: string, captured: string): string =>
  pathTemplate.replace(WILDCARD, captured);

const capturedBy = (pattern: string, specifier: string): string | null => {
  const [prefix, suffix, ...extraParts] = pattern.split(WILDCARD);
  if (prefix === undefined || extraParts.length > 0) return null;
  if (suffix === undefined) return specifier === pattern ? "" : null;

  const shortest = prefix.length + suffix.length;
  if (specifier.length < shortest) return null;
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return null;
  return specifier.slice(prefix.length, specifier.length - suffix.length);
};

const prefixLengthOf = (pattern: string): number => {
  const wildcardAt = pattern.indexOf(WILDCARD);
  return wildcardAt === -1 ? pattern.length : wildcardAt;
};

const matchedAliasesIn = (
  aliases: PathAliases,
  specifier: string,
): readonly {
  readonly prefixLength: number;
  readonly captured: string;
  readonly pathTemplates: readonly string[];
}[] =>
  [...aliases.patternTargets].flatMap(([pattern, pathTemplates]) => {
    const captured = capturedBy(pattern, specifier);
    return captured === null
      ? []
      : [{ prefixLength: prefixLengthOf(pattern), captured, pathTemplates }];
  });

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

  const matched = maxBy(
    matchedAliasesIn(aliases, specifier),
    (matchedAlias) => matchedAlias.prefixLength,
  );
  if (matched === undefined) return [];

  return matched.pathTemplates.map((pathTemplate) =>
    resolve(aliases.baseDirectory, filledTarget(pathTemplate, matched.captured)),
  );
};
