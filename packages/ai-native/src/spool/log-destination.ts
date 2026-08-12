import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const findSpoolRoot = (currentDir: string, fallbackDir: string): string => {
  if (existsSync(join(currentDir, "package.json"))) {
    return join(currentDir, ".spool");
  }
  const parent = dirname(currentDir);
  return parent === currentDir ? join(fallbackDir, ".spool") : findSpoolRoot(parent, fallbackDir);
};

export const defaultSpoolRoot = (startDir: string = process.cwd()): string =>
  findSpoolRoot(resolve(startDir), resolve(startDir));

export const timestampOf = (stampedDate: Date): string =>
  `${stampedDate.toISOString().slice(0, 19).replaceAll(/[:-]/g, "")}Z`;

export const commandIdOf = (command: readonly [string, ...string[]]): string =>
  [basename(command[0]), ...command.slice(1, 2)]
    .join(" ")
    .replaceAll(/[^\w-]+/g, "-")
    .slice(0, 40);
