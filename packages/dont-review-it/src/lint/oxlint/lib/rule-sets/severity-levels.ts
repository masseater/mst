import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

import { spelledSeverityOf } from "../spelled-lint-severity.ts";

import type { ESTree } from "@oxlint/plugins";

export const SILENT_LEVEL = LINT_SEVERITY.OFF;

const LEVEL_BY_SPELLING: Readonly<Record<string, string>> = {
  "0": SILENT_LEVEL,
  "1": LINT_SEVERITY.WARN,
  "2": LINT_SEVERITY.ERROR,
  allow: SILENT_LEVEL,
  deny: LINT_SEVERITY.ERROR,
  error: LINT_SEVERITY.ERROR,
  off: SILENT_LEVEL,
  warn: LINT_SEVERITY.WARN,
};

const RANK_BY_LEVEL: Readonly<Record<string, number>> = { error: 2, off: 0, warn: 1 };

export const severityLevelOf = (held: ESTree.Expression): string | null => {
  const spelled = spelledSeverityOf(held);
  return spelled === null ? null : (LEVEL_BY_SPELLING[spelled] ?? null);
};

export const rankOfLevel = (level: string): number => RANK_BY_LEVEL[level] ?? 0;

export const strongestLevelAmong = (levels: readonly string[]): string =>
  levels.toSorted((left, right) => rankOfLevel(right) - rankOfLevel(left))[0] ?? SILENT_LEVEL;
