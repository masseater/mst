import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const resolveRepositoryRoot = (startDir: string): string => {
  const ancestors = (dir: string): readonly string[] => {
    const parent = dirname(dir);
    return parent === dir ? [dir] : [dir, ...ancestors(parent)];
  };
  const found = ancestors(startDir).find((dir) => existsSync(join(dir, ".git")));
  return found ?? startDir;
};
