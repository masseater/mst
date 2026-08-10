import { lstat, readFile } from "node:fs/promises";

import type { Stats } from "node:fs";

export const statOrNull = async (absolutePath: string): Promise<Stats | null> => {
  try {
    return await lstat(absolutePath);
  } catch {
    return null;
  }
};

export const readTextOrNull = async (absolutePath: string): Promise<string | null> => {
  try {
    return await readFile(absolutePath, "utf-8");
  } catch {
    return null;
  }
};

export const readJsonObjectOrNull = async (
  absolutePath: string,
): Promise<Record<string, unknown> | null> => {
  const raw = await readTextOrNull(absolutePath);
  if (raw === null) return null;

  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  return parsed as Record<string, unknown>;
};

export const nonEmptyStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};
