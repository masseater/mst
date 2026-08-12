import { isAbsolute } from "node:path";

import { declaresPublicSubpath } from "./package-entries.ts";
import { packageDirectoryInWorkspace, packageReferenceOf } from "./specifier-resolution.ts";

const MODULE_FILE_SPECIFIER = /\.[cm]?[jt]sx?$/u;

const REPOSITORY_PATH_PREFIXES: readonly string[] = [".", "/", "#"];

const isPackageSpecifier = (listed: string): boolean =>
  !REPOSITORY_PATH_PREFIXES.some((prefix) => listed.startsWith(prefix)) &&
  !isAbsolute(listed) &&
  !MODULE_FILE_SPECIFIER.test(listed) &&
  packageReferenceOf(listed) !== null;

const reachesOwnPublicEntry = ({
  entry: listed,
  fromFile,
  workspaceRoot,
}: {
  readonly entry: string;
  readonly fromFile: string;
  readonly workspaceRoot: string;
}): boolean => {
  const found = packageDirectoryInWorkspace({ specifier: listed, fromFile, workspaceRoot });
  if (found === null) return true;
  return declaresPublicSubpath({ packageDirectory: found.directory, subpath: found.subpath });
};

export const misplacedFixturePackages = ({
  allowed,
  fromFile,
  workspaceRoot,
}: {
  readonly allowed: readonly string[];
  readonly fromFile: string;
  readonly workspaceRoot: string;
}): readonly string[] =>
  allowed.filter(
    (listed) =>
      !isPackageSpecifier(listed) ||
      !reachesOwnPublicEntry({ entry: listed, fromFile, workspaceRoot }),
  );
