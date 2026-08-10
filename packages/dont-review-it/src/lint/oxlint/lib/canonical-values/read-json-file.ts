import { readTextFile } from "./source-files.ts";

export const parseJson: (text: string) => unknown = JSON.parse;

export const readJsonFile = (path: string): unknown => {
  const text = readTextFile(path);
  if (text === null) return null;
  try {
    return parseJson(text);
  } catch {
    return null;
  }
};
