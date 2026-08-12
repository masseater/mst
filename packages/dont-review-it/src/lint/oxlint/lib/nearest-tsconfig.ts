import { dirname, join } from "node:path";

import { memoize } from "es-toolkit";
import { parse } from "jsonc-parser";

import { readTextFile } from "./canonical-values/source-files.ts";
import { isNamedFields } from "./named-fields.ts";

export type TsconfigExtends = {
  readonly tsconfigPath: string;
  readonly specifiers: readonly string[];
};

export const TSCONFIG_FILE_NAME = "tsconfig.json";

export const parseJsonc: (text: string) => unknown = parse;

const specifiersOf = (config: unknown): readonly string[] => {
  if (!isNamedFields(config)) return [];
  const declared = config.extends;
  if (typeof declared === "string") return [declared];
  if (!Array.isArray(declared)) return [];
  return declared.filter((entry: unknown): entry is string => typeof entry === "string");
};

const declaredIn = (directory: string): TsconfigExtends | null => {
  const candidatePath = join(directory, TSCONFIG_FILE_NAME);
  const text = readTextFile(candidatePath);
  if (text === null) return null;
  return { tsconfigPath: candidatePath, specifiers: specifiersOf(parseJsonc(text)) };
};

const nearestFrom: (directory: string) => TsconfigExtends | null = memoize(
  (directory: string): TsconfigExtends | null => {
    const parent = dirname(directory);
    return declaredIn(directory) ?? (parent === directory ? null : nearestFrom(parent));
  },
);

export const nearestTsconfigExtends = (filename: string): TsconfigExtends | null =>
  nearestFrom(dirname(filename));

export const extendsOneOf = (
  specifiers: readonly string[],
  allowedSuffixes: readonly string[],
): boolean =>
  specifiers.some((specifier) => allowedSuffixes.some((suffix) => specifier.endsWith(suffix)));
