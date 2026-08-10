import { attempt } from "es-toolkit";

import { readTextFile } from "./source-files.ts";

const parseJson: (text: string) => unknown = JSON.parse;

export const readJsonFile = (path: string): unknown => {
  const text = readTextFile(path);
  if (text === null) return null;

  const [unparsableText, parsed] = attempt(() => parseJson(text));
  if (unparsableText === null) return parsed;
  throw new Error(`${path} exists but does not parse as JSON`, { cause: unparsableText });
};
