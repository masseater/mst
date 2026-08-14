import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { countBy } from "es-toolkit";

import {
  blockOf,
  normalizedContent,
  regionIn,
  withRefreshedRegion,
  type GeneratedRegion,
} from "../generated-region.ts";
import { REGENERATE_COMMAND } from "../regenerate-command.ts";
import { lintRuleWorkspacesIn, type LintRuleWorkspace } from "./lint-rule-workspaces.ts";
import { textOrNull } from "./read-text.ts";
import { renderRuleIndex } from "./render-rule-index.ts";
import { workspaceRulesOf } from "./workspace-rules.ts";

import type { LintRuleCheckReport, LintRuleProblem } from "../lint-rule-problem.ts";

const BEGIN_MARKER = "<!-- BEGIN GENERATED lint-rules -->";

const END_MARKER = "<!-- END GENERATED lint-rules -->";

const missingIndex = (file: string): string =>
  `A workspace that declares lint rules must not go without \`${file}\`. Generate it with \`${REGENERATE_COMMAND}\`.`;

const missingMarkers = (file: string): string =>
  `\`${file}\` must not lose its generated region. Put \`${BEGIN_MARKER}\` and \`${END_MARKER}\` back, or delete the file and regenerate it with \`${REGENERATE_COMMAND}\`.`;

const staleIndex = (file: string): string =>
  `\`${file}\` must not fall behind the rule implementations. Regenerate it with \`${REGENERATE_COMMAND}\`.`;

const duplicatedRuleName = ({
  ruleName,
  workspaceDir,
}: {
  readonly ruleName: string;
  readonly workspaceDir: string;
}): string =>
  `Two rules in \`${workspaceDir}\` must not share the name \`${ruleName}\`; they claim the same document. Rename one of them.`;

const wrappedBlockOf = (writtenContent: string): string =>
  blockOf({ begin: BEGIN_MARKER, content: writtenContent, end: END_MARKER });

const FRONTMATTER_FENCE = "---\n";

const withInsertedRegion = ({
  source,
  content: writtenContent,
}: {
  readonly source: string;
  readonly content: string;
}): string => {
  const fenceClosesAt = source.startsWith(FRONTMATTER_FENCE)
    ? source.indexOf(`\n${FRONTMATTER_FENCE}`, FRONTMATTER_FENCE.length)
    : -1;
  if (fenceClosesAt === -1) return `${wrappedBlockOf(writtenContent)}\n\n${source}`;

  const frontmatterEndsAt = fenceClosesAt + `\n${FRONTMATTER_FENCE}`.length;
  return `${source.slice(0, frontmatterEndsAt)}\n${wrappedBlockOf(writtenContent)}\n\n${source.slice(frontmatterEndsAt)}`;
};

const scaffoldOf = (writtenContent: string): string =>
  `# lint ルール索引\n\nこのワークスペースの自前 lint ルールの一覧。ルール実装から生成される。手で書き換えない。更新は \`${REGENERATE_COMMAND}\` で行う。\n\n${wrappedBlockOf(writtenContent)}\n`;

type ReconcileTarget = {
  readonly absolutePath: string;
  readonly file: string;
  readonly expected: string;
  readonly write: boolean;
};

const absentIndexProblems = ({
  absolutePath,
  file,
  expected,
  write,
}: ReconcileTarget): readonly LintRuleProblem[] => {
  if (!write) return [{ file, message: missingIndex(file) }];
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, scaffoldOf(expected), "utf8");
  return [];
};

const unmarkedIndexProblems = ({
  target,
  source,
}: {
  readonly target: ReconcileTarget;
  readonly source: string;
}): readonly LintRuleProblem[] => {
  if (!target.write) return [{ file: target.file, message: missingMarkers(target.file) }];
  writeFileSync(
    target.absolutePath,
    withInsertedRegion({ source, content: target.expected }),
    "utf8",
  );
  return [];
};

const staleIndexProblems = ({
  target,
  region,
}: {
  readonly target: ReconcileTarget;
  readonly region: GeneratedRegion;
}): readonly LintRuleProblem[] => {
  if (normalizedContent(region.body) === normalizedContent(target.expected)) return [];
  if (!target.write) return [{ file: target.file, message: staleIndex(target.file) }];
  writeFileSync(
    target.absolutePath,
    withRefreshedRegion({ region, content: target.expected }),
    "utf8",
  );
  return [];
};

const contentProblems = ({
  repositoryRoot,
  file,
  expected,
  write,
}: {
  readonly repositoryRoot: string;
  readonly file: string;
  readonly expected: string;
  readonly write: boolean;
}): readonly LintRuleProblem[] => {
  const checked = { absolutePath: join(repositoryRoot, file), file, expected, write };
  const source = textOrNull(checked.absolutePath);
  if (source === null) return absentIndexProblems(checked);

  const region = regionIn({ source, begin: BEGIN_MARKER, end: END_MARKER });
  if (region === null) return unmarkedIndexProblems({ target: checked, source });
  return staleIndexProblems({ target: checked, region });
};

const reconcileWorkspace = ({
  repositoryRoot,
  workspace,
  write,
}: {
  readonly repositoryRoot: string;
  readonly workspace: LintRuleWorkspace;
  readonly write: boolean;
}): readonly LintRuleProblem[] => {
  const file = join(workspace.workspaceDir, "docs", "lint", "index.md");
  const rules = workspaceRulesOf({ repositoryRoot, workspace });

  const duplicates = Object.entries(countBy(rules, (rule) => rule.name))
    .filter(([, spellings]) => spellings > 1)
    .map(([ruleName]) => ({
      file,
      message: duplicatedRuleName({ ruleName, workspaceDir: workspace.workspaceDir }),
    }));

  return [
    ...duplicates,
    ...contentProblems({ repositoryRoot, file, expected: renderRuleIndex(rules), write }),
  ];
};

export const lintRuleIndexProblems = ({
  repositoryRoot,
  write,
}: {
  readonly repositoryRoot: string;
  readonly write: boolean;
}): LintRuleCheckReport => {
  const workspaces = lintRuleWorkspacesIn(repositoryRoot);
  return {
    problems: workspaces.flatMap((workspace) =>
      reconcileWorkspace({ repositoryRoot, workspace, write }),
    ),
    scanned: workspaces.length,
  };
};
