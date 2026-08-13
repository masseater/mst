import { attempt } from "es-toolkit";

import { readTextFile } from "./source-files.ts";

const parseJson: (text: string) => unknown = JSON.parse;

export const readJsonFile = (path: string): unknown => {
  const writtenText = readTextFile(path);
  if (writtenText === null) return null;

  const [unparsableText, parsedNode] = attempt(() => parseJson(writtenText));
  if (unparsableText === null) return parsedNode;
  throw new Error(`${path} exists but does not parse as JSON`, { cause: unparsableText });
};
