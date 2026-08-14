const LINT_SEGMENT = "lint";

const UNKNOWN_TOOL = "-";

export const lintToolOf = (sourcePath: string): string => {
  const segments = sourcePath.split("/");
  const lintSegmentAt = segments.indexOf(LINT_SEGMENT);
  if (lintSegmentAt === -1) return UNKNOWN_TOOL;
  return segments[lintSegmentAt + 1] ?? UNKNOWN_TOOL;
};
