import type { LibraryVocabularyIndex } from "./vocabulary-index.ts";

export type LibraryVocabularyLoader = (options: {
  readonly filename: string;
  readonly repositoryRoot: string;
}) => LibraryVocabularyIndex;
