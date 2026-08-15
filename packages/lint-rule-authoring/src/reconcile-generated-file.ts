import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  blockOf,
  normalizedContent,
  regionIn,
  withRefreshedRegion,
  type GeneratedRegion,
} from "./generated-region.ts";
import { REGENERATE_COMMAND } from "./regenerate-command.ts";
import { textOrNull } from "./rule-index/read-text.ts";

import type { LintRuleProblem } from "./lint-rule-problem.ts";

export const staleGeneratedFile = ({
  file,
  behind,
}: {
  readonly file: string;
  readonly behind: string;
}): string =>
  `\`${file}\` must not fall behind ${behind}. Regenerate it with \`${REGENERATE_COMMAND}\`.`;

export type GeneratedFile = {
  readonly repositoryRoot: string;
  readonly file: string;
  readonly begin: string;
  readonly end: string;
  readonly expected: string;
  readonly scaffold: (block: string) => string;
  readonly absent: (file: string) => string;
  readonly stale: (file: string) => string;
  readonly write: boolean;
};

const wrappedBlockOf = (reconciled: GeneratedFile): string =>
  blockOf({ begin: reconciled.begin, content: reconciled.expected, end: reconciled.end });

const absentProblems = ({
  reconciled,
  absolutePath,
}: {
  readonly reconciled: GeneratedFile;
  readonly absolutePath: string;
}): readonly LintRuleProblem[] => {
  if (!reconciled.write) {
    return [{ file: reconciled.file, message: reconciled.absent(reconciled.file) }];
  }
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, reconciled.scaffold(wrappedBlockOf(reconciled)), "utf8");
  return [];
};

const FRONTMATTER_FENCE = "---\n";

const withInsertedRegion = ({
  source,
  block,
}: {
  readonly source: string;
  readonly block: string;
}): string => {
  const fenceClosesAt = source.startsWith(FRONTMATTER_FENCE)
    ? source.indexOf(`\n${FRONTMATTER_FENCE}`, FRONTMATTER_FENCE.length)
    : -1;
  if (fenceClosesAt === -1) return `${block}\n\n${source}`;

  const frontmatterEndsAt = fenceClosesAt + `\n${FRONTMATTER_FENCE}`.length;
  return `${source.slice(0, frontmatterEndsAt)}\n${block}\n\n${source.slice(frontmatterEndsAt)}`;
};

const lostRegion = (reconciled: GeneratedFile): string =>
  `\`${reconciled.file}\` must not lose its generated region. Put \`${reconciled.begin}\` and \`${reconciled.end}\` back, or delete the file and regenerate it with \`${REGENERATE_COMMAND}\`.`;

const unmarkedProblems = ({
  reconciled,
  absolutePath,
  source,
}: {
  readonly reconciled: GeneratedFile;
  readonly absolutePath: string;
  readonly source: string;
}): readonly LintRuleProblem[] => {
  if (!reconciled.write) return [{ file: reconciled.file, message: lostRegion(reconciled) }];
  writeFileSync(
    absolutePath,
    withInsertedRegion({ source, block: wrappedBlockOf(reconciled) }),
    "utf8",
  );
  return [];
};

const staleProblems = ({
  reconciled,
  absolutePath,
  region,
}: {
  readonly reconciled: GeneratedFile;
  readonly absolutePath: string;
  readonly region: GeneratedRegion;
}): readonly LintRuleProblem[] => {
  if (normalizedContent(region.body) === normalizedContent(reconciled.expected)) return [];
  if (!reconciled.write) {
    return [{ file: reconciled.file, message: reconciled.stale(reconciled.file) }];
  }
  writeFileSync(
    absolutePath,
    withRefreshedRegion({ region, content: reconciled.expected }),
    "utf8",
  );
  return [];
};

export const generatedFileProblems = (reconciled: GeneratedFile): readonly LintRuleProblem[] => {
  const absolutePath = join(reconciled.repositoryRoot, reconciled.file);
  const source = textOrNull(absolutePath);
  if (source === null) return absentProblems({ reconciled, absolutePath });

  const region = regionIn({ source, begin: reconciled.begin, end: reconciled.end });
  if (region === null) return unmarkedProblems({ reconciled, absolutePath, source });
  return staleProblems({ reconciled, absolutePath, region });
};
