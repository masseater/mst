import { readdir, readFile, lstat } from "node:fs/promises";

import { isPlainObject } from "es-toolkit";

import type { Stats } from "node:fs";

const NOT_FOUND_CODE = "ENOENT";

const NOT_A_DIRECTORY_CODE = "ENOTDIR";

const ABSENT_CODES: ReadonlySet<string> = new Set([NOT_FOUND_CODE, NOT_A_DIRECTORY_CODE]);

const isAbsent = (failure: unknown): boolean =>
  failure instanceof Error &&
  "code" in failure &&
  typeof failure.code === "string" &&
  ABSENT_CODES.has(failure.code);

export const statOrNull = async (absolutePath: string): Promise<Stats | null> => {
  try {
    return await lstat(absolutePath);
  } catch (failure) {
    if (isAbsent(failure)) return null;
    throw failure;
  }
};

export const directoryNamesIn = async (absolutePath: string): Promise<readonly string[]> => {
  try {
    const directoryChildren = await readdir(absolutePath, { withFileTypes: true });
    return directoryChildren
      .filter((directoryChild) => directoryChild.isDirectory())
      .map((subdirectory) => subdirectory.name);
  } catch (failure) {
    if (isAbsent(failure)) return [];
    throw failure;
  }
};

export const readTextOrNull = async (absolutePath: string): Promise<string | null> => {
  try {
    return await readFile(absolutePath, "utf-8");
  } catch (failure) {
    if (isAbsent(failure)) return null;
    throw failure;
  }
};

export const readJsonObjectOrNull = async (
  absolutePath: string,
): Promise<Record<string, unknown> | null> => {
  const raw = await readTextOrNull(absolutePath);
  if (raw === null) return null;

  const parsedJson: unknown = JSON.parse(raw);
  return isPlainObject(parsedJson) ? parsedJson : null;
};

export const nonEmptyStringOrNull = (candidateString: unknown): string | null => {
  if (typeof candidateString !== "string") return null;

  const trimmed = candidateString.trim();
  return trimmed === "" ? null : trimmed;
};
