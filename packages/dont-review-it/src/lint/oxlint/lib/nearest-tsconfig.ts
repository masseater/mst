import { dirname, join } from "node:path";

import { parse } from "jsonc-parser";

import { readTextFile } from "./canonical-values/source-files.ts";

export type TsconfigExtends = {
  readonly tsconfigPath: string;
  readonly specifiers: readonly string[];
};

export const TSCONFIG_FILE_NAME = "tsconfig.json";

export const parseJsonc: (text: string) => unknown = parse;

const specifiersOf = (config: unknown): readonly string[] => {
  if (typeof config !== "object" || config === null) return [];
  const declared: unknown = (config as Record<string, unknown>).extends;
  if (typeof declared === "string") return [declared];
  if (!Array.isArray(declared)) return [];
  return declared.filter((listed: unknown): listed is string => typeof listed === "string");
};

const extendsByDirectory = new Map<string, TsconfigExtends | null>();

const declaredIn = (directory: string): TsconfigExtends | null => {
  const candidatePath = join(directory, TSCONFIG_FILE_NAME);
  const writtenText = readTextFile(candidatePath);
  if (writtenText === null) return null;
  return { tsconfigPath: candidatePath, specifiers: specifiersOf(parseJsonc(writtenText)) };
};

const nearestFrom = (directory: string): TsconfigExtends | null => {
  const remembered = extendsByDirectory.get(directory);
  if (remembered !== undefined) return remembered;

  const parent = dirname(directory);
  const found = declaredIn(directory) ?? (parent === directory ? null : nearestFrom(parent));
  extendsByDirectory.set(directory, found);
  return found;
};

export const nearestTsconfigExtends = (filename: string): TsconfigExtends | null =>
  nearestFrom(dirname(filename));

export const extendsOneOf = (
  specifiers: readonly string[],
  allowedSuffixes: readonly string[],
): boolean =>
  specifiers.some((specifier) => allowedSuffixes.some((suffix) => specifier.endsWith(suffix)));
