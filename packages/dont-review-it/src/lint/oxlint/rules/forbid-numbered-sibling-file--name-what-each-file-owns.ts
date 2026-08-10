import { readdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

const ORDINAL_NAME_PATTERN = /^(?<prefix>.+[-_])\d+$/u;

const entriesByDirectory = new Map<string, readonly string[]>();

const directoryEntries = (directory: string): readonly string[] => {
  const remembered = entriesByDirectory.get(directory);
  if (remembered !== undefined) return remembered;

  const found: readonly string[] = readdirSync(directory);
  entriesByDirectory.set(directory, found);
  return found;
};

const baseNameOf = (fileName: string): string => fileName.split(".").slice(0, 1).join("");

const ordinalPrefixOf = (fileName: string): string | null =>
  ORDINAL_NAME_PATTERN.exec(baseNameOf(fileName))?.groups?.prefix ?? null;

const isSplitSibling = (input: {
  readonly entryName: string;
  readonly ownBaseName: string;
  readonly prefix: string;
}): boolean => {
  const { entryName, ownBaseName, prefix } = input;
  const entryBaseName = baseNameOf(entryName);
  if (entryBaseName === ownBaseName) return false;
  if (entryBaseName === prefix.slice(0, -1)) return true;
  return ordinalPrefixOf(entryName) === prefix;
};

const splitSiblingOf = (filePath: string): string | null => {
  const fileName = filePath.split(sep).slice(-1).join("");
  const prefix = ordinalPrefixOf(fileName);
  if (prefix === null) return null;

  const ownBaseName = baseNameOf(fileName);
  return (
    directoryEntries(dirname(filePath)).find((entryName) =>
      isSplitSibling({ entryName, ownBaseName, prefix }),
    ) ?? null
  );
};

export const forbidNumberedSiblingFile = createDontReviewItRule({
  name: "forbid-numbered-sibling-file--name-what-each-file-owns",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow splitting a file into siblings distinguished only by a number, so every file name states the responsibility that file owns",
      relatedGuidelines: [],
    },
    messages: {
      numberedSiblingFile:
        "Splitting a file into siblings that differ only by a number is forbidden, because the number names nothing, and a reader looking for one behaviour has to open every one of them to find where it went. `{{sibling}}` sits in this directory under the same name with a different number, so the responsibility both files share is still exactly one responsibility spread over two places. List what each file owns and name it after that. If listing produces one entry, the split bought nothing: put the declarations back into one file and reduce what it does instead of dividing it again.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node: ESTree.Program) {
        const sibling = splitSiblingOf(resolve(context.cwd, context.filename));
        if (sibling === null) return;
        context.report({ node, messageId: "numberedSiblingFile", data: { sibling } });
      },
    };
  },
});
