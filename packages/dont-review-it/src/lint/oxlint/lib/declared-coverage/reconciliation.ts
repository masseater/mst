import { dirname, join } from "node:path";

import { groupBy, memoize } from "es-toolkit";

import { nearestPackageDirectory } from "../canonical-values/source-files.ts";
import {
  REPOSITORY_ROOT_WORKSPACE,
  workspaceDirectoryOf,
} from "../dependency-catalog/shared-dependency-index.ts";
import { worktreeFilePathsUnder } from "../repository-scan/worktree-files.ts";
import { deadRowFindings, registrationFindings } from "./registration-reach.ts";
import { scopeClosureFindings } from "./scope-closure.ts";
import {
  broadDeclarationFindings,
  coversWholeDirectory,
  uncheckedPathFindings,
} from "./uncovered-paths.ts";

import type { CoverageDeclarations, CoverageFinding } from "./coverage-declarations.ts";

export type CoverageReconciliation = {
  readonly repositoryRoot: string;
  readonly declarations: CoverageDeclarations;
  readonly unscannedDirectoryNames: ReadonlySet<string>;
};

const UNCHECKED_DECLARATION_REGISTRY = "the declaration of paths no check reads";

const heldWorkspaceOf = (asked: {
  readonly repositoryRoot: string;
  readonly heldPath: string | null;
}): string => {
  const { heldPath, repositoryRoot } = asked;
  if (heldPath === null) return REPOSITORY_ROOT_WORKSPACE;

  const packageDirectory = nearestPackageDirectory(
    dirname(join(repositoryRoot, heldPath)),
    repositoryRoot,
  );
  return packageDirectory === null
    ? REPOSITORY_ROOT_WORKSPACE
    : workspaceDirectoryOf({ repositoryRoot, packageDirectory });
};

const findingsIn = (reconciled: CoverageReconciliation): readonly CoverageFinding[] => {
  const { declarations, repositoryRoot } = reconciled;
  const paths = worktreeFilePathsUnder({
    root: repositoryRoot,
    unscannedDirectoryNames: reconciled.unscannedDirectoryNames,
  });
  const { checks, uncheckedDeclarations } = declarations;

  return [
    ...uncheckedPathFindings({ paths, checks, uncheckedDeclarations }),
    ...broadDeclarationFindings(uncheckedDeclarations),
    ...deadRowFindings({
      registry: UNCHECKED_DECLARATION_REGISTRY,
      rows: uncheckedDeclarations.filter(
        (uncheckedDeclaration) => !coversWholeDirectory(uncheckedDeclaration.pattern),
      ),
      paths,
    }),
    ...registrationFindings({ tables: declarations.tables, checks, paths }),
    ...scopeClosureFindings({ scopes: declarations.scopes, paths, repositoryRoot }),
  ];
};

const readReconciliation = (
  reconciled: CoverageReconciliation,
): ReadonlyMap<string, readonly CoverageFinding[]> => {
  const held = findingsIn(reconciled).map((finding) => ({
    ...finding,
    workspace: heldWorkspaceOf({
      repositoryRoot: reconciled.repositoryRoot,
      heldPath: finding.heldPath,
    }),
  }));
  return new Map(Object.entries(groupBy(held, (finding) => finding.workspace)));
};

const keyOf = (reconciled: CoverageReconciliation): string =>
  [
    reconciled.repositoryRoot,
    JSON.stringify(reconciled.declarations),
    ...[...reconciled.unscannedDirectoryNames].toSorted(),
  ].join("\n");

export const coverageFindingsIn = memoize(readReconciliation, { getCacheKey: keyOf });
