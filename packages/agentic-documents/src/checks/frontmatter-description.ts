import { dirname, join } from "node:path";

import { parse } from "yaml";

import { nonEmptyStringOrNull, readJsonObjectOrNull } from "../scan/read-file.ts";

import type { AgenticDocumentsConfig } from "../config.ts";
import type { DocumentProblem } from "../problem.ts";
import type { NormativeDocument } from "../scan/normative-documents.ts";

const MISSING_FRONTMATTER =
  "規範文書に前置きが無い。文書の先頭に区切り行で囲んだ前置きを置き、必須の項目を書く。一覧を機械で組むために、説明が同じ位置に同じ形である必要がある。";

const missingField = (field: string): string =>
  `前置きの項目 \`${field}\` が無いか、値が空である。値を書く。`;

const mismatch = ({
  field,
  inDocument,
  inManifest,
}: {
  readonly field: string;
  readonly inDocument: string;
  readonly inManifest: string;
}): string =>
  `前置きの \`${field}\` とマニフェストの説明が一致していない。前置き: "${inDocument}" / マニフェスト: "${inManifest}"。どちらが正しいかを決め、両方を同じ値に揃える。`;

const frontmatterOf = (document: NormativeDocument): Record<string, unknown> | null => {
  const [first] = document.tree.children;
  if (first?.type !== "yaml") return null;

  const parsedNode: unknown = parse(first.value);
  if (typeof parsedNode !== "object" || parsedNode === null || Array.isArray(parsedNode))
    return null;

  return parsedNode as Record<string, unknown>;
};

const manifestDescriptionOf = async ({
  repositoryRoot,
  documentFile,
}: {
  readonly repositoryRoot: string;
  readonly documentFile: string;
}): Promise<string | null> => {
  const manifest = await readJsonObjectOrNull(
    join(repositoryRoot, dirname(documentFile), "package.json"),
  );

  return manifest === null ? null : nonEmptyStringOrNull(manifest.description);
};

const missingFieldProblems = ({
  document,
  frontmatter,
  config,
}: {
  readonly document: NormativeDocument;
  readonly frontmatter: Record<string, unknown>;
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] =>
  config.requiredFrontmatterFields
    .filter((field) => nonEmptyStringOrNull(frontmatter[field]) === null)
    .map((field) => ({ file: document.file, line: 1, message: missingField(field) }));

const mismatchProblems = async ({
  repositoryRoot,
  document,
  frontmatter,
  config,
}: {
  readonly repositoryRoot: string;
  readonly document: NormativeDocument;
  readonly frontmatter: Record<string, unknown>;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const [descriptionField] = config.requiredFrontmatterFields;
  if (descriptionField === undefined) return [];

  const inDocument = nonEmptyStringOrNull(frontmatter[descriptionField]);
  const inManifest = await manifestDescriptionOf({ repositoryRoot, documentFile: document.file });
  if (inDocument === null || inManifest === null || inDocument === inManifest) return [];

  return [
    {
      file: document.file,
      line: 1,
      message: mismatch({ field: descriptionField, inDocument, inManifest }),
    },
  ];
};

export const frontmatterProblems = async ({
  repositoryRoot,
  document,
  config,
}: {
  readonly repositoryRoot: string;
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): Promise<readonly DocumentProblem[]> => {
  const frontmatter = frontmatterOf(document);
  if (frontmatter === null) {
    return [{ file: document.file, line: 1, message: MISSING_FRONTMATTER }];
  }

  const missing = missingFieldProblems({ document, frontmatter, config });
  if (missing.length > 0) return missing;

  return mismatchProblems({ repositoryRoot, document, frontmatter, config });
};
