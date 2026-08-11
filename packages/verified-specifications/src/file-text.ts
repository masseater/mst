import { readFile } from "node:fs/promises";

import { attemptAsync } from "es-toolkit";

const isAbsence = (failure: unknown): boolean =>
  failure instanceof Error &&
  "code" in failure &&
  (failure.code === "ENOENT" || failure.code === "ENOTDIR");

export const fileTextOrNull = async (path: string): Promise<string | null> => {
  const [failure, text] = await attemptAsync<string, Error>(async () => readFile(path, "utf-8"));
  if (text !== null) return text;
  if (isAbsence(failure)) return null;
  throw failure;
};
