export const SPECIFICATIONS_FILE_NAME = "SPECIFICATIONS.md";

const PROVENANCE_LINE =
  "生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。";

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

const mergedSubjects = (subjects: readonly ListedSubject[]): readonly MergedSubject[] =>
  subjects.reduce<readonly MergedSubject[]>((mergedOnes, listed) => {
    const known = mergedOnes.find((candidate) => candidate.subject === listed.subject);
    if (known === undefined) {
      return [
        ...mergedOnes,
        { subject: listed.subject, claims: listed.claims, sourceFiles: [listed.sourceFile] },
      ];
    }
    return mergedOnes.map((candidate) =>
      candidate === known
        ? {
            subject: candidate.subject,
            claims: [...candidate.claims, ...listed.claims],
            sourceFiles: candidate.sourceFiles.includes(listed.sourceFile)
              ? candidate.sourceFiles
              : [...candidate.sourceFiles, listed.sourceFile],
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
  [
    `# ${input.packageName}`,
    "",
    PROVENANCE_LINE,
    ...mergedSubjects(input.subjects).flatMap((listed) => [
      "",
      `## ${listed.subject}`,
      "",
      sourceLinksOf(listed.sourceFiles),
      "",
      ...listed.claims.map((claim: string) => `- ${claim}`),
    ]),
  ]
    .map((line) => `${line}\n`)
    .join("");
