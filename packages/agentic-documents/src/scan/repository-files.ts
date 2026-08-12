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
  const listedEntries = await readdir(absoluteDirectory, { withFileTypes: true });

  const nested = await Promise.all(
    listedEntries.map(async (listed): Promise<readonly string[]> => {
      const absolutePath = join(absoluteDirectory, listed.name);

      if (listed.isDirectory()) {
        if (ignoredDirectories.includes(listed.name)) return [];
        return collect({ absoluteDirectory: absolutePath, ignoredDirectories, matches });
      }

      if (listed.isSymbolicLink()) return [];
      if (!listed.isFile()) return [];

      return matches(listed.name) ? [absolutePath] : [];
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
