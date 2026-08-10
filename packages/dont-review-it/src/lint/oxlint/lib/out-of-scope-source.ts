const OUT_OF_SCOPE_FILE_NAME = /\.(?:test|spec|stories|story)\.[cm]?[jt]sx?$/u;

const OUT_OF_SCOPE_DIRECTORIES: ReadonlySet<string> = new Set([
  "__fixtures__",
  "__mocks__",
  "__stories__",
  "__tests__",
  "fixtures",
  "test",
  "tests",
]);

export const isOutOfScopeSource = (filename: string): boolean => {
  const segments = filename.split(/[/\\]/u);
  if (OUT_OF_SCOPE_FILE_NAME.test(segments.at(-1) ?? "")) return true;
  return segments.slice(0, -1).some((segment) => OUT_OF_SCOPE_DIRECTORIES.has(segment));
};
