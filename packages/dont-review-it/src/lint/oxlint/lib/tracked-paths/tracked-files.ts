import { gitOutput, type GitEnvironment } from "../git-output.ts";
import { toPosixPath } from "../posix-path.ts";

const NUL_SEPARATOR = "\0";

export const trackedFilesIn = (environment: GitEnvironment): readonly string[] => {
  const listed = gitOutput(["ls-files", "--cached", "-z"], environment);
  if (listed === null) return [];

  return listed
    .split(NUL_SEPARATOR)
    .filter((path) => path !== "")
    .map((path) => toPosixPath(path));
};
