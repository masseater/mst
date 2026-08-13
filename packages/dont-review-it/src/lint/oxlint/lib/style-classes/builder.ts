import { resolve } from "node:path";

import { memoize } from "es-toolkit";

import {
  listRepositoryFiles,
  readTextFile,
  type ScannedFile,
} from "../canonical-values/source-files.ts";
import { buildStyleClassIndex, type ReadStyleSheet, type StyleClassIndex } from "./class-index.ts";

const readableFilesIn = (files: readonly ScannedFile[]): readonly ReadStyleSheet[] =>
  files.flatMap((file) => {
    const source = readTextFile(file.absolutePath);
    return source === null ? [] : [{ relativePath: file.relativePath, source }];
  });

const buildRepositoryStyleClassIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): StyleClassIndex => {
  const listed = listRepositoryFiles(resolve(repositoryRoot));
  return buildStyleClassIndex({
    styleSheets: readableFilesIn(listed.styleSheets),
    referenceTexts: readableFilesIn([...listed.commentSources, ...listed.markupSources]).map(
      (file) => file.source,
    ),
  });
};

export const loadStyleClassIndex = memoize(buildRepositoryStyleClassIndex, {
  getCacheKey: (ruleOptions) => resolve(ruleOptions.repositoryRoot),
});
