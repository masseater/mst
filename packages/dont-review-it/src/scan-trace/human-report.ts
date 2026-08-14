import { styleText } from "node:util";

import { sumBy } from "es-toolkit";

import { counted, pluralized } from "./pluralized.ts";

import type { CheckOutcome } from "@mst/repository-checks";

const INDENT = "  ";

type Palette = { readonly colored: boolean };

const painted = ({
  color,
  text,
  palette,
}: {
  readonly color: "green" | "red" | "dim";
  readonly text: string;
  readonly palette: Palette;
}): string => (palette.colored ? styleText(color, text, { validateStream: false }) : text);

const PASS_MARK = "✓";

const FAIL_MARK = "✗";

const SKIP_MARK = "⊘";

const markOf = ({
  outcome: ranCheck,
  palette,
}: {
  readonly outcome: CheckOutcome;
  readonly palette: Palette;
}): string => {
  if (ranCheck.skippedReason !== null) return painted({ color: "dim", text: SKIP_MARK, palette });
  return ranCheck.problems.length === 0
    ? painted({ color: "green", text: PASS_MARK, palette })
    : painted({ color: "red", text: FAIL_MARK, palette });
};

const scaleOf = ({
  outcome: ranCheck,
  countWidth,
}: {
  readonly outcome: CheckOutcome;
  readonly countWidth: number;
}): string =>
  ranCheck.skippedReason === null
    ? `${String(ranCheck.count).padStart(countWidth)} ${pluralized({ count: ranCheck.count, noun: ranCheck.unit })}`
    : `skipped — ${ranCheck.skippedReason}`;

const reportedCounts = ({
  problems,
  warnings,
}: {
  readonly problems: number;
  readonly warnings: number;
}): readonly string[] => [
  ...(problems === 0 ? [] : [counted({ count: problems, noun: "problem" })]),
  ...(warnings === 0 ? [] : [counted({ count: warnings, noun: "warning" })]),
];

const GAP = "  ";

const tailOf = (ranCheck: CheckOutcome): string => {
  const reported = reportedCounts({
    problems: ranCheck.problems.length,
    warnings: ranCheck.warnings.length,
  });
  return reported.length === 0 ? "" : `${GAP}${reported.join(", ")}`;
};

const tallyOf = (outcomes: readonly CheckOutcome[]): string => {
  const ran = counted({ count: outcomes.length, noun: "check" });
  const reported = reportedCounts({
    problems: sumBy(outcomes, (ranCheck) => ranCheck.problems.length),
    warnings: sumBy(outcomes, (ranCheck) => ranCheck.warnings.length),
  });
  return reported.length === 0
    ? `${ran} ran, nothing to report`
    : `${ran} ran, ${reported.join(", ")}`;
};

export const humanScanTrace = ({
  outcomes,
  colored,
}: {
  readonly outcomes: readonly CheckOutcome[];
  readonly colored: boolean;
}): string => {
  if (outcomes.length === 0) return "";

  const palette = { colored };
  const nameWidth = Math.max(...outcomes.map((ranCheck) => ranCheck.check.length));
  const countWidth = Math.max(...outcomes.map((ranCheck) => String(ranCheck.count).length));
  const lines = outcomes.map(
    (ranCheck) =>
      `${INDENT}${markOf({ outcome: ranCheck, palette })} ${ranCheck.check.padEnd(nameWidth)}${GAP}${scaleOf({ outcome: ranCheck, countWidth })}${tailOf(ranCheck)}`,
  );
  return `${lines.join("\n")}\n\n${INDENT}${painted({ color: "dim", text: tallyOf(outcomes), palette })}\n`;
};
