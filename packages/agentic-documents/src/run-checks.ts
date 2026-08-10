import { rationaleOnActionLine } from "./checks/action-is-one-sentence.ts";
import { companionFileProblems } from "./checks/companion-files.ts";
import { contrastiveCodePairs } from "./checks/contrastive-code-pair.ts";
import { repeatedConditions } from "./checks/duplicate-condition.ts";
import { duplicatedNormativeUnits } from "./checks/duplicate-normative-units.ts";
import { frontmatterProblems } from "./checks/frontmatter-description.ts";
import { tablesInNormativeDocument } from "./checks/no-table.ts";
import { missingNormativeDocuments } from "./checks/normative-document-coverage.ts";
import { brokenOrderedSequences } from "./checks/ordered-sequence.ts";
import { negatedKeywordSpellings } from "./checks/prohibition-spelling.ts";
import { brokenReferences } from "./checks/reference-targets.ts";
import { multipleDecisionKeywords } from "./checks/single-decision-keyword.ts";
import { versionLiteralsInProse } from "./checks/version-in-prose.ts";
import { workspaceListProblems } from "./checks/workspace-list.ts";
import { loadNormativeDocuments } from "./scan/load-normative-documents.ts";

import type { AgenticDocumentsConfig } from "./config.ts";
import type { DocumentProblem } from "./problem.ts";
import type { NormativeDocument } from "./scan/normative-documents.ts";

const syntacticProblems = ({
  document,
  config,
}: {
  readonly document: NormativeDocument;
  readonly config: AgenticDocumentsConfig;
}): readonly DocumentProblem[] => [
  ...tablesInNormativeDocument(document),
  ...multipleDecisionKeywords({ document, config }),
  ...negatedKeywordSpellings({ document, config }),
  ...rationaleOnActionLine({ document, config }),
  ...repeatedConditions(document),
  ...brokenOrderedSequences({ document, config }),
  ...versionLiteralsInProse({ document, config }),
  ...contrastiveCodePairs({ document, config }),
];

const byLocation = (left: DocumentProblem, right: DocumentProblem): number =>
  left.file === right.file
    ? (left.line ?? 0) - (right.line ?? 0)
    : left.file.localeCompare(right.file);

export const runChecks = async ({
  repositoryRoot,
  config,
  write,
}: {
  readonly repositoryRoot: string;
  readonly config: AgenticDocumentsConfig;
  readonly write: boolean;
}): Promise<readonly DocumentProblem[]> => {
  const documents = await loadNormativeDocuments({ repositoryRoot, config });

  const perDocument = await Promise.all(
    documents.map(
      async (document): Promise<readonly DocumentProblem[]> => [
        ...syntacticProblems({ document, config }),
        ...(await frontmatterProblems({ repositoryRoot, document, config })),
        ...(await brokenReferences({ repositoryRoot, document, config })),
      ],
    ),
  );

  const acrossDocuments = [
    ...duplicatedNormativeUnits({ documents, config }),
    ...(await missingNormativeDocuments({ repositoryRoot, config })),
    ...(await companionFileProblems({ repositoryRoot, documents, config })),
    ...(await workspaceListProblems({ repositoryRoot, config, write })),
  ];

  return [...perDocument.flat(), ...acrossDocuments].toSorted(byLocation);
};
