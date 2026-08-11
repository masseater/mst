import { toLines } from "@mst/utils";

export const SPECIFICATIONS_FILE_NAME = "SPECIFICATIONS.md";

export type ListedSubject = {
  readonly subject: string;
  readonly claims: readonly string[];
  readonly sourceFile: string;
};

type MergedSubject = {
  readonly subject: string;
  readonly claims: readonly string[];
  readonly sourceFiles: readonly string[];
};

const PROVENANCE_LINE =
  "生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。";

const mergedSubjects = (subjects: readonly ListedSubject[]): readonly MergedSubject[] =>
  subjects.reduce<readonly MergedSubject[]>((merged, entry) => {
    const known = merged.find((candidate) => candidate.subject === entry.subject);
    if (known === undefined) {
      return [
        ...merged,
        { subject: entry.subject, claims: entry.claims, sourceFiles: [entry.sourceFile] },
      ];
    }
    return merged.map((candidate) =>
      candidate === known
        ? {
            subject: candidate.subject,
            claims: [...candidate.claims, ...entry.claims],
            sourceFiles: candidate.sourceFiles.includes(entry.sourceFile)
              ? candidate.sourceFiles
              : [...candidate.sourceFiles, entry.sourceFile],
          }
        : candidate,
    );
  }, []);

const sourceLinksOf = (sourceFiles: readonly string[]): string =>
  sourceFiles.map((file) => `[\`${file}\`](${file})`).join(", ");

export const renderSpecificationsDocument = (input: {
  readonly packageName: string;
  readonly subjects: readonly ListedSubject[];
}): string =>
  toLines([
    `# ${input.packageName}`,
    "",
    PROVENANCE_LINE,
    ...mergedSubjects(input.subjects).flatMap((entry) => [
      "",
      `## ${entry.subject}`,
      "",
      sourceLinksOf(entry.sourceFiles),
      "",
      ...entry.claims.map((claim) => `- ${claim}`),
    ]),
  ]);
