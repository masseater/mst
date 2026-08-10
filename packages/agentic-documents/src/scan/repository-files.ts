import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const collect = async ({
  absoluteDirectory,
  ignoredDirectories,
  matches,
}: {
  readonly absoluteDirectory: string;
  readonly ignoredDirectories: readonly string[];
  readonly matches: (entryName: string) => boolean;
}): Promise<readonly string[]> => {
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const absolutePath = join(absoluteDirectory, entry.name);

      if (entry.isDirectory()) {
        if (ignoredDirectories.includes(entry.name)) return [];
        return collect({ absoluteDirectory: absolutePath, ignoredDirectories, matches });
      }

      if (entry.isSymbolicLink()) return [];
      if (!entry.isFile()) return [];

      return matches(entry.name) ? [absolutePath] : [];
    }),
  );

  return nested.flat();
};

export const findFilesNamed = async ({
  repositoryRoot,
  fileName,
  ignoredDirectories,
}: {
  readonly repositoryRoot: string;
  readonly fileName: string;
  readonly ignoredDirectories: readonly string[];
}): Promise<readonly string[]> => {
  const absolutePaths = await collect({
    absoluteDirectory: repositoryRoot,
    ignoredDirectories,
    matches: (entryName) => entryName === fileName,
  });

  return absolutePaths.map((absolutePath) => relative(repositoryRoot, absolutePath)).toSorted();
};
