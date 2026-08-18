import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  DOCUMENT_SUFFIX,
  normativeDocumentPlacesIn,
  normativeDocumentsIn,
  type NormativeDocumentPlaces,
} from "@mst/repository-checks";

import { lintRuleWorkspacesIn, type LintRuleWorkspace } from "./lint-rule-workspaces.ts";
import { workspaceRulesOf } from "./workspace-rules.ts";

import type { LintRuleCheckReport, LintRuleProblem } from "../lint-rule-problem.ts";
import type { BundledLintRule } from "./rule-bundle.ts";

const NO_PLACE_DECLARED = `A repository whose rules stand on documents must not go without declaring where those documents live. Write \`normativeDocuments\` in the root manifest, naming the file every location is read through and the directories that hold the norms.`;

const absent = (declaredPath: string): string =>
  `A rule must not name a normative document that does not exist. Point \`${declaredPath}\` at a document that is there, or drop the grounds that moved away.`;

const notADocument = (declaredPath: string): string =>
  `A rule must not name anything but a document as its grounds. \`${declaredPath}\` is not a \`${DOCUMENT_SUFFIX}\` file. Name the document that carries the norm.`;

const reachableDocuments = ({
  workspace,
  places,
}: {
  readonly workspace: LintRuleWorkspace;
  readonly places: NormativeDocumentPlaces;
}): readonly string[] => [places.fileName, join(workspace.workspaceDir, places.fileName)];

const outsideTheNorms = ({
  declaredPath,
  places,
}: {
  readonly declaredPath: string;
  readonly places: NormativeDocumentPlaces;
}): string =>
  `A rule must not draw its grounds from outside the normative documents. Point \`${declaredPath}\` at a document this repository declares as normative, which is an \`${places.fileName}\` or a document directly in one of ${JSON.stringify(places.directories)}, at the repository root or in the workspace that owns the rule.`;

const declarationProblem = ({
  repositoryRoot,
  workspace,
  places,
  normativeDocuments,
  declaredPath,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
  readonly places: NormativeDocumentPlaces;
  readonly normativeDocuments: readonly string[];
  readonly declaredPath: string;
}): string | null => {
  if (normativeDocuments.includes(declaredPath)) return null;

  if (reachableDocuments({ workspace, places }).includes(declaredPath)) {
    return existsSync(join(repositoryRoot, declaredPath)) ? null : absent(declaredPath);
  }

  if (!declaredPath.endsWith(DOCUMENT_SUFFIX)) return notADocument(declaredPath);
  if (!existsSync(join(repositoryRoot, declaredPath))) return absent(declaredPath);

  return outsideTheNorms({ declaredPath, places });
};

const MISSING = `A rule must not go without the normative documents it enforces. Declare their repository-relative paths in \`meta.docs.relatedGuidelines\`, so a reader of the norm can find what enforces it.`;

const UNREADABLE = `A rule must not name its grounds with anything the checks cannot resolve to a path while reading the source. Something in this declaration does not settle into a path, so the checks that read the grounds match nothing against it. Write the paths as literals, or as a constant of this file that holds them.`;

const repeated = (declaredPath: string): string =>
  `A rule must not name the same normative document twice. Remove the repeated \`${declaredPath}\`.`;

const ruleGuidelineProblems = ({
  repositoryRoot,
  workspace,
  places,
  normativeDocuments,
  rule,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
  readonly places: NormativeDocumentPlaces;
  readonly normativeDocuments: readonly string[];
  readonly rule: BundledLintRule;
}): readonly LintRuleProblem[] => {
  const file = join(workspace.workspaceDir, rule.sourcePath);
  if (rule.unreadableGuidelines > 0) return [{ file, message: UNREADABLE }];
  if (rule.relatedGuidelines.length === 0) return [{ file, message: MISSING }];

  return rule.relatedGuidelines.flatMap((declaredPath, position): readonly LintRuleProblem[] => {
    if (rule.relatedGuidelines.indexOf(declaredPath) !== position) {
      return [{ file, message: repeated(declaredPath) }];
    }

    const complaint = declarationProblem({
      repositoryRoot,
      workspace,
      places,
      normativeDocuments,
      declaredPath,
    });
    return complaint === null ? [] : [{ file, message: complaint }];
  });
};

export const relatedGuidelineProblems = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): LintRuleCheckReport => {
  const places = normativeDocumentPlacesIn(repositoryRoot);
  const workspaces = lintRuleWorkspacesIn(repositoryRoot);
  const normativeDocuments = normativeDocumentsIn({
    repositoryRoot,
    places,
    workspaceDirectories: workspaces.map((workspace) => workspace.workspaceDir),
  });
  const scanned = workspaces.flatMap((workspace) =>
    workspaceRulesOf({ repositoryRoot, workspace }).map((rule) => ({ workspace, rule })),
  );

  const namingAPlace = scanned.some(({ rule }) =>
    rule.relatedGuidelines.some((declaredPath) => declaredPath.includes("/")),
  );
  if (places.directories.length === 0 && namingAPlace) {
    return {
      problems: [{ file: "package.json", message: NO_PLACE_DECLARED }],
      scanned: scanned.length,
    };
  }

  return {
    problems: scanned.flatMap(({ workspace, rule }) =>
      ruleGuidelineProblems({ repositoryRoot, workspace, places, normativeDocuments, rule }),
    ),
    scanned: scanned.length,
  };
};
