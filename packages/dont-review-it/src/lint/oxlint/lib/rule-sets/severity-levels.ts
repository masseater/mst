import { spelledSeverityOf } from "../spelled-lint-severity.ts";

import type { ESTree } from "@oxlint/plugins";

export const SILENT_LEVEL = "off";

const LEVEL_BY_SPELLING: Readonly<Record<string, string>> = {
  "0": SILENT_LEVEL,
  "1": "warn",
  "2": "error",
  allow: SILENT_LEVEL,
  deny: "error",
  error: "error",
  off: SILENT_LEVEL,
  warn: "warn",
};

const RANK_BY_LEVEL: Readonly<Record<string, number>> = { error: 2, off: 0, warn: 1 };

export const severityLevelOf = (value: ESTree.Expression): string | null => {
  const spelled = spelledSeverityOf(value);
  return spelled === null ? null : (LEVEL_BY_SPELLING[spelled] ?? null);
};

export const rankOfLevel = (level: string): number => RANK_BY_LEVEL[level] ?? 0;

export const strongestLevelAmong = (levels: readonly string[]): string =>
  levels.toSorted((left, right) => rankOfLevel(right) - rankOfLevel(left))[0] ?? SILENT_LEVEL;
