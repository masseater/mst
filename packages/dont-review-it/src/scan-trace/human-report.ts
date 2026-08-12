import { styleText } from "node:util";

import { sumBy } from "es-toolkit";

import { counted, pluralized } from "./pluralized.ts";

import type { CheckOutcome } from "@mst/repository-checks";

const PASS_MARK = "✓";

const FAIL_MARK = "✗";

const SKIP_MARK = "⊘";

const INDENT = "  ";

const GAP = "  ";

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

const markOf = ({
  outcome,
  palette,
}: {
  readonly outcome: CheckOutcome;
  readonly palette: Palette;
}): string => {
  if (outcome.skippedReason !== null) return painted({ color: "dim", text: SKIP_MARK, palette });
  return outcome.problems.length === 0
    ? painted({ color: "green", text: PASS_MARK, palette })
    : painted({ color: "red", text: FAIL_MARK, palette });
};

const scaleOf = ({
  outcome,
  countWidth,
}: {
  readonly outcome: CheckOutcome;
  readonly countWidth: number;
}): string =>
  outcome.skippedReason === null
    ? `${String(outcome.count).padStart(countWidth)} ${pluralized({ count: outcome.count, noun: outcome.unit })}`
    : `skipped — ${outcome.skippedReason}`;

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

const tailOf = (outcome: CheckOutcome): string => {
  const reported = reportedCounts({
    problems: outcome.problems.length,
    warnings: outcome.warnings.length,
  });
  return reported.length === 0 ? "" : `${GAP}${reported.join(", ")}`;
};

const tallyOf = (outcomes: readonly CheckOutcome[]): string => {
  const ran = counted({ count: outcomes.length, noun: "check" });
  const reported = reportedCounts({
    problems: sumBy(outcomes, (outcome) => outcome.problems.length),
    warnings: sumBy(outcomes, (outcome) => outcome.warnings.length),
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
  const nameWidth = Math.max(...outcomes.map((outcome) => outcome.check.length));
  const countWidth = Math.max(...outcomes.map((outcome) => String(outcome.count).length));
  const lines = outcomes.map(
    (outcome) =>
      `${INDENT}${markOf({ outcome, palette })} ${outcome.check.padEnd(nameWidth)}${GAP}${scaleOf({ outcome, countWidth })}${tailOf(outcome)}`,
  );
  return `${lines.join("\n")}\n\n${INDENT}${painted({ color: "dim", text: tallyOf(outcomes), palette })}\n`;
};
