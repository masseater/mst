import { toLines } from "@mst/utils";

import type { SpecificationSubject } from "../extract/claims.ts";

export const SPECIFICATIONS_FILE_NAME = "SPECIFICATIONS.md";

const PROVENANCE_LINE =
  "生成物。`vp run guard:fix` が `specs/` の仕様担保テストから再生成する。手で編集しない。";

const mergedSubjects = (
  subjects: readonly SpecificationSubject[],
): readonly SpecificationSubject[] =>
  subjects.reduce<readonly SpecificationSubject[]>((merged, entry) => {
    const known = merged.find((candidate) => candidate.subject === entry.subject);
    if (known === undefined) return [...merged, entry];
    return merged.map((candidate) =>
      candidate === known
        ? { subject: candidate.subject, claims: [...candidate.claims, ...entry.claims] }
        : candidate,
    );
  }, []);

export const renderSpecificationsDocument = (input: {
  readonly packageName: string;
  readonly subjects: readonly SpecificationSubject[];
}): string =>
  toLines([
    `# ${input.packageName}`,
    "",
    PROVENANCE_LINE,
    ...mergedSubjects(input.subjects).flatMap((entry) => [
      "",
      `## ${entry.subject}`,
      "",
      ...entry.claims.map((claim) => `- ${claim}`),
    ]),
  ]);
